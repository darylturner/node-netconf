#!/opt/pkg/bin/node
var fs = require('fs');
var process = require('process');
var hb = require('handlebars');
var pipeline = require('./pipeline');

function render(data, template_file) {
    fs.readFile(template_file, function (err, buffer) {
        if (!err) {
            var template = hb.compile(buffer.toString());
            var result = template(data);
            console.log(result);
        } else {
            throw (err);
        }
    });
}

pipeline.read(function (err, data) {
    if (!err) {
        render(JSON.parse(data), process.argv[2]);
    } else {
        throw (err);
    }
});
