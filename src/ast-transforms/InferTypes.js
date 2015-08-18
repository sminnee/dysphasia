var util = require('util');
var ASTTransform = require('./ASTTransform');
var Dys = require('../DysAST');

/**
 * Infer the types of vall variables and expressions that don't have types listed
 */
function InferTypes () {
  ASTTransform.call(this);
  this.varDefs = {};
}

util.inherits(InferTypes, ASTTransform);

// TODO: this shouldn't be needed
InferTypes.prototype.declareVariable = function (name, type) {
  this.varDefs[name] = new Dys.Type(type);
};

InferTypes.prototype.getVariable = function (name) {
  return this.varDefs[name];
};

InferTypes.prototype.handleOp = function (ast) {
  var result = this.defaultHandler(ast);
  if (result.left.type.type === result.right.type.type) {
    result.type = result.left.type;
  } else {
    throw new SyntaxError("Types don't match in " . result.toString());
  }

  return result;
};

InferTypes.prototype.handleReturnStatement = function (ast) {
  var result = this.defaultHandler(ast);

  result.type = result.expression.type;

  return result;
};

InferTypes.prototype.handleVariableDeclaration = function (ast) {
  this.declareVariable(ast.variable.name, ast.type.type);

  return Dys.Empty;
};

InferTypes.prototype.handleVariable = function (ast) {
  if (ast.type.nodeType === 'Empty') {
    var inferredType = this.getVariable(ast.name);
    if (!inferredType) throw new SyntaxError('Can\'t infer type for "' + ast.name + '"');

    ast.type = inferredType;
  }

  return this.defaultHandler(ast);
};

module.exports = InferTypes;
