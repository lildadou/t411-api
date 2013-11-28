var pkg     = require('./t411-api');
var client  = new pkg.ApiClient();
module.exports  =   client;

client.ApiClient    = pkg.ApiClient;
client.SearchOptions= pkg.SearchOptions;