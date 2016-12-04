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
    it('should be able to send and receive rpc messages', function (done) {
        client.rpc('get-software-information', function (err, reply) {
            if (err) return done(err);
            var platform = reply.rpc_reply.software_information.package_information.name;
            return done(assert.ok(platform === 'junos'));
        });
    });
    it('should be able to send and receive simultaneous rpc messages', function(done) {
        var interfaces = [ 'ge-0/0/0', 'ge-0/0/1' ];
        var results = 0;
        interfaces.forEach(function (int) {
            client.rpc({ 'get-interface-information': { 'interface-name': [ int ], 'media': null } },
                function (err, reply) {
                    if (err) return done(err);
                    results += 1;
                    try {
                        var returnedInt = reply.rpc_reply.interface_information.physical_interface.name;
                        assert.ok(returnedInt === int);
                    } catch (e) {
                        return done(e);
                    }
                    if (results === interfaces.length) {
                        done();
                    }
                }
            );
        });
    });
    it('should raise a rpcError for bad RPC methods', function (done) {
        client.rpc('get-foobarbaz', (err, reply) => {
            assert.ok(!reply, 'reply should be empty');
            if (err) {
                assert.ok(err.name === 'rpcError', err);
            } else {
                 return done(Error('rpcError not found on bad method'));
            }
            return done();
        });
    });
    after(function closeConnection(done) {
        client.close(done);
    });
    // after(function vagrantStop() { ... });
});
