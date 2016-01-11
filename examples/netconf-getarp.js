var netconf = require('../lib/netconf');
var util = require('util');
var fs = require('fs');

function pprint(object) {
    console.log(util.inspect(object, {depth:null, colors:true}));
}

function processResults(err, reply) {
    if (err) {
        pprint(reply);
        throw err;
    } else {
        var arpInfo = reply.rpc_reply.arp_table_information.arp_table_entry;
        console.log(JSON.stringify(arpInfo));
        router.close();
    }
}

var router = new netconf.Client({
    host: '172.28.128.3',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
});

router.open(function afterOpen(err) {
    if (!err) {
        // console.log(router.remoteCapabilities);
        // console.log(router.sessionID);
        router.rpc('get-arp-table-information', processResults);
    } else {
        throw err;
    }
});
