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
    // Message and transport functions.
    // Operation functions defined below as
    // wrappers to rpc function.
    rpc: function(request, args, callback) {
        var message_id = this.id_counter += 1;
        var object = {
            rpc: {
                '$': {'message-id': message_id},
                [request]: args
            }
        };
        var builder = new Builder();
        var xml = builder.buildObject(object) + '\n' + delim;
        this.send(xml, message_id, callback);
    },
    send: function(xml, message_id, callback) {
        var self = this;
        this.netconf.write(xml, function startReplyHandler() {
            var rcvbuffer = '';
            self.netconf.on('data', function replyHandler(chunk) {
                rcvbuffer += chunk;
                if (rcvbuffer.search(message_re) !== -1) {
                    var message = rcvbuffer.match(message_re);
                    if (parseInt(message[2]) === message_id) {
                        self.parse(message[1], callback);
                        self.netconf.removeListener('data', replyHandler);
                    } else {
                        // this is not the message you are looking for...
                        rcvbuffer = rcvbuffer.replace(message_re, '');
                    }
                }
            });
        });
    },
    hello: function() {
        var message = {
            hello: {
                capabilities: { capability: [ "urn:ietf:params:xml:ns:netconf:base:1.0" ] }
            }
        };
        var builder = new Builder();
        var xml = builder.buildObject(message) + '\n' + delim;
        this.netconf.write(xml);
    },
    parse: function(response, callback) {
        var xml = response.replace(delim, '');
        var parseOpts = {
            trim: true,
            explicitArray: false,
            tagNameProcessors: [objectHelper],
            attrNameProcessors: [objectHelper]
        };
        parseXML(xml, parseOpts, function checkRPCErrors(err, message) {
            if (err) {
                return callback(err, null);
            }
            if (message.hasOwnProperty('hello')) {
                return callback(null, message);
            }
            if (message.rpc_reply.hasOwnProperty('rpc_error')) {
                return callback(new Error('RPC error'), message);
            }
            return callback(null, message);
        });
    },
    open: function(callback) {
        var self = this;
        this.sshConn = ssh.Client();
        this.sshConn.on('ready', function invokeNETCONF() {
            self.sshConn.subsys('netconf', function exchangeHellos(err, stream) {
                if (err) {
                    return callback(err, null);
                }
                self.netconf = stream;
                stream.on('data', function handleHello(chunk) {
                    self.clientbuffer += chunk;
                    if (self.clientbuffer.match(delim)) {
                        self.parse(self.clientbuffer, function completeExchange(err, message) {
                            if (!err) {
                                if (message.hello.session_id > 0) {
                                    self.remote_capabilities = message.hello.capabilities.capability;
                                    self.session_id = message.hello.session_id;
                                    self.connected = true;
                                    callback(null);
                                } else {
                                    callback(new Error('NETCONF session not established'));
                                }
                            } else {
                                callback(err);
                            }
                        });
                        self.clientbuffer = '';
                        stream.removeListener('data', handleHello);
                    }
                }).on('error', function streamErr(err) {
                    self.sshConn.end();
                    self.connected = false;
                    throw (err);
                }).on('close', function handleClose() {
                    self.sshConn.end();
                    self.connected = false;
                });
                self.hello();
            });
        }).connect({
            host: this.host,
            username: this.username,
            password: this.password,
            port: this.port,
            privateKey: this.pkey
        });
    }
};

// Operation layer.
// Wrappers around RPC calls.
Client.prototype.close = function(callback) {
    this.rpc('close-session', null, function closeSocket(err, reply) {
        if (!callback) {
            return;
        }
        if (err) {
            return callback(err, reply);
        }
        return callback(null, reply);
    });
};

// Juniper specific operations.
Client.prototype.load = function(args, callback) {
    var loadOpts = {};
    if (typeof(args) === 'string') { //backwards compatible with 0.1.0
        loadOpts = {
            config: args,
            action: 'merge',
            format: 'text'
        };
    } else if (typeof(args === 'object')) {
        loadOpts = {
            config: args.config,
            action: args.action || 'merge',
            format: args.format || 'text'
        };
    }

    if (typeof(loadOpts.config) === 'undefined') {
        return callback(new Error('configuraton undefined'), null);
    }

    var configTag;
    if (loadOpts.action === 'set') {
        configTag = 'configuration-set';
    } else if (loadOpts.format === 'xml') {
        configTag = 'configuration';
    } else {
        configTag = 'configuration-text';
    }

    var rpcOpts = {
        '$': { action: loadOpts.action, format: loadOpts.format },
        [configTag]: loadOpts.config
    };
    this.rpc('load-configuration', rpcOpts, function checkLoadErrors(err, reply) {
         if (err) {
             return callback(err, reply);
         }
         // load errors aren't found in the top-level reply so need to check seperately.
         var rpc_error = reply.rpc_reply.load_configuration_results.hasOwnProperty('rpc_error');
         if (rpc_error) {
             return callback(new Error('RPC error'), reply);
         }
         return callback(null, reply);
     });
};
Client.prototype.commit = function(callback) {
    this.rpc('commit-configuration', null, callback);
};
Client.prototype.compare = function(callback) {
    var rpcOpts = { '$': { compare: 'rollback', format: 'text' } };
    this.rpc('get-configuration', rpcOpts, function parseDiff(err, reply) {
        if (err) {
            return callback(err, reply);
        }
        var text = reply.rpc_reply.configuration_information.configuration_output;
        return callback(null, text);
    });
};
Client.prototype.rollback = function(callback) {
    this.rpc('discard-changes', null, callback);
};

module.exports.Client = Client;
