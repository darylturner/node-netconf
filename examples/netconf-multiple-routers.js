var netconf = require('../lib/netconf');
var util = require('util');
var fs = require('fs');

function pprint(object) {
    console.log(util.inspect(object, {depth:null, colors: true}));
}

var param1 = {
    host: '172.28.128.4',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
};
var param2 = {
    host: '172.28.128.3',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
};
var router1 = new netconf.Client(param1);
var router2 = new netconf.Client(param2);

var routers = [ router1, router2 ];

var rpcGet = {
    'get-config': {
        source: { running: null },
        filter: { configuration: { system: { 'host-name': null } } }
    }
}

routers.forEach(function (router) {
    router.open(function (err) {
        if (!err) {
            router.rpc(rpcGet, function(err, reply) {
                var hostname = reply.rpc_reply.data.configuration.system.host_name;
                router.rpc('get-route-information', function(err, reply) {
                    console.log(`------------ ${hostname} -------------`);
                    pprint(reply);
                    router.close();
                });
            });
        } else {
            throw(err);
        }
    });
});
