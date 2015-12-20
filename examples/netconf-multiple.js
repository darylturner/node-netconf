var netconf = require('../netconf');
var util = require('util');
var process = require('process');

// example of multiple async requests
var results = 0;

var router = new netconf.Client('192.168.56.101', 22, 'daryl', 'Juniper');
router.open(function afterOpen(err) {
    if (!err) {
        console.log('request 1');
        router.rpc('get-configuration', null, processResults); 
        console.log('request 2');
        router.rpc('get-arp-table-information', null, processResults);
    } else {
        throw err;
    }
});

function processResults(err, reply) {
    console.log(util.inspect(reply, {depth:null, colors: true}));
    results += 1;
    if (results === 2) {
        router.close();
        process.exit(1);
    }
}
