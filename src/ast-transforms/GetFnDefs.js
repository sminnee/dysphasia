var util = require('util');
var ASTTransform = require('./ASTTransform');

/**
 * Return a map of function definitions; intended to be used as an input to the InferTypes transform
 * and to the he LLVMCompiler.
 */
function GetFnDefs () {
  ASTTransform.call(this);
  this.fnDefs = {};
}

util.inherits(GetFnDefs, ASTTransform);

// TODO: this shouldn't be needed
GetFnDefs.prototype.handleFile = function (ast) {
  this.defaultHandler(ast);
  return this.fnDefs;
};

GetFnDefs.prototype.handleUseStatement = function (ast) {
  this.fnDefs[ast.name] = this.defaultHandler(ast);
  return this.fnDefs[ast.name];
};

GetFnDefs.prototype.handleReturnStatement = function (ast) {
  this.returnTypes.push(ast);
  return this.defaultHandler(ast);
};

GetFnDefs.prototype.handleFnDef = function (ast) {
  this.returnTypes = [];
  this.fnDefs[ast.name] = this.defaultHandler(ast);
  return this.fnDefs[ast.name];
};

module.exports = GetFnDefs;
