var Dysphasia = require('./src/dysphasia');
var fs = require('fs');

var userArgs = process.argv.slice(2);
var inputFile = userArgs[0];

Dysphasia.recompileParserIfNeeded(fs, './src/parser', function() {
	fs.readFile(inputFile, function (err, data) {
		var dp = Dysphasia.loadString(data.toString());
		process.stdout.write(JSON.stringify(dp.parseTree(), null, '  ') + '\n');
	});
});
