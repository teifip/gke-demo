const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const token = require('./lib/token.js');
const logger = require('./lib/logger.js');
const oauth2 = require('nest-rest').oauth2;
const collector = require('./lib/collector.js');
const version = require('./package.json').version;
const description = require('./package.json').description;

const interval = Math.max(parseInt(process.env.COLLECTION_INTERVAL_MINUTES), 2);

let accessToken = null;
let collectingData = false;

function init() {
  token.retrieve((error, value) => {
    if (error) {
      logger('ERROR', `Could not read from token storage. ${error.message}`);
    } else if (value) {
      logger('INFO', 'Access token found in storage bucket');
      accessToken = value;
    }

    let port = process.env.DATA_COLLECTOR_SERVER_PORT;
    http.createServer(requestHandler).listen(port, () => {
      logger('INFO', `${description} v${version} is listening on port ${port}`);
    });
  });
}

function requestHandler(req, res) {
  let reqUrl = new URL(`http://${req.headers.host}${req.url}`);

  if (req.method === 'GET' && reqUrl.pathname === '/status') {
    res.writeHead(200, {'content-type': 'application/json'});
    let response = {};
    if (accessToken) {
      response.active = collectingData;
      response.minutes = interval;
    } else {
      response.state = crypto.randomBytes(8).toString('hex');
      response.loginUrl = oauth2.generateAuthorizationUrl(response.state);
    }
    res.end(JSON.stringify(response));

  } else if (req.method === 'GET' && reqUrl.pathname === '/code') {
    let code = reqUrl.searchParams.get('code');
    oauth2.exchangeCodeForToken(code, (error, result) => {
      if (error) {
        logger('ERROR', `Could not reach token endpoint. ${error.message}`);
        res.statusCode = 204;
        res.end();
      } else if (!result.success) {
        logger('WARN', `Token endpoint replied ${result.response.code}`);
        res.statusCode = 204;
        res.end();
      } else {
        logger('INFO', 'Code exchanged for token');
        token.save(result.token, (error) => {
          if (error) {
            logger('ERROR', `Could not save token. ${error.message}`);
          } else {
            logger('INFO', 'Token saved in storage bucket');
          }
          accessToken = result.token;
          res.statusCode = 204;
          res.end();
        });
      }
    });

  } else if (req.method === 'GET' && reqUrl.pathname === '/start') {
    collector.start(accessToken, interval * 60000);
    collectingData = true;
    res.statusCode = 204;
    res.end();

  } else if (req.method === 'GET' && reqUrl.pathname === '/stop') {
    collector.stop();
    collectingData = false;
    res.statusCode = 204;
    res.end();

  } else if (req.method === 'GET' && reqUrl.pathname === '/revoke') {
    oauth2.revokeToken(accessToken, (error, result) => {
      if (error) {
        logger('ERROR', `Could not reach revocation endpoint. ${error.message}`);
        res.statusCode = 204;
        res.end();
      } else if (!result.success) {
        logger('WARN', `Revocation endpoint replied ${result.response.code}`);
        res.statusCode = 204;
        res.end();
      } else {
        logger('INFO', 'Token revoked');
        token.delete((error) => {
          if (error) {
            logger('ERROR', `Could not delete token. ${error.message}`);
          } else {
            logger('INFO', 'Token removed from storage bucket');
          }
          accessToken = null;
          if (collectingData) {
            collector.stop();
            collectingData = false;
          }
          res.statusCode = 204;
          res.end();
        });
      }
    });

  } else if (req.method === 'GET' && reqUrl.pathname === '/structures') {
    collector.getStructures(accessToken, (structures) => {
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(JSON.stringify(structures));
    });

  } else {
    logger('ERROR', `Unexpected ${req.method} ${reqUrl.pathname} request`);
    res.statusCode = 404;
    res.end();
  }
}

init();
