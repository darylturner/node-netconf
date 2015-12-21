var ssh = require('ssh2');
var parseXML = require('xml2js').parseString;
var Builder = require('xml2js').Builder;

var delim = ']]>]]>';
var message_re = /(<rpc\-reply.*message\-id="(\d*)"[\s\S]*<\/rpc\-reply\>)\n\]\]\>\]\]\>/;

function objectHelper(name) {
    // replaces characters that prevent dot-style object navigation.
    return name.replace(/-|:/g, '_');
}

function Client(params) {
    this.host = params.host;
    this.username = params.username;
    this.port = params.port || 22;
    this.password = params.password;
    this.pkey = params.pkey;

    this.connected = false;
    this.session_id = null;
    this.remote_capabilities = [];
    this.id_counter = 100;
    this.clientbuffer = '';
}
Client.prototype = {
    rpc: function(request, args, callback) {
        var message_id = this.id_counter += 1;
        var object = {
            'rpc': {
                '$': {'message-id': message_id},
                [request] : args
            }
        };
        var builder = new Builder();
        var xml = builder.buildObject(object) + '\n' + delim;
        this.send(xml, message_id, callback);
    },
    send: function(xml, message_id, callback) {
        var self = this;
        this.netconf.write(xml, function startListening() {
            var rcvbuffer = '';
            self.netconf.on('data', function manageBuffer(chunk) {
                rcvbuffer += chunk;
                if (rcvbuffer.search(message_re) !== -1) {
                    var message = rcvbuffer.match(message_re);
                    if (parseInt(message[2]) === message_id) {
                        self.parse(message[1], callback);
                        self.netconf.removeListener('data', manageBuffer);
                    } else {
                        rcvbuffer = rcvbuffer.replace(message_re, '');
                    }
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
        var xml = response.replace(delim, '');
        parseXML(xml, {
            trim: true,
            explicitArray: false,
            tagNameProcessors: [objectHelper],
            attrNameProcessors: [objectHelper]},
            callback);
    },
    open: function(callback) {
        var self = this;
        this.sshConn = ssh.Client();
        this.sshConn.on('ready', function() {
            self.sshConn.subsys('netconf', function(err, stream) {
                if (!err) {
                    self.netconf = stream;
                    stream.on('data', function handleHello(chunk) {
                        self.clientbuffer += chunk;
                        if (self.clientbuffer.match(delim)) {
                            self.parse(self.clientbuffer, function(err, message) {
                                if (!err) {
                                    self.remote_capabilities = message.hello.capabilities.capability;
                                    self.session_id = message.hello.session_id;
                                    self.connected = true;
                                    callback();
                                } else {
                                    throw(err);
                                }
                            });
                            self.clientbuffer = '';
                            stream.removeListener('data', handleHello);
                        }
                    }).on('error', function(err) {
                        self.close();
                        throw(err);
                    });
                    self.hello();
                }
            });
        }).connect({
            host: this.host,
            username: this.username,
            password: this.password,
            port: this.port,
            privateKey: this.pkey
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
Client.prototype.compare = function(callback) {
    this.rpc('get-configuration compare="rollback" format="text"',
              null,
              function(err, reply) {
                  var text = reply.rpc_reply.configuration_information.configuration_output;
                  callback(null, text);
              });
};
Client.prototype.rollback = function(callback) {
    this.rpc('discard-changes', null, callback);
};

module.exports.Client = Client;
