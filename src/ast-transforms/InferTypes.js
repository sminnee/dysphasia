var util = require('util');
var ASTTransform = require('./ASTTransform');
var Dys = require('../DysAST');

/**
 * Infer the types of vall variables and expressions that don't have types listed
 */
function InferTypes (fnDefs) {
  ASTTransform.call(this);
  this.varDefs = {};
  this.fnDefs = fnDefs;
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

  // Some operators come with a pre-defined type, e.g. comparisons are always boolean
  if (result.type.nodeType !== 'Empty') return result;

  if (result.left.type.type === result.right.type.type) {
    result.type = result.left.type;
  } else {
    throw new SyntaxError("Types don't match in " + result.toString());
  }

  return result;
};

InferTypes.prototype.handleFnDef = function (ast) {
  var self = this;
  // TODO: Limit scope only to the function
  if (ast.args.nodeType === 'List') {
    ast.args.forEach(function (arg) {
      self.varDefs[arg.name] = arg.type;
    });
  }
  return this.defaultHandler(ast);
};

InferTypes.prototype.handleFnCall = function (ast) {
  var result = this.defaultHandler(ast);
  if (this.fnDefs[result.name]) {
    result.type = this.fnDefs[result.name].type;
  } else {
    throw new SyntaxError("Can't find definition of function " + result.name);
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
  if (ast.type.isEmpty()) {
    var inferredType = this.getVariable(ast.name);
    if (!inferredType) throw new SyntaxError('Can\'t infer type for "' + ast.name + '"');

    ast.type = inferredType;
  }

  return this.defaultHandler(ast);
};

module.exports = InferTypes;
