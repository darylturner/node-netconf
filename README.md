# node-netconf
Pure JavaScript NETCONF library for Node.js

Managing the streams and events is taken care of by the module and exposes core functions via requests and callbacks.

Multiple endpoints are supported and multiple asynchronous non-blocking requests can be made to each client.

## Installation
Module can be manually installed by cloning repository or downloading directly from github.
Requires the ssh2 and xml2js module which can be installed from npm.

This module will be published to npm once ready.

## Usage
Also please see examples for usage guidelines.

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

Current utility functions implemented are:  
commit, rollback, compare and load.
