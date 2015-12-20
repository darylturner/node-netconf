var netconf = require('../netconf');
var util = require('util');

var router = new netconf.Client('192.168.56.101', 22, 'daryl', 'Juniper');
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
