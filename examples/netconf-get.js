var netconf = require('../lib/netconf');
var util = require('util');
var fs = require('fs');

function pprint(object) {
    console.log(util.inspect(object, {depth:null, colors:true}));
}

var router = new netconf.Client({
    host: '172.28.128.3',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
});
router.parseOpts.ignoreAttrs = false;
router.raw = true;

router.open(function afterOpen(err) {
    if (!err) {
        router.rpc({ 'get-config': { source: { running: null } } }, function (err, results) {
            router.close();
            if (err) {
                pprint(results);
                throw (err);
            }
            // pprint(results);
            console.log(results.raw);
        });
    } else {
        throw err;
    }
});
