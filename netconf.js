var ssh = require('ssh2');
var parseXML = require('xml2js').parseString;
var Builder = require('xml2js').Builder;

var delim = ']]>]]>';

function Client(host, port, username, password) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;

    this.connected = false;
    this.message_id = 100;
    this.rcvbuffer = '';
}
Client.prototype = {
    rpc: function(request, args, callback) {
        var object = {
            'rpc': {
                '$': {'message-id': this.message_id},
                [request] : args
            }
        };
        var builder = new Builder();
        var xml = builder.buildObject(object) + '\n' + delim;
        this.message_id += 1;
        this.send(xml, callback);
    },
    send: function(xml, callback) {
        var self = this;
        this.netconf.write(xml, function startHandler() {
            self.netconf.on('data', function handleReply(chunk) {
                self.rcvbuffer += chunk;
                if (self.rcvbuffer.match(delim)) {
                    self.parse(self.rcvbuffer, callback);
                    self.rcvbuffer = '';
                    self.netconf.removeListener('data', handleReply);
                }
            });
        });
    },
    hello: function() {
        var message = {
            hello: {
                capabilities: {
                    capability: [ "urn:ietf:params:xml:ns:netconf:base:1.0" ]
                }
            }
        };
        var builder = new Builder();
        var xml = builder.buildObject(message) + '\n' + delim;
        this.netconf.write(xml);
    },
    parse: function(response, callback) {
        var xml = response.replace(delim, '').replace(/\-/g, '_');
        parseXML(xml, {trim: true, explicitArray: false}, callback);
    },
    open: function(callback) {
        var self = this;
        this.sshConn = ssh.Client();
        this.sshConn.on('ready', function() {
            self.sshConn.subsys('netconf', function(err, stream) {
                if (!err) {
                    self.netconf = stream;
                    stream.on('data', function handleHello(chunk) {
                        self.rcvbuffer += chunk;
                        if (self.rcvbuffer.match(delim)) {
                            self.parse(self.rcvbuffer, callback);
                            self.rcvbuffer = '';
                            stream.removeListener('data', handleHello);
                        }
                    }).on('error', function(err) {
                        throw err;
                    });
                    self.hello();
                }
            });
        }).connect({
            host: this.host,
            username: this.username,
            password: this.password
        });
    },
    close: function() {
        this.sshConn.end();
    }
};

// Utility functions.
// Wrappers around RPC calls.
Client.prototype.load = function(config, callback) {
    this.rpc('load-configuration action="merge" format="text"', {'configuration-text': config}, callback);              
};
Client.prototype.commit = function(callback) {
    this.rpc('commit-configuration', null, callback);              
};

module.exports.Client = Client;
