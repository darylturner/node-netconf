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
router.parseOpts.ignoreAttrs = true;

router.open(function afterOpen(err) {
    if (!err) {
        router.facts(function (err, facts) {
            router.close();
            if (err) { throw (err); }
            pprint(facts);
        });
    } else {
        throw err;
    }
});
