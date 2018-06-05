const http = require('http');
const { URL } = require('url');
const logger = require('./logger.js');
const apiClient = require('accept-json');

const options = {
  user: process.env.GF_SECURITY_ADMIN_USER,
  password: process.env.GF_SECURITY_ADMIN_PASSWORD,
  timeout: 3000
};

const client = apiClient(process.env.GRAFANA_URL, options);
const grafanaUrl = new URL(process.env.GRAFANA_URL);

exports.getDashboardUid = function(structure, callback) {
  let options = { query: { query: structure.id } };
  client.get('/api/search', options, (error, result) => {
    if (error) {
      logger('WARN', `Could not reach Grafana. ${error.message}`);
      callback(null);

    } else if (result.code !== 200) {
      let reply = `Grafana replied ${result.code}`;
      logger('ERROR', `Failed to search dashboard. ${reply}`);
      callback(null);

    } else if (result.body.length === 0) {
      createOrUpdateDashboard(structure, 'create', callback);

    } else {
      let uid = result.body[0].uid;
      client.get(`/api/dashboards/uid/${uid}`, (error, result) => {
        if (error) {
          logger('WARN', `Could not reach Grafana. ${error.message}`);
          callback(null);

        } else if (result.code !== 200) {
          let reply = `Grafana replied ${result.code}`;
          logger('ERROR', `Failed to retrieve dashboard. ${reply}`);
          callback(null);

        } else if (dashboardIsCurrent(structure, result.body.dashboard)) {
          callback(uid, result.body.meta.url);

        } else {
          createOrUpdateDashboard(structure, 'update', callback);
        }
      });
    }
  });
}

function createOrUpdateDashboard(structure, mode, callback) {
  let request = {
    overwrite: true,
    dashboard: {
      id: null,
      uid: null,
      title: structure.id,
      timezone: 'browser',
      panels: [{
        title: `${structure.name} temperatures`,
        type: 'graph',
        fill: 0,
        targets: []
      }]
    }
  };

  for (room of structure.rooms) {
    request.dashboard.panels[0].targets.push({
      alias: room,
      groupBy: [
        { params: [ '$__interval' ], type: 'time' },
        { params: [ 'linear' ], type: 'fill' }
      ],
      measurement: structure.id,
      orderByTime: 'ASC',
      policy: 'default',
      resultFormat: 'time_series',
      select: [[
          { params: [ 'temp' ], type: 'field' },
          { params: [], type: 'mean' }
      ]],
      tags: [ { key: 'room', operator: '=', value: room } ]
    });
  }

  client.post('/api/dashboards/db', { json: request }, (error, result) => {
    if (error) {
      logger('WARN', `Could not reach Grafana. ${error.message}`);
      callback(null);

    } else if (result.code !== 200) {
      let reply = `Grafana replied ${result.code}`;
      logger('ERROR', `Failed to ${mode} dashboard. ${reply}`);
      callback(null);

    } else {
      logger('INFO', `Dashboard ${result.body.uid} successfully ${mode}d`);
      callback(result.body.uid, result.body.url);
    }
  });
}

function dashboardIsCurrent(structure, dashboard) {
  if (!dashboard.panels[0].title.includes(structure.name)) {
    logger('INFO', `Structure name has changed for ${structure.id}`);
    return false;
  }

  if (dashboard.panels[0].targets.length !== structure.rooms.length) {
    logger('INFO', `Number of rooms has changed for ${structure.id}`);
    return false;
  }

  for (target of dashboard.panels[0].targets) {
    if (!structure.rooms.includes(target.alias)) {
      logger('INFO', `Room has changed name for ${structure.id}`);
      return false;
    }
  }

  return true;
}


exports.getAndServeRenderedPanel = function(req, res) {
  let options = {
    protocol: grafanaUrl.protocol,
    hostname: grafanaUrl.hostname,
    port: grafanaUrl.port,
    path: req.url.replace('/d/', '/render/d-solo/') + '&panelId=1',
    auth: `${process.env.GF_SECURITY_ADMIN_USER}:` +
          `${process.env.GF_SECURITY_ADMIN_PASSWORD}`
  };

  let request = http.request(options, (response) => response.pipe(res));

  request.setTimeout(4000, () => request.abort());

  request.on('error', (error) => {
    logger('WARN', `Could not reach Grafana. ${error.message}`);
    res.send();
  });

  request.end();
}
