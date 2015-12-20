var hb = require('handlebars');
var fs = require('fs');
var process = require('process');

var data = '';
process.stdin.on('data', function (chunk) {
    data += chunk;
}).on('end', function () {
    render(JSON.parse(data), process.argv[2]);
});

function render(data, template_file) {
    fs.readFile(template_file, function (err, buffer) {
        if (!err) {
            var template = hb.compile(buffer.toString());
            var result = template(data);
            console.log(result);
        } else {
            throw err;
        }
    });
}
