var LLVM_CONFIG = process.env.LLVM_CONFIG ? process.env.LLVM_CONFIG : 'llvm-config-3.6';
var CLANG = process.env.CLANG ? process.env.CLANG : 'clang++-3.6';

var Dysphasia = require('./src/dysphasia');
var fs = require('fs');
var exec = require('child_process').exec;

var userArgs = process.argv.slice(2);
var inputFile = userArgs[0];

Dysphasia.recompileParserIfNeeded(fs, './src/parser', function() {
  fs.readFile(inputFile, function (err, data) {
    var code = data.toString();
    // process.stdout.write(JSON.stringify(dp.parseTree(), null, '  ') + '\n');
    // process.stdout.write(dp.generateLLVMCode());

    var llFile = inputFile.replace(/\.dp$/, '.ll');
    var outFile = inputFile.replace(/\.dp$/, '');

    try {
      var dp = Dysphasia.loadString(code);
      var compiled = dp.generateLLVMCode();
    } catch(e) {
      if(e.offset) {
        console.error('Parse error on line ' + e.line + ':\n' + e.message + '\n...\n' 
          + code.substr(e.offset).match(/^.*\n(.*\n)?(.*\n)?(.*\n)?/)[0]
          + '...\n');
        process.exit(1);
      } else {
        throw(e);
      }
    }

    console.log('Compiled code:\n' + compiled + '\n');

    fs.writeFileSync(llFile, compiled);

    exec(LLVM_CONFIG + ' --cxxflags --ldflags --system-libs --libs core', function (err, stdout, stderr) {
      var flags = stdout.replace(/\n/g, ' ');
      console.log('Calling: ' + CLANG + ' ' + llFile + ' ' + flags + ' -o ' + outFile + '\n');
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