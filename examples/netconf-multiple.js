var netconf = require('../lib/netconf');
var util = require('util');
var fs = require('fs');

// example of multiple async requests
var results = 0;

var params = {
    host: '172.28.128.3',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
};
var router = new netconf.Client(params);

router.open(function afterOpen(err) {
    if (!err) {
        console.log('request 1');
        router.rpc('get-configuration', processResults);
        console.log('request 2');
        router.rpc('get-arp-table-information', processResults);
    } else {
        throw err;
    }
});

function processResults(err, reply) {
    console.log(util.inspect(reply, {depth:null, colors: true}));
    results += 1;
    if (results === 2) {
        router.close();
    }
}
