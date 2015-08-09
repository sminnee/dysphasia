function DysphasiaFile (input) {
  this.input = input;
}

DysphasiaFile.prototype.parseTree = function () {
  var Parser = require('./parser/parser');
  var ParseTree = require('./parser/parsetree-compiler');
  return Parser.parse(this.input, { compiler: new ParseTree() });
};

DysphasiaFile.prototype.generateLLVMCode = function () {
  var Parser = require('./parser/parser');
  var LLVM = require('./parser/llvm-compiler');
  return Parser.parse(this.input, { compiler: new LLVM() });
};

var Dysphasia = {
  loadString: function (string) {
    return new DysphasiaFile(string);
  },

  recompileParser: function (fs, inFile, outFile, callback) {
    fs.readFile(inFile, function (err, data) {
      var PEG = require('pegjs');

      console.warn('Recompiling parser...');
      var parserSource = PEG.buildParser(data.toString(), { output: 'source' });
      fs.writeFile(outFile, 'module.exports = ' + parserSource + ';\n', callback);
    });
  },

  recompileParserIfNeeded: function (fs, basePath, callback) {
    var inFile = basePath + '/parser.pegjs';
    var outFile = basePath + '/parser.js';

    fs.stat(outFile, function (err, outStat) {
      fs.stat(inFile, function (err, inStat) {
        if (Date.parse(outStat.mtime) < Date.parse(inStat.mtime)) {
          Dysphasia.recompileParser(fs, inFile, outFile, callback);
        } else {
          callback();
        }
      });
    });
  }
};

module.exports = Dysphasia;
