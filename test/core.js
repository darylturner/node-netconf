var netconf = require('../lib/netconf');
var fs = require('fs');
var assert = require('assert');

var testServ = {
    host: '172.28.128.3',
    username: 'vagrant',
    pkey: fs.readFileSync('../examples/insecure_ssh.key', { encoding: 'utf8' })
};
var client;

describe('core functions', function () {
    // before(function vagrantStart() { ... });
    before(function openConnection(done) {
        client = new netconf.Client(testServ);
        client.open(done);
    });
    it('should establish connection to server', function () {
        assert.ok(client.connected);
    });
    it('should receive remote capabilities', function () {
        assert.ok(client.remoteCapabilities.length);
    });
    it('should be assigned a session id', function () {
        assert.ok(client.sessionID > 0);
    });
    it('should be able to send and receive rpc messages');
    it('should be able to send and receive simultaneous rpc messages');
    it('should close connection gracefully', function (done) {
        client.close(function (err, reply) {
            if (err) {
                throw err;
            }
            return done();
        });
    });
    // after(function vagrantStop() { ... });
});
