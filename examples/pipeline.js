module.exports.read = function (callback) {
    var data = '';
    process.stdin.once('data', function(chunk) {
        data += chunk;
    }).on('end', function() {
        callback(null, data);
    }).on('error', function(err) {
        callback(err, null);
    });
};
