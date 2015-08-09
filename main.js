var LLVM_CONFIG = process.env.LLVM_CONFIG ? process.env.LLVM_CONFIG : 'llvm-config-3.6';
var CLANG = process.env.CLANG ? process.env.CLANG : 'clang++-3.6';

var Dysphasia = require('./src/dysphasia');
var fs = require('fs');
var exec = require('child_process').exec;

var userArgs = process.argv.slice(2);
var inputFile = userArgs[0];

Dysphasia.recompileParserIfNeeded(fs, './src/parser', function() {
  fs.readFile(inputFile, function (err, data) {
    var dp = Dysphasia.loadString(data.toString());
    // process.stdout.write(JSON.stringify(dp.parseTree(), null, '  ') + '\n');
    // process.stdout.write(dp.generateLLVMCode());

    var llFile = inputFile.replace(/\.dp$/, '.ll');
    var outFile = inputFile.replace(/\.dp$/, '');

    fs.writeFileSync(llFile, dp.generateLLVMCode());

    exec(LLVM_CONFIG + ' --cxxflags --ldflags --system-libs --libs core', function (err, stdout, stderr) {
      var flags = stdout.replace(/\n/g, ' ');
      exec(CLANG + ' ' + llFile + ' ' + flags + ' -o ' + outFile, function (err, stdout, stderr) {
        if(err) {
          console.error(stderr);
        } else {
          console.log("Compiled as " + outFile);
        }
      });
    });
  });
});