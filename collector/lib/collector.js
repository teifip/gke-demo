const nest = require('nest-rest');
const logger = require('./logger.js');
const influxdb = require('./influxdb.js');

const useCelsius = /celsius/i.test(process.env.TEMPERATURE_SCALE);

let timer;
let names = {};

exports.start = function(token, interval) {
  let client = nest.restApiClient(token);
  collectData(client);
  timer = setInterval(collectData, interval, client);
  logger('INFO', 'Periodic data collection started');
}

exports.stop = function() {
  clearInterval(timer);
  logger('INFO', 'Periodic data collection stopped');
}

function collectData(client) {
  client.read('/devices/thermostats', (error, result) => {
    if (error) {
      logger('ERROR', `Could not reach Nest server. ${error.message}`);
    } else if (!result.success) {
      logger('WARN', `Nest server replied ${result.response.code}`);
    } else {
      let points = [];
      for (device in result.data) {
        let room = result.data[device].name.replace(/ /g, '\\ ');
        let temp = useCelsius
                 ? result.data[device].ambient_temperature_c
                 : result.data[device].ambient_temperature_f;
        let time = (new Date(result.data[device].last_connection)).getTime();
        let home = result.data[device].structure_id;
        points.push(`${home},room=${room} temp=${temp} ${time}`);
      }
      influxdb.write(points);
    }
  });
}

exports.getStructures = function(token, callback) {
  influxdb.getStructures((structures) => {
    let allNamesAlreadyKnown = structures.reduce((acc, structure) => {
      return acc && names[structure.id] !== undefined;
    }, true);

    if (allNamesAlreadyKnown) {
      callback(structures.map(addNames));

    } else {
      let client = nest.restApiClient(token);
      client.read('/structures', (error, result) => {
        if (error) {
          logger('ERROR', `Could not reach Nest server. ${error.message}`);
        } else if (!result.success) {
          let reply = result.response.code;
          logger('ERROR', `Failed to retrieve names. Nest replied ${reply}`);
        } else {
          logger('INFO', 'Successfully retrieved structures from Nest')
          for (retrievedStructure in result.data) {
            names[retrievedStructure] = result.data[retrievedStructure].name;
          }
        }
        callback(structures.map(addNames));
      });
    }
  });
}

function addNames(structure) {
  structure.name = names[structure.id] || 'name not available';
  return structure;
}
