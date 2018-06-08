const logger = require('./logger.js');
const apiClient = require('accept-json');

const SESSION_DURATION = 7200; // 2 hours
const GOOGLE_APIS_URL = 'https://www.googleapis.com';

const client = apiClient(GOOGLE_APIS_URL, { timeout: 4000 });
const users = process.env.WEBGUI_LOGIN_AUTHORIZED_USERS || '';
const authorizedUsers = users.split(',').map(a => a.toLowerCase().trim());

exports.exchangeIdTokenForCookie = function(req, callback) {
  let options = { query: { id_token: req.body.id_token }};
  client.get('/oauth2/v3/tokeninfo', options, (error, result) => {
    if (error) {
      let msg = 'Could not reach Id token instrospection endpoint';
      logger('ERROR', `${msg}. ${error.message}`);
      callback(null);

    } else if (result.code !== 200) {
      logger('ERROR', `Id token introspection endpoint replied ${result.code}`);
      callback(null);

    } else if (result.body.aud !== process.env.WEBGUI_LOGIN_CLIENT_ID) {
      logger('WARN', `ClientId mismatch in Id token`);
      callback(null);

    } else if (!/^(https:\/\/)?accounts.google.com$/.test(result.body.iss)) {
      logger('WARN', 'Invalid issuer in Id token');
      callback(null);

    } else if (result.body.exp * 1000 < Date.now()) {
      logger('WARN', ` Expired Id token`);
      callback(null);

    } else if (!authorizedUsers.includes(result.body.email)) {
      logger('INFO', `Login attempt by unauthorized user ${result.body.email}`);
      callback(null);

    } else {
      let exp = (Date.now() / 1000 + SESSION_DURATION).toFixed();
      let buf = Buffer.from(`${exp}&&${req.ip}`);
      let token = buf.toString('base64')
                     .replace(/\+/g, '-')
                     .replace(/\//g, '_')
                     .replace(/=/g, '');
      callback(token);
    }
  });
}

exports.requestHasValidCookie = function(req) {
  if (!req.signedCookies || !req.signedCookies.token) return false;

  let token = Buffer.from(req.signedCookies.token, 'base64').toString();
  let parts = token.split('&&');

  if (parts[0] * 1000 > Date.now() && parts[1] === req.ip) return true;

  return false;
}
