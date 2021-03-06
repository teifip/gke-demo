const http = require('http');
const express = require('express');
const engines = require('consolidate');
const login = require('./lib/login.js');
const apiClient = require('accept-json');
const logger = require('./lib/logger.js');
const grafana = require('./lib/grafana.js');
const cookieParser = require('cookie-parser');
const version = require('./package.json').version;
const description = require('./package.json').description;

const LOGIN_PATH = '/login';
const WEBGUI_PATH = '/webgui';
const STORAGE_URL = 'https://storage.googleapis.com';

const app = express();
const bodyParser = express.urlencoded({ extended: false });
const client = apiClient(process.env.DATA_COLLECTOR_URL, { timeout: 3000 });
// Disable login if Google Sign-In OAuth client is not defined
const loginRequired = process.env.WEBGUI_LOGIN_CLIENT_ID !== undefined;
// Decide whether to serve static content from Google Cloud Storage or locally
const staticPath = process.env.WEBGUI_GS_BUCKET
                 ? `${STORAGE_URL}/${process.env.WEBGUI_GS_BUCKET}/assets`
                 : '/assets';

let state = null;

http.createServer(app).listen(process.env.WEBGUI_SERVER_PORT, () => {
  let port = process.env.WEBGUI_SERVER_PORT;
  logger('INFO', `${description} v${version} is listening on port ${port}`);
});

app.disable('x-powered-by');
app.disable('etag');
app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.set('trust proxy', 2);

app.get('/', (req, res) => {
  if (!req.headers.via) {
    // Reply 200 OK to health-checks from load balancer
    res.send();
  } else {
    // Immediately rejects external requests on root
    res.status(404).send();
  }
});

app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'https') {
    next('route');
  } else {
    // Redirect HTTP to HTTPS
    res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
});

app.use(cookieParser(process.env.WEBGUI_LOGIN_COOKIE_SECRET));

app.get(WEBGUI_PATH, authorizeUser, (req, res) => {
  client.get('/status', (error, response) => {
    if (error) {
      res.render('notification', {
        message: 'The data collection module is not ready',
        title: description,
        static: staticPath,
        home: WEBGUI_PATH
      });

    } else if (response.body.loginUrl) {
      // The data collection module does not have a token; start OAuth flow
      state = response.body.state;
      res.redirect(302, response.body.loginUrl);

    } else {
      // The data collection module has a token
      res.render('main', {
        active: response.body.active,
        minutes: response.body.minutes,
        title: description,
        static: staticPath
      });
    }
  });
});

app.post(WEBGUI_PATH, bodyParser, authorizeUser, (req, res) => {
  if (req.body.action === 'show') {
    createAndServeStructureSelectionPage(res);

  } else if (req.body.action === 'select') {
    createAndServePanel(req, res);

  } else if (req.body.action === 'start') {
    client.get('/start', (error, response) => {
      res.redirect(302, WEBGUI_PATH);
    });

  } else if (req.body.action === 'stop') {
    client.get('/stop', (error, response) => {
      res.redirect(302, WEBGUI_PATH);
    });

  } else if (req.body.action === 'revoke') {
    client.get('/revoke', (error, response) => {
      res.redirect(302, WEBGUI_PATH);
    });

  } else if (req.body.action === 'zoomin') {
    res.render('visualization', {
      uid: req.body.uid,
      url: req.body.url,
      interval: Math.max(req.body.interval / 2, 21600000), // min 6 hours
      end: req.body.end,
      tz: req.body.tz,
      title: description,
      static: staticPath,
      home: WEBGUI_PATH
    });

  } else if (req.body.action === 'zoomout') {
    res.render('visualization', {
      uid: req.body.uid,
      url: req.body.url,
      interval: Math.min(req.body.interval * 2, 172800000), // max 2 days
      end: req.body.end,
      tz: req.body.tz,
      title: description,
      static: staticPath,
      home: WEBGUI_PATH
    });

  } else if (req.body.action === 'back') {
    res.render('visualization', {
      uid: req.body.uid,
      url: req.body.url,
      interval: req.body.interval,
      end: (+req.body.end - req.body.interval),
      tz: req.body.tz,
      title: description,
      static: staticPath,
      home: WEBGUI_PATH
    });

  } else if (req.body.action === 'forward') {
    res.render('visualization', {
      uid: req.body.uid,
      url: req.body.url,
      interval: req.body.interval,
      end: Math.min(+req.body.end + req.body.interval, Date.now()),
      tz: req.body.tz,
      title: description,
      static: staticPath,
      home: WEBGUI_PATH
    });

  } else {
    res.redirect(302, WEBGUI_PATH);
  }
});

// Proxy for Grafana rendered panels
app.get('/d/:uid/:slug', authorizeUser, (req, res) => {
  grafana.getAndServeRenderedPanel(req, res);
});

// OAuth redirect URI
app.get('/redirect', authorizeUser, (req, res) => {
  if (req.query.state === state) {
    state = null;
    client.get('/code', {query: {code: req.query.code}}, (error, response) => {
      res.redirect(302, WEBGUI_PATH);
    });

  } else {
    res.status(401).send();
  }
});

// Sign-in with Google when enabled
app.get(LOGIN_PATH, (req, res) => {
  if (loginRequired) {
    res.render('login', {
      title: description,
      url: `https://${req.headers.host}${LOGIN_PATH}`,
      clientId: process.env.WEBGUI_LOGIN_CLIENT_ID,
      home: WEBGUI_PATH
    });

  } else {
    res.status(404).send();
  }
});

app.post(LOGIN_PATH, bodyParser, (req, res) => {
  login.exchangeIdTokenForCookie(req, (cookie) => {
    if (cookie) {
      res.cookie('token', cookie, {signed: true, httpOnly: true, secure: true});
      res.send();

    } else {
      res.clearCookie('token');
      res.send('sign-out');
    }
  });
});

// Not used when staticPath points to Google Cloud Storage
app.use('/assets', express.static(__dirname + '/static'));

app.use((req, res) => res.status(404).send());


function createAndServeStructureSelectionPage(res) {
  client.get('/structures', (error, response) => {
    if (error) {
      res.render('notification', {
        message: 'The data collection module is not ready',
        title: description,
        static: staticPath,
        home: WEBGUI_PATH
      });

    } else if (response.body.length === 0) {
      res.render('notification', {
        message: 'No data available at this time',
        title: description,
        static: staticPath,
        home: WEBGUI_PATH
      });

    } else {
      let structures = response.body.map(struct => {
        struct.token = Buffer.from(JSON.stringify(struct)).toString('base64');
        struct.rooms = struct.rooms.join(', ');
        return struct;
      });

      res.render('structure_selection', {
        title: description,
        static: staticPath,
        home: WEBGUI_PATH,
        structures: structures
      });
    }
  });
}

function createAndServePanel(req, res) {
  let structure;
  try {
    structure = JSON.parse(Buffer.from(req.body.token, 'base64'));
  } catch (error) {
    return res.redirect(302, WEBGUI_PATH);
  }

  let tzo = req.body.tzo / 60;
  let tz = tzo >= 0
         ? 'UTC-' + ('0' + tzo.toFixed()).slice(-2) + ':00'
         : 'UTC+' + ('0' + tzo.toFixed().slice(1)).slice(-2) + ':00';

  grafana.getDashboardUid(structure, (uid, url) => {
    if (uid) {
      let tstamp = Date.now();
      res.render('visualization', {
        uid: uid,
        url: url,
        interval: 86400000,
        end: tstamp,
        tz: encodeURIComponent(tz),
        title: description,
        static: staticPath,
        home: WEBGUI_PATH
      });

    } else {
      res.render('notification', {
        message: 'The visualization dashboard is not ready',
        title: description,
        static: staticPath,
        home: WEBGUI_PATH
      });
    }
  });
}

function authorizeUser(req, res, next) {
  if (!loginRequired || login.requestHasValidCookie(req)) {
    next();
  } else {
    res.redirect(302, LOGIN_PATH);
  }
}
