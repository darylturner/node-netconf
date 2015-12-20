var netconf = require('../netconf');
var util = require('util');
var process = require('process');
var fs = require('fs');

// example of multiple async requests
var results = 0;

var params = {
    host: '192.168.56.101',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
};
var router = new netconf.Client(params);

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
