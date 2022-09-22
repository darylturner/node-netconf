# node-netconf
Pure JavaScript NETCONF library for Node.js

This module was created to abstract the events and streams away from handling a NETCONF session in Node.js. Event management, message IDs and associating requests with replies is taken care of by the module and exposes core functions via requests and callbacks.

The core parts of the code focus on the transport and messaging layers. The operation layer is implemented as wrapper functions and can be easily expanded.

Multiple endpoints are supported and multiple asynchronous non-blocking requests can be made to each client.

Developed/tested against Juniper devices.

## ARCHIVED. This package is no longer maintained. Dependencies are quite out of date and I do not recommend using this package directly. If no alternatives are available please fork and update package.json dependencies. Some require a major version bump and their APIs may have changed.

## Example
```js

const router = new netconf.Client({
    host: '172.28.128.3',
    username: 'vagrant',
    pkey: fs.readFileSync('insecure_ssh.key', { encoding: 'utf8' })
})

router.open((err) => {
    if (err) {
        throw err;
    }

    router.rpc('get-arp-table-information', (err, reply) => {
        router.close()
        if (err) {
            throw err;
        }

        console.log(JSON.stringify(reply))
    })
})
```
Checkout examples on github for more usage examples.

## Usage

### Connecting to endpoint

Create a new Client object by passing in the connection parameters via a JavaScript object. Both password and private key authentication methods are supported.

The NETCONF session can then be opened using the ```.open()``` method.

*Function*   
router.open(callback);  
*Callback*  
function (err) {...}

The callback function will be called once the SSH and NETCONF session has connected and hello and capability messages have been exchanged. The only argument passed to the callback function is an error instance.

```js
const router = new netconf.Client({
    host: '172.28.128.4',
    username: 'vagrant',
    password: null,
    pkey: privateKey
})

router.open((err) => {
    if (err) {
        throw err
    }
    console.log('Connected')
})
```

### Sending requests

Requests are sent using the ```.rpc()``` method.

**Simple Requests**  
*Function*  
router.rpc('request', callback);  
*Callback*  
function (err, reply) {...}

For simple requests where only a NETCONF method is required with no arguments, then the method can be passed as a string. The string will be used to create the xml2js object dynamically.

A message-id is automatically added to the request and the callback function will be invoked once the corresponding reply has been received.

**Advanced Usage**  
*Function*  
router.rpc({ request: { arg1: 'value', arg2: 'value' } }, callback);

For advanced usage where arguments are required to the NETCONF method then an object can be passed directly to the xml2js builder. The message-id will be automatically added.

Examples of advanced usage can be found in the test suite, the examples and main library.

**JunOS Examples**  
Juniper make it very simple to find the XML-RPC equivalent of it's CLI commands.

For example, the method used to gather chassis info can be found as such:
```xml
user@router> show chassis hardware | display xml rpc
<rpc-reply xmlns:junos="http://xml.juniper.net/junos/11.4R7/junos">
    <rpc>
        <get-chassis-inventory>
        </get-chassis-inventory>
    </rpc>
    <cli>
        <banner></banner>
    </cli>
</rpc-reply>
```

This can be used to retrieve this information using NETCONF.
```js
router.rpc('get-chassis-inventory', (err, reply) => {
    ...
})
```  
And for gathering interface information:
```xml
user@router> show interfaces ge-1/0/1 | display xml rpc
<rpc-reply xmlns:junos="http://xml.juniper.net/junos/11.4R7/junos">
    <rpc>
        <get-interface-information>
                <interface-name>ge-1/0/1</interface-name>
        </get-interface-information>
    </rpc>
    <cli>
        <banner></banner>
    </cli>
</rpc-reply>
```
```js
router.rpc({ 'get-interface-information': { 'interface-name': 'ge-1/0/1' } }, (err, reply) => {
        ...
    }
)
```

### Closing the session

The session can be gracefully closed using the ```.close()``` method.

*Function*   
router.close([callback]);  
*Callback*  
function (err) {...}

### Options

**XML Parsing**  
xml2js parsing options can be viewed/modified via ```.parseOpts``` in the client object.
The default options (I believe) should cover most use cases.  
See xml2js documentation for different parsing options. https://www.npmjs.com/package/xml2js

**Raw XML**  
The raw response from the server can be included by setting ```.raw = true``` in the client object.  
The raw XML will be embedded in the reply message under ```reply.raw```.

### Utility functions

Utility functions for common JunOS operations have been added to make working with these devices easier.
I'm happy to take pull requests for any added utility functions.

Currently implemented are:
commit, rollback, compare, load and facts.

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
Load configuration data into candidate-config using NETCONF. Default options are equivalent to "load merge" and would expect configuration data in JunOS curly-brace format.

*Function*  
router.load(configData, callback);  
*Callback*  
function (err, reply) {...}

The default load options can be overridden by supplying an options object in the format:
```js
options = {
    config: configData, //required
    action: 'merge'|'replace'|'override'|'update'|'set', //default merge
    format: 'text'|'xml' //default text
}
```
and called as such:

*Function*  
router.load(options, callback)

**Facts**  
The facts method collects some useful information from several RPC calls and presents the results back as a JavaScript object.

The following is collected: hostname, uptime, model, serial number and software version.  

*Function*  
router.facts(callback) {...}  
*Callback*  
function (err, facts)
