function DysphasiaFile (input) {
  this.input = input;
}

DysphasiaFile.prototype.parseTree = function () {
  var Parser = require('./parser/parser');
  return Parser.parse(this.input);
};

DysphasiaFile.prototype.generateLLVMCode = function () {
  var LLVMCompiler = require('./LLVMCompiler');
  var StrConcatToCLibrary = require('./ast-transforms/StrConcatToCLibrary');

  // Basic AST
  var ast = this.parseTree();

  // AST transformations
  ast = (new StrConcatToCLibrary()).handle(ast);

  return (new LLVMCompiler()).handle(ast);
};

var Dysphasia = {
  loadString: function (string) {
    return new DysphasiaFile(string);
  },

  recompileParser: function (fs, inFile, outFile, callback) {
    fs.readFile(inFile, function (err, data) {
      if (err) throw (err);

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
      if (err) throw (err);

      fs.stat(inFile, function (err, inStat) {
        if (err) throw (err);

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
