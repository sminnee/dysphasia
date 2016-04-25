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

StrConcatToCLibrary.prototype.handleStrConcat = function (ast) {
  // TO DO: strConcat will need to be checked for uniqueness against a local variable registrys
  var buffer = new Dys.Buffer(new Dys.Variable('strConcat', new Dys.Type('string')), 100);

  // Convert into an sprintf call
  var formatMap = {
    'int': '%i',
    'float': '%f',
    'string': '%s'
  };

  var snprintfArgs = [ buffer, new Dys.Literal(buffer.length, 'int'), new Dys.Literal('', 'string') ];

  ast.items.forEach(function (item) {
    // Look up variable type
    if (item.type.isEmpty()) {
      throw new SyntaxError('Can\'t determine type of ' + item.toString());
    }

    // Compile string literals directly into the sprintf call
    if (item.type && item.type.type === 'string' && item.nodeType === 'Literal') {
      snprintfArgs[2].value += item.value;

    // Insert the placeholder of the type we're using
    } else if (item.type && formatMap[item.type.type]) {
      snprintfArgs[2].value += formatMap[item.type.type];
      snprintfArgs.push(item);

    // Embedding this type isn't supported yet
    } else {
      throw new SyntaxError('Can\'t embed in string: ' + JSON.stringify(item));
    }
  });

  // Set type length
  snprintfArgs[2].type.length = snprintfArgs[2].value.length;

  // TODO: Automatically include a 'use' statement for snprintf if it doesn't already exist
  // new Dys.UseStatement('snprintf', new Dys.List([ new Dys.Type('buffer'), new Dys.Type('string'), ]))

  // Rewrite as AST: Call snprintf, populating the myVar variable and then return that variable
  var fnCall = new Dys.FnCall('snprintf', snprintfArgs);
  fnCall.signature = new Dys.UseStatement(
    null, new Dys.Type('int'),
    new Dys.List([ new Dys.Type('buffer'), new Dys.Type('int'), new Dys.Type('string') ], true),
    true
  );

  // Return 2 items, the latter will be used as the variable
  var newAST = new Dys.List([ fnCall, buffer.variable ]);
  return newAST;
};

module.exports = StrConcatToCLibrary;
