const ssh = require('ssh2'),
    xml2js = require('xml2js'),
    vasync = require('vasync'),
    EventEmitter = require('events');


const DELIM = ']]>]]>';

/**
 * netconf Client handles xml interactions across the ssh session
 * @class Client
 * @extends EventEmitter
 */
class Client extends EventEmitter {
    /**
     *
     * @param {Object} params Configuration object for netconf
     */
    constructor(params) {
        super();

        // bind functions to self
        this.rpc = this.rpc.bind(this);
        this._send = this._send.bind(this);
        this._parse = this._parse.bind(this);
        this._sendHello = this._sendHello.bind(this);
        this._createError = this._createError.bind(this);
        this._objectHelper = this._objectHelper.bind(this);
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);

        // Constructor paramaters
        this.host = params.host;
        this.username = params.username;
        this.port = params.port || 22;
        this.password = params.password;
        this.pkey = params.pkey;

        // Debug and informational
        this.connected = false;
        this.sessionID = null;
        this.remoteCapabilities = [];
        this.idCounter = 100;
        this.rcvBuffer = '';
        this.debug = params.debug;

        // Runtime option tweaks
        this.raw = false;
        this.parseOpts = {
            trim: true,
            explicitArray: false,
            emptyTag: true,
            ignoreAttrs: false,
            tagNameProcessors: [this._objectHelper],
            attrNameProcessors: [this._objectHelper],
            valueProcessors: [xml2js.processors.parseNumbers],
            attrValueProcessors: [xml2js.processors.parseNumbers]
        };
        this.algorithms = params.algorithms;

    }

    /**
     * Direct RPC session request, transforms requested json object, and sends the xml through the RPC tunnel
     * @function rpc
     * @param  {object}   request   Request json object to send through XML
     * @param  {Function} callback  Callback function called on completion
     * @return {Self}               Returns class self to hook on event listeners
     */
    rpc(request, callback) {
        const   self = this,
                messageID = this.idCounter += 1,
                object = {},
                builder = new xml2js.Builder({
                    headless: false,
                    allowEmpty: true
                });

        const defaultAttr = {
            'message-id': messageID,
            'xmlns': 'urn:ietf:params:xml:ns:netconf:base:1.0'
        };

        let xml;

        if (typeof(request) === 'string') {
            object.rpc = {
                $: defaultAttr,
                [request]: null
            };
        } else if (typeof(request) === 'object') {
            object.rpc = request;
            if (object.rpc.$) {
                object.rpc.$['message-id'] = messageID;
            } else {
                object.rpc.$ = defaultAttr;
            }
        }

        // build XML for request
        try {
            xml = builder.buildObject(object) + '\n' + DELIM;
        } catch (err) {
            return callback(err);
        }

        this._send(xml, messageID, callback);
    }

    /**
     * Opens a new netconf session with provided credentials
     * @function open
     * @param  {Function} callback Callback called after session call completes
     * @return {Client}            Returns copy of current class object
     */
    open(callback) {
        const self = this;

        this.sshConn = ssh.Client();
        this.sshConn.on('ready', function invokeNETCONF() {
            vasync.waterfall([
                    function getStream(next) {
                        self.sshConn.subsys('netconf', next);
                    },
                    function handleStream(stream, next) {
                        self.netconf = stream;
                        self._sendHello();
                        stream.on('data', function buffer(chunk) {
                            self.rcvBuffer += chunk;
                            self.emit('data');
                        }).on('error', function streamErr(err) {
                            self.sshConn.end();
                            self.connected = false;
                            self.emit('error');
                            throw (err);
                        }).on('close', function handleClose() {
                            self.sshConn.end();
                            self.connected = false;
                            self.emit('close');
                        }).on('data', function handleHello() {
                            if (self.rcvBuffer.match(DELIM)) {
                                const helloMessage = self.rcvBuffer.replace(DELIM, '');
                                self.rcvBuffer = '';
                                self.netconf.removeListener('data', handleHello);
                                next(null, helloMessage);
                            }
                        });
                    },
                    function parseHello(helloMessage, next) {
                        self._parse(helloMessage, function assignSession(err, message) {
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
                function(err) {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null);
                });
        }).on('error', function(err) {
            self.connected = false;
            callback(err);
        }).connect({
            host: this.host,
            username: this.username,
            password: this.password,
            port: this.port,
            privateKey: this.pkey,
            debug: this.debug,
            algorithms: this.algorithms
        });

        return self;
    }

    /**
     * Closes the SSH connection to netconf
     * @function close
     * @param  {Function} callback Callback function fired after netconf session ends
     */
    close(callback) {
        const self = this;

        // send close-session request to netconf
        self.rpc('close-session', (err, reply) => {
            // close out SSH tunnel
            self.sshConn.end();
            self.connected = false;

            // if callback function is passed, continue with callback
            if(typeof callback === 'function'){
                callback(err, reply);
            }
        });
    }

    /**
     * direct netconf send
     * @function _send
     * @private
     * @param  {[type]}   xml       [description]
     * @param  {[type]}   messageID [description]
     * @param  {Function} callback  [description]
     * @return {[type]}             [description]
     */
    _send(xml, messageID, callback) {
        const self = this;
        this.netconf.write(xml, function startReplyHandler() {
            const rpcReply = new RegExp(`(<rpc-reply.*message-id="${messageID}"[\\s\\S]*</rpc-reply>)\\n?]]>]]>\\s*`);
            // Add an event handler to search for our message on data events.
            self.netconf.on('data', function replyHandler() {
                const replyFound = self.rcvBuffer.search(rpcReply) !== -1;

                if (replyFound) {
                    const message = self.rcvBuffer.match(rpcReply);
                    self._parse(message[1], callback);
                    // Tidy up, remove matched message from buffer and
                    // remove this messages replyHandler.
                    self.rcvBuffer = self.rcvBuffer.replace(message[0], '');
                    self.netconf.removeListener('data', replyHandler);
                }
            });
        });
    }

    /**
     * Parses xml response
     * @function _parse
     * @private
     * @param  {string}   xml      XML string to parse
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    _parse(xml, callback) {
        const self = this;
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
                return callback(self._createError(JSON.stringify(message), 'rpcError'), null);
            }
            return callback(null, message);
        });
    }



    /**
     * Sends hello to confirm connection
     * @function _sendHello
     * @private
     */
    _sendHello() {
        const message = {
            hello: {
                $: {
                    xmlns: 'urn:ietf:params:xml:ns:netconf:base:1.0'
                },
                capabilities: {
                    capability: ['urn:ietf:params:xml:ns:netconf:base:1.0', 'urn:ietf:params:netconf:base:1.0']
                }
            }
        };
        const builder = new xml2js.Builder();
        const xml = builder.buildObject(message) + '\n' + DELIM;
        this.netconf.write(xml);
    }

    /**
     * Creates an error object from the error thrown
     * @function _createError
     * @private
     * @param  {string} msg  Error message
     * @param  {string} type Error type
     * @return {Error}       returns javascript Error object
     */
    _createError(msg, type) {
        const err = new Error(msg),
            self = this;
        err.name = type;

        Error.captureStackTrace(err, self._createError);
        return err;
    }

    /**
     * Replaces characters that prevent dot-style object navigation
     * @function _objectHelper
     * @private
     * @param  {string} name String to transform
     * @return {string}      Transformed string
     */
    _objectHelper(name) {
        // Replaces characters that prevent dot-style object navigation.
        return name.replace(/-|:/g, '_');
    }

}

module.exports.Client = Client;
