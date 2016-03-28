var netconf = require('../lib/netconf');
var fs = require('fs');

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
            console.log(JSON.stringify(facts));
        });
    } else { throw err; }
});
