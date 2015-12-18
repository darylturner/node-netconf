var netconf = require('./netconf');
var util = require('util');

var router = new netconf.Client('192.168.56.101', 22, 'daryl', 'Juniper');
router.open(function afterOpen(err) {
    if (!err) {
        router.rpc('get-configuration', null, processResults); 
    } else {
        throw err;
    }
});

function processResults(err, reply) {
    var config = reply.rpc_reply.configuration.security;
    console.log(util.inspect(config, {depth:null, colors: true}));
    router.close();
}
