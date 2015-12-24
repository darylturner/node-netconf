#!/opt/pkg/bin/node
var fs = require('fs');
var process = require('process');
var netconf = require('../netconf');
var pipeline = require('./pipeline');

function configureRouter(config) {
    router.open(function(err) {
        if (!err) {
            router.load(config, commitConf);
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
            if (process.argv[2] === '-n') {
                commitRollback(false);
            } else {
                commitRollback(true);
            }
        });
    } else {
        throw(err);
    }
}

function commitRollback(value) {
    if (value === true) {
        console.log('Commiting configuration');
        router.commit(function(err, result) {
           router.close();
        });
    } else { 
        console.log('Rolling back changes');
        router.rollback(function(err, result) {
            router.close();
        });
    }
}


var params = {
    host: '172.28.128.4',
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
