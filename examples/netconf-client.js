#!/opt/pkg/bin/node
var fs = require('fs');
var process = require('process');
var netconf = require('../lib/netconf');
var pipeline = require('./pipeline');
var util = require('util');

function pprint(object) {
    console.log(util.inspect(object, {depth:null, colors:true}));
}

function configureRouter(configData) {
    router.open(function(err) {
        if (!err) {
            router.load({config: configData, action: 'replace', format: 'text'},
                         commitConf);
        } else {
            throw(err);
        }
    });
}

function commitConf(err, reply) {
    if (!err) {
        router.compare(function(err, reply) {
            console.log('Configuration Diff:');
            console.log(reply);
            if (process.argv[2] === '-c') {
                commitRollback(true);
            } else {
                commitRollback(false);
            }
        });
    } else {
        pprint(reply);
        throw (err);
    }
}

function commitRollback(value) {
    if (value === true) {
        console.log('Commiting configuration.');
        router.commit(function(err, result) {
           if (result.rpc_reply.commit_results.routing_engine.rpc_error) {
               router.rollback(function (err, rollback_result) {
                   pprint(result);
                   console.log('Commit error, rolling back.')
                   router.close();
                   process.exit(1);
               });
           } else {
               router.close();
           }
        });
    } else {
        console.log('Rolling back changes. Run with "-c" flag to commit.');
        router.rollback(function(err, result) {
            router.close();
        });
    }
}


var params = {
    host: '172.28.128.3',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
};
var router = new netconf.Client(params);

pipeline.read(function renderTemplate(err, data) {
    if (err) {
       throw (err);
    } else {
        configureRouter(data);
    }
});
