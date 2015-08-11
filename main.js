var LLVM_CONFIG = process.env.LLVM_CONFIG ? process.env.LLVM_CONFIG : 'llvm-config-3.6';
var CLANG = process.env.CLANG ? process.env.CLANG : 'clang++-3.6';
var OPT = process.env.OPT ? process.env.OPT : 'opt-3.6';
var LLC = process.env.LLC ? process.env.LLC : 'llc-3.6';

// Process options
var opt = require('node-getopt').create([
  ['p', '--parse-tree', 'Generate a parse tree and output as JSON.'],
  ['l', '--llvm', 'Generate LLVM code, output to STDOUT, and write to .ll file'],
  ['a', '--asm', 'Generate assembly code, output to STDOUT, and write LLVM to .ll file']
])
.bindHelp()
.parseSystem();

/**
 * Pick actions based on option flags
 */

// Default parse action
var parseCallback = function (dp) {
  return dp.generateLLVMCode();
};
// What do do with the parse result
var actions = { 'writeLLFile': true, 'optimise': true, 'compile': true };

if (opt.options['--llvm']) {
  actions = { 'writeLLFile': true, 'optimise': true, 'printLL': true };

} else if (opt.options['--parse-tree']) {
  parseCallback = function (dp) {
    return JSON.stringify(dp.parseTree(), null, '  ');
  };
  actions = { 'printLL': true };

} else if (opt.options['--asm']) {
  actions = { 'writeLLFile': true, 'optimise': true, 'assemble': true, 'printAssembly': true };
}

var inputFile = opt.argv[0];

runCli(inputFile, parseCallback, actions);

/**
 * Run The Dysphasia CLI tool
 * @param inputFile The filename to parse
 * @param parseCallback a closure, passed the DysphasiaFile object, that determines the kind of parsing to perform.
 * @param actions A map, with boolean values under keys 'print', 'writeLLFile', and 'compile', determining
 *                which actions to perform.
 */
function runCli (inputFile, parseCallback, actions) {
  var Dysphasia = require('./src/dysphasia');
  var fs = require('fs');
  var exec = require('child_process').exec;
  var execSync = require('child_process').execSync;

  Dysphasia.recompileParserIfNeeded(fs, './src/parser', function () {
    fs.readFile(inputFile, function (err, data) {
      var code = data.toString();

      try {
        var dp = Dysphasia.loadString(code);
        var compiled = parseCallback(dp);
      } catch(e) {
        if (e.offset) {
          console.error('Parse error on line ' + e.line + ':\n' + e.message + '\n...\n'
            + code.substr(e.offset).match(/^.*\n(.*\n)?(.*\n)?(.*\n)?/)[0]
            + '...\n');
          process.exit(1);
        } else {
          throw (e);
        }
      }

      if (actions.writeLLFile) {
        var llFile = inputFile.replace(/\.dp$/, '.ll');
      }

      if (actions.optimise) {
        fs.writeFileSync(llFile + '.tmp', compiled);
        execSync(OPT + ' -S ' + llFile + '.tmp -ipsccp -dce -simplifycfg -globalopt > ' + llFile);
        fs.unlinkSync(llFile + '.tmp');
        compiled = fs.readFileSync(llFile);
      }

      var assembly;
      if (actions.assemble) {
        assembly = execSync(LLC + ' ' + llFile + ' -o /dev/stdout');
      }

      if (actions.printLL) {
        process.stdout.write(compiled + '\n');
      }
      if (actions.printAssembly) {
        process.stdout.write(assembly + '\n');
      }

      if (actions.compile) {
        var outFile = inputFile.replace(/\.dp$/, '');

        if (!actions.optimise) {
          fs.writeFileSync(llFile, compiled);
        }

        exec(LLVM_CONFIG + ' --cxxflags --ldflags --system-libs --libs core', function (err, stdout, stderr) {
          var flags = stdout.replace(/\n/g, ' ');
          console.log('Calling: ' + CLANG + ' ' + llFile + ' ' + flags + ' -o ' + outFile + '\n');
          exec(CLANG + ' ' + llFile + ' ' + flags + ' -o ' + outFile, function (err, stdout, stderr) {
            if (err) {
              console.error(stderr);
            } else {
              console.log('Compiled as ' + outFile);
            }
          });
        });
      }
    });
  });
};
