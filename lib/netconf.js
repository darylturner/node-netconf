var ssh = require('ssh2');
var xml2js = require('xml2js');
var vasync = require('vasync');

var DELIM = ']]>]]>';
var RPC_REPLY_START = '(<rpc-reply.*message-id="';
var RPC_REPLY_END = '"[\\s\\S]*<\\/rpc-reply>)\\n]]>]]>\\s*';

function objectHelper(name) {
    // Replaces characters that prevent dot-style object navigation.
    return name.replace(/-|:/g, '_');
}

function Client(params) {
    // Constructor paramaters
    this.host = params.host;
    this.username = params.username;
    this.port = params.port || 22;
    this.password = params.password;
    this.pkey = params.pkey;

    // Debug and informational
    this.connected = false;
    this.sessionID = null;
    this.remoteCapabilities = [ ];
    this.idCounter = 100;
    this.rcvBuffer = '';

    // Runtime option tweaks
    this.raw = false;
    this.parseOpts = {
        trim: true,
        explicitArray: false,
        emptyTag: true,
        ignoreAttrs: false,
        tagNameProcessors: [ objectHelper ],
        attrNameProcessors: [ objectHelper ],
        valueProcessors: [ xml2js.processors.parseNumbers ],
        attrValueProcessors: [ xml2js.processors.parseNumbers ]
    };
}
Client.prototype = {
    // Message and transport functions.
    // Operation functions defined below as wrappers to rpc function.
    rpc: function (request, callback) {
        var messageID = this.idCounter += 1;

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
        var xml;
        try {
            xml = builder.buildObject(object) + '\n' + DELIM;
        } catch (err) {
            return callback(err);
        }
        this.send(xml, messageID, callback);
    },
    send: function (xml, messageID, callback) {
        var self = this;
        this.netconf.write(xml, function startReplyHandler() {
            var rpcReply = new RegExp(RPC_REPLY_START + messageID + RPC_REPLY_END);
            // Add an event handler to search for our message on data events.
            self.netconf.on('data', function replyHandler() {
                var replyFound = self.rcvBuffer.search(rpcReply) !== -1;
                if (replyFound) {
                    var message = self.rcvBuffer.match(rpcReply);
                    self.parse(message[1], callback);
                    // Tidy up, remove matched message from buffer and
                    // remove this messages replyHandler.
                    self.rcvBuffer = self.rcvBuffer.replace(message[0], '');
                    self.netconf.removeListener('data', replyHandler);
                }
            });
        });
    },
    parse: function (xml, callback) {
        var self = this;
        xml2js.parseString(xml, this.parseOpts, function checkRPCErrors(err, message) {
            if (err) {
                return callback(err, null);
            }
            if (message.hasOwnProperty('hello')) {
                return callback(null, message);
            }
            if (self.raw) {
                message.raw = xml;
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
                    stream.on('data', function buffer(chunk) {
                        self.rcvBuffer += chunk;
                    }).on('error', function streamErr(err) {
                        self.sshConn.end();
                        self.connected = false;
                        throw (err);
                    }).on('close', function handleClose() {
                        self.sshConn.end();
                        self.connected = false;
                    }).on('data', function handleHello() {
                        if (self.rcvBuffer.match(DELIM)) {
                            var helloMessage = self.rcvBuffer.replace(DELIM, '');
                            self.rcvBuffer = '';
                            self.netconf.removeListener('data', handleHello);
                            next(null, helloMessage);
                        }
                    });
                },
                function parseHello(helloMessage, next) {
                    self.parse(helloMessage, function assignSession(err, message) {
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
                $: { xmlns: 'urn:ietf:params:xml:ns:netconf:base:1.0' },
                capabilities: {
                    capability: 'urn:ietf:params:xml:ns:netconf:base:1.0'
                }
            }
        };
        var builder = new xml2js.Builder();
        var xml = builder.buildObject(message) + '\n' + DELIM;
        this.netconf.write(xml);
    }
};

// Operation layer. Wrappers around RPC calls.
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
    var loadOpts = { };
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
         // Load errors aren't found in the top-level reply so need to check seperately.
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
Client.prototype.facts = function (callback) {
    var self = this;
    vasync.parallel({
        funcs: [
            function getSoftwareInfo(callback) {
                self.rpc('get-software-information', callback);
            },
            function getRE(callback) {
                self.rpc('get-route-engine-information', callback);
            },
            function getChassis(callback) {
                self.rpc('get-chassis-inventory', callback);
            }
        ]
    }, function compileResults(err, results) {
        if (err) {
            return callback(err, null);
        }
        var softwareInfo = results.operations[0].result.rpc_reply.software_information;
        var reInfo = results.operations[1].result.rpc_reply.route_engine_information.route_engine;
        var chassisInfo = results.operations[2].result.rpc_reply.chassis_inventory.chassis;
        var facts = {
            hostname: softwareInfo.host_name,
            version: softwareInfo.package_information,
            model: softwareInfo.product_model,
            uptime: reInfo.up_time,
            serial: chassisInfo.serial_number
        };
        return callback(null, facts);
    });
};

module.exports.Client = Client;
