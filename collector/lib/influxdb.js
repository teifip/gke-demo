const apiClient = require('accept-json');
const logger = require('./logger.js');

const MAX_BACKLOG_LENGTH = 64;

const client = apiClient(process.env.INFLUXDB_URL, { timeout: 5000 });
const retention = Math.max(parseInt(process.env.DATA_RETENTION_DAYS), 2);
const dbName = process.env.INFLUXDB_DB_NAME;

let backlog = [];

exports.write = write;

function write(newPoints) {
  let points = backlog.concat(newPoints);
  backlog = [];

  let options = {
    query: { db: dbName, precision: 'ms' },
    text: points.join('\n')
  };

  client.post('/write', options, (error, result) => {
    if (error || result.code !== 204) {
      let excess = backlog.length + points.length - MAX_BACKLOG_LENGTH;
      backlog = backlog.concat(points).slice(Math.max(excess, 0));

      if (error) {
        logger('WARN', `Could not reach InfluxDB. ${error.message}`);
      } else if (result.code === 404) {
        createDatabase();
      } else {
        logger('ERROR', `InfluxDB replied ${result.code}`);
      }
    }
  });
}

function createDatabase() {
  let options = {
    form: { q: `CREATE DATABASE "${dbName}" WITH DURATION ${retention}d` }
  };

  client.post('/query', options, (error, result) => {
    if (error) {
      logger('ERROR', `Failed to create database. ${error.message}`);
    } else if (result.code !== 200) {
      let reply = result.code;
      logger('ERROR', `Failed to create database. InfluxDB replied ${reply}`);
    } else {
      logger('INFO', `InfluxDB database '${dbName}' successfully created`);
      // Retry to write; all points are in the backlog now
      write([]);
    }
  });
}

exports.getStructures = function(callback) {
  let structures = [];
  let options = { query: { db: dbName, q: 'SHOW SERIES' } };

  client.get('/query', options, (error, result) => {
    if (error) {
      logger('WARN', `Could not reach InfluxDB. ${error.message}`);

    } else if (result.code !== 200) {
      let reply = result.code;
      logger('ERROR', `Failed to retrieve series. InfluxDB replied ${reply}`);

    } else if (result.body.results[0].series) {
      let data = {};
      result.body.results[0].series[0].values.forEach(a => {
        let parts = a[0].split(',');
        let structure = parts[0];
        let room = parts[1].split('=')[1].replace(/\\ /g, ' ');
        if (data[structure]) {
          data[structure].rooms.push(room);
        } else {
          data[structure] = { id: structure, rooms: [room] };
        }
      });
      structures = Object.values(data);
    }

    callback(structures);
  });
}
