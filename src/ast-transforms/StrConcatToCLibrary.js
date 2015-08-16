var util = require('util');
var ASTTransform = require('./ASTTransform');
var Dys = require('../DysAST');

/**
 * Convert str-concat nodes into relevant c library calls, notably snprintf
 */
function StrConcatToCLibrary () {
  ASTTransform.call(this);
  this.varDefs = {};
}

util.inherits(StrConcatToCLibrary, ASTTransform);

// TODO: this shouldn't be needed
StrConcatToCLibrary.prototype.declareVariable = function (name, type) {
  this.varDefs[name] = type;
};
StrConcatToCLibrary.prototype.getVariable = function (name) {
  return this.varDefs[name];
};

StrConcatToCLibrary.prototype.handleVariableDeclaration = function (ast) {
  this.declareVariable(ast.variable.name, ast.type.type);

  return this.defaultHandler(ast);
};

StrConcatToCLibrary.prototype.handleStrConcat = function (ast) {
  var self = this;

  // TO DO: strConcat will need to be checked for uniqueness against a local variable registrys
  var buffer = new Dys.Buffer(new Dys.Variable('strConcat', 'string'), 100);

  // Convert into an sprintf call
  var formatMap = {
    'int': '%i',
    'float': '%f',
    'string': '%s'
  };

  var snprintfArgs = [ buffer, new Dys.Literal(buffer.length, 'int'), new Dys.Literal('', 'string') ];

  ast.items.forEach(function (item) {
    // Look up variable type
    // TODO: This should probably be a pre-pass on the the AST
    if (item.nodeType === 'Variable' && item.type.nodeType === 'Empty') {
      var type = self.getVariable(item.name);
      if (!type) {
        throw new SyntaxError('Undeclared variable "' + item.name + '"');
      }
      item.type = type;
    }

    // Compile string literals directly into the sprintf call
    if (item.type === 'string' && item.nodeType === 'Literal') {
      snprintfArgs[2].value += item.value;

    } else if (formatMap[item.type]) {
      snprintfArgs[2].value += formatMap[item.type];
      snprintfArgs.push(item);

    } else {
      throw new SyntaxError('Can\'t embed in string: ' + JSON.stringify(item));
    }
  });

  // TODO: Automatically include a 'use' statement for snprintf if it doesn't already exist
  // new Dys.UseStatement('snprintf', new Dys.List([ new Dys.Type('buffer'), new Dys.Type('string'), ]))

  // Rewrite as AST: Call snprintf, populating the myVar variable and then return that variable
  var newAST = new Dys.List([
    new Dys.FnCall('snprintf', snprintfArgs),
    buffer.variable
  ]);

  return newAST;
};

module.exports = StrConcatToCLibrary;
