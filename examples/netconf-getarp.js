var netconf = require('../lib/netconf');
var util = require('util');
var fs = require('fs');

function pprint(object) {
    console.log(util.inspect(object, {depth:null, colors:true}));
}

var params = {
    host: '172.28.128.4',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
};
var router = new netconf.Client(params);

router.open(function afterOpen(err) {
    if (!err) {
        // router.rpc('get-arp-table-info', null, processResults);
        router.rpc('get-arp-table-information', null, processResults);
    } else {
        throw err;
    }
});

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
