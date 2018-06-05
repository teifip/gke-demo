const apiClient = require('gcp-api-client');

const GS_BUCKET = process.env.COLLECTOR_GS_BUCKET;
const KMS_KEYRING = process.env.COLLECTOR_KMS_KEYRING;
const KMS_KEY = process.env.COLLECTOR_KMS_KEY;

const GS_OBJECT = 'token';

exports.retrieve = function(callback) {
  let gsClient = apiClient();
  let gsPath = `/storage/v1/b/${GS_BUCKET}/o/${GS_OBJECT}`;

  gsClient.get(gsPath, { query: { alt: 'media' } }, (error, response) => {
    if (error && error.response.statusCode === 404) return callback(null, null);
    if (error) return callback(error);

    let kmsClient = apiClient({ baseUrl: 'https://cloudkms.googleapis.com' });
    let kmsPath = '/v1/projects/{{projectId}}/locations/global' +
                  `/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}:decrypt`;
    let kmsData = { json: { ciphertext: response.encrypted_token } };

    kmsClient.post(kmsPath, kmsData, (error, response) => {
      if (error) return callback(error);

      callback(null, Buffer.from(response.plaintext, 'base64').toString());
    });
  });
}

exports.save = function(token, callback) {
  let kmsClient = apiClient({ baseUrl: 'https://cloudkms.googleapis.com' });
  let kmsPath = '/v1/projects/{{projectId}}/locations/global' +
                `/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}:encrypt`;
  let kmsData = { json: { plaintext: Buffer.from(token).toString('base64') } };

  kmsClient.post(kmsPath, kmsData, (error, response) => {
    if (error) return callback(error);

    let gsClient = apiClient();
    let gsPath = `/upload/storage/v1/b/${GS_BUCKET}/o`;
    let gsData = {
      query: { uploadType: 'media', name: GS_OBJECT },
      json: { encrypted_token: response.ciphertext }
    };

    gsClient.post(gsPath, gsData, (error, response) => {
      callback(error);
    });
  });
}

exports.delete = function(callback) {
  let gsClient = apiClient();
  let gsPath = `/storage/v1/b/${GS_BUCKET}/o/${GS_OBJECT}`;

  gsClient.delete(gsPath, (error, result) => {
    callback(error);
  });
}
