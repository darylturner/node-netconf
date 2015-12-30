module.exports.read = function (callback) {
    var data = '';
    process.stdin.on('readable', function() {
        var chunk = process.stdin.read();
        if (chunk != null) {
            data += chunk;
        }
    }).on('end', function() {
        callback(null, data);
    }).on('error', function(err) {
        callback(err, null);
    });
};
