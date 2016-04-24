/**
 * Transform multiple function definitions with guard statements into a single function with if blocks
 */
var util = require('util');
var ASTTransform = require('./ASTTransform');
var Dys = require('./../DysAST');

/**
 * Return a map of function definitions; intended to be used as an input to the InferTypes transform
 * and to the he LLVMCompiler.
 */
function InlineFnGuards () {
  ASTTransform.call(this);
  this.fnDefs = {};
}

util.inherits(InlineFnGuards, ASTTransform);

InlineFnGuards.prototype.handleFnDef = function (ast) {
  ast = this.defaultHandler(ast);

  // If the last statement isn't a return or a control block, make it a return
  if (ast.statements.nodeType !== 'List') throw Error('FnDef statements must be a list');

  var lastStatement = ast.statements.last;
  switch (lastStatement.nodeType) {
    case 'FnCall': case 'Op': case 'Literal': case 'Variable':
      ast.statements.last = new Dys.ReturnStatement(lastStatement);
  }

  // Inline guard
  if (ast.guard.nodeType !== 'Empty') {
    ast.statements = new Dys.List([new Dys.IfBlock(ast.guard, ast.statements, Dys.Empty)]);
    ast.guard = Dys.Empty;
  }

  // Combine multiple declarations
  var fn = this.fnDefs[ast.name];
  if (fn) {
    fn.statements = fn.statements.concat(ast.statements);
    return Dys.Empty;
  }

  // First declaration of a new function
  this.fnDefs[ast.name] = ast;
  return ast;
};

module.exports = InlineFnGuards;
