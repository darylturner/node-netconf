var ssh = require('ssh2');
var xml2js = require('xml2js');
var vasync = require('vasync');

var DELIM = ']]>]]>';
var RPC_REPLY = /(<rpc\-reply.*message\-id="(\d*)"[\s\S]*<\/rpc\-reply\>)\n\]\]\>\]\]\>/;

function objectHelper(name) {
    // Replaces characters that prevent dot-style object navigation.
    return name.replace(/-|:/g, '_');
}

function Client(params) {
    this.host = params.host;
    this.username = params.username;
    this.port = params.port || 22;
    this.password = params.password;
    this.pkey = params.pkey;

    this.connected = false;
    this.sessionID = null;
    this.remoteCapabilities = [];
    this.idCounter = 100;
}
Client.prototype = {
    // Message and transport functions.
    // Operation functions defined below as wrappers to rpc function.
    rpc: function (request, callback) {
        var messageID = this.idCounter;
        this.idCounter += 1;
        var object = { };
        if (typeof (request) === 'string') {
            object.rpc = {
                $: { 'message-id': messageID },
                [request]: null
            };
        } else if (typeof (request) === 'object') {
            object.rpc = request;
            object.rpc.$ = { 'message-id': messageID };
        }
        var builder = new xml2js.Builder();
        var xml = builder.buildObject(object) + '\n' + DELIM;
        this.send(xml, messageID, callback);
    },
    send: function (xml, messageID, callback) {
        var self = this;
        this.netconf.write(xml, function startReplyHandler() {
            var rcvBuffer = '';
            self.netconf.on('data', function replyHandler(chunk) {
                rcvBuffer += chunk;
                if (rcvBuffer.search(RPC_REPLY) !== -1) {
                    var message = rcvBuffer.match(RPC_REPLY);
                    if (parseInt(message[2]) === messageID) {
                        self.parse(message[1], callback);
                        self.netconf.removeListener('data', replyHandler);
                    } else {
                        // Not our reply. Correct replyHandler should callback
                        // and we can discard this message.
                        rcvBuffer = rcvBuffer.replace(message[0], '');
                    }
                }
            });
        });
    },
    parse: function (xml, callback) {
        var parseOpts = {
            trim: true,
            explicitArray: false,
            tagNameProcessors: [ objectHelper ],
            attrNameProcessors: [ objectHelper ],
            valueProcessors: [ xml2js.processors.parseNumbers ],
            attrValueProcessors: [ xml2js.processors.parseNumbers ]
        };
        xml2js.parseString(xml, parseOpts, function checkRPCErrors(err, message) {
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
    open: function (callback) {
        var self = this;
        this.sshConn = ssh.Client();
        this.sshConn.on('ready', function invokeNETCONF() {
            vasync.waterfall([
                function getStream(next) {
                    self.sshConn.subsys('netconf', next);
                },
                function handleStream(stream, next) {
                    self.netconf = stream;
                    self.sendHello();
                    var rcvBuffer = '';
                    stream.on('data', function handleHello(chunk) {
                        rcvBuffer += chunk;
                        if (rcvBuffer.match(DELIM)) {
                            var helloMessage = rcvBuffer.replace(DELIM, '');
                            self.netconf.removeListener('data', handleHello);
                            next(null, helloMessage);
                        }
                    }).on('error', function streamErr(err) {
                        self.sshConn.end();
                        self.connected = false;
                        throw (err);
                    }).on('close', function handleClose() {
                        self.sshConn.end();
                        self.connected = false;
                    });
                },
                function parseHello(rcvBuffer, next) {
                    self.parse(rcvBuffer, function assignSession(err, message) {
                        if (err) {
                            return next(err);
                        }
                        if (message.hello.session_id > 0) {
                            self.remoteCapabilities = message.hello.capabilities.capability;
                            self.sessionID = message.hello.session_id;
                            self.connected = true;
                            next(null);
                        } else {
                            next(new Error('NETCONF session not established'));
                        }
                    });
                }
            ],
            function (err) {
                if (err) {
                    return callback(err);
                }
                return callback(null);
            });
        }).on('error', function (err) {
            self.connected = false;
            throw (err);
        }).connect({
            host: this.host,
            username: this.username,
            password: this.password,
            port: this.port,
            privateKey: this.pkey
        });
    },
    sendHello: function () {
        var message = {
            hello: {
                capabilities: {
                    capability: [ 'urn:ietf:params:xml:ns:netconf:base:1.0' ]
                }
            }
        };
        var builder = new xml2js.Builder();
        var xml = builder.buildObject(message) + '\n' + DELIM;
        this.netconf.write(xml);
    }
};

// Operation layer.
// Wrappers around RPC calls.
Client.prototype.close = function (callback) {
    this.rpc('close-session', function closeSocket(err, reply) {
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
Client.prototype.load = function (args, callback) {
    var loadOpts = {};
    if (typeof (args) === 'string') { // Backwards compatible with 0.1.0
        loadOpts = { config: args, action: 'merge', format: 'text' };
    } else if (typeof (args) === 'object') {
        loadOpts = {
            config: args.config,
            action: args.action || 'merge',
            format: args.format || 'text'
        };
    }

    if (typeof (loadOpts.config) === 'undefined') {
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

    var rpcLoad = {
        'load-configuration': {
            $: { action: loadOpts.action, format: loadOpts.format },
            [configTag]: loadOpts.config
        }
    };
    this.rpc(rpcLoad, function checkErrors(err, reply) {
         if (err) {
             return callback(err, reply);
         }
         // Load errors aren't found in the top-level reply
         // so need to check seperately.
         var rpcError = reply.rpc_reply.load_configuration_results.hasOwnProperty('rpc_error');
         if (rpcError) {
             return callback(new Error('RPC error'), reply);
         }
         return callback(null, reply);
     });
};
Client.prototype.commit = function (callback) {
    this.rpc('commit-configuration', callback);
};
Client.prototype.compare = function (callback) {
    var rpcCompare = {
        'get-configuration': {
            $: { compare: 'rollback', format: 'text' }
        }
    };
    this.rpc(rpcCompare, function parseDiff(err, reply) {
        if (err) {
            return callback(err, reply);
        }
        var text = reply.rpc_reply.configuration_information.configuration_output;
        return callback(null, text);
    });
};
Client.prototype.rollback = function (callback) {
    this.rpc('discard-changes', callback);
};

module.exports.Client = Client;
