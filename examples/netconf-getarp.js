var netconf = require('../netconf');
var util = require('util');
var fs = require('fs');

var params = {
    host: '172.28.128.4',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
};
var router = new netconf.Client(params);

router.open(function afterOpen(err) {
    if (!err) {
        router.rpc('get-arp-table-information', null, processResults); 
    } else {
        throw err;
    }
});

function processResults(err, reply) {
    var arpInfo = reply.rpc_reply.arp_table_information.arp_table_entry;
    console.log(util.inspect(arpInfo, {depth:null, colors: true}));
    router.close();
}
