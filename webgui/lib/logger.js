module.exports = function(severity, message) {
  // Just write to Stackdriver Logging
  console.log(JSON.stringify({ severity: severity, message: message }));
}
