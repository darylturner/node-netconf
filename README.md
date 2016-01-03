# node-netconf
Pure JavaScript NETCONF library for Node.js

Managing the streams and events is taken care of by the module and exposes core functions via requests and callbacks.

Multiple endpoints are supported and multiple asynchronous non-blocking requests can be made to each client.

## Installation

Published to npm.

npm install netconf

## Example
```JavaScript
function pprint(object) {
    console.log(util.inspect(object, {depth:null, colors:true}));
}

function processResults(err, reply) {
    if (err) {
        pprint(reply);
        throw err;
    } else {
        var arpInfo = reply.rpc_reply.arp_table_information.arp_table_entry;
        console.log(JSON.stringify(arpInfo));
        router.close();
    }
}

var router = new netconf.Client({
    host: '172.28.128.3',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', {encoding: 'utf8'})
});

router.open(function afterOpen(err) {
    if (!err) {
        router.rpc('get-arp-table-information', null, processResults);
    } else {
        throw err;
    }
});
```
## Usage
Checkout examples on github for more usage examples.

### Connecting to endpoint

Create a new Client object and pass in the connection parameters via a JavaScript object. Both password and private key authentication methods are supported.

```JavaScript
var params = {
    host: '172.28.128.4',
    username: 'vagrant',
    password: null,
    pkey: privateKey
};
var router = new netconf.Client(params);

router.open(function onOpen(err) {
    if (err) {
        throw err;
    } else {
        console.log('Connected');
    }
});
```

The NETCONF session can then be opened using the .open() method.

*Function*   
router.open(callback);  
*Callback*  
function (err) {...}

The callback function will be called once the SSH and NETCONF session has connected and hello and capability messages have been exchanged. The only argument passed to the callback function is an error instance.

### Sending requests

Requests are sent using the .rpc() method.

*Function*  
router.rpc('request', args, callback);  
*Callback*  
function (err, reply) {...}

An XML-RPC request is constructed from the request string and the args object. The request string will be passed as the NETCONF method such as get, get-config, etc. The args object is passed to the xml2js builder to form any arguments and filters to the main request or can be set to null if not used.

A message-id is automatically added to the request and the callback function will be invoked once the corresponding reply has been received.

### Closing the session

The session can be gracefully closed using the .close() method.

*Function*   
router.close([callback]);  
*Callback*  
function (err) {...}

### Utility functions

Utility functions for common JunOS operations have been added to make working with these devices easier.
I'm happy to take pull requests for any added utility functions.

Currently implemented are:
commit, rollback, compare and load.

**Commit**  
Commit candidate configuration to device.

*Function*  
router.commit(callback);  
*Callback*  
function (err, reply) {...}

**Rollback**  
Discard candidate configuration on device.

*Function*  
router.rollback(callback);  
*Callback*  
function (err, reply) {...}

**Compare**  
Show difference between running and candidate-config. Equivalent to "show | compare".

*Function*  
router.compare(callback);  
*Callback*  
function (err, diff) {...}

**Load**  
Load configuration data into candidate-config using netconf. Default options are equivalent to "load merge" and would expect configuration data in JunOS curly-brace format.

*Function*  
router.load(configData, callback);  
*Callback*  
function (err, reply) {...}

The default load options can be overridden by supplying an options object in the format:
```JavaScript
options = {
    config: configData, //required
    action: 'merge'|'replace'|'override'|'update'|'set', //default merge
    format: 'text'|'xml' //default text
};
```
and called as such:

*Function*  
router.load(options, callback)
