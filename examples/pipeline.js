module.exports.read = function (callback) {
    var data = '';
    process.stdin.once('data', function(chunk) {
        data += chunk;
    }).once('end', function() {
        callback(null, data);
    }).once('error', function(err) {
        callback(err, null);
    });
};
