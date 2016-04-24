var util = require('util');
var ASTTransform = require('./ASTTransform');
var Dys = require('../DysAST');

/**
 * Infer the types of vall variables and expressions that don't have types listed.
 * Also attaches function call signatures to function calls.
 * Runs over several passes, until it has stopped finding new hints to infer through the tree.
 */
function InferTypes () {
  ASTTransform.call(this);
  this.varDefs = {};
  this.fnSignatures = {};
  this.fnTypeHints = {};
  this.runAgain = false;
}

util.inherits(InferTypes, ASTTransform);

// TODO: this shouldn't be needed
InferTypes.prototype.declareVariable = function (name, type) {
  this.varDefs[name] = new Dys.Type(type);
};

InferTypes.prototype.getVariable = function (name) {
  return this.varDefs[name];
};

// Provide an arg type hint
InferTypes.prototype.addFnArgTypes = function (name, types) {
  if (!this.fnTypeHints[name]) {
    if (types.nodeType !== 'List') {
      throw new SyntaxError('addFnArgTypes must be passed a Dys.List node');
    }
    this.fnTypeHints[name] = types;
    this.runAgain = true;
  }
};

// Provide a return type hint
InferTypes.prototype.addFnSignature = function (name, signature) {
  if (this.fnSignatures[name]) {
    var newSignature = this.fnSignatures[name].combine(signature);
    if (!newSignature.equals(this.fnSignatures[name])) {
      this.fnSignatures[name] = newSignature;
      this.runAgain = true;
    }
  } else {
    this.fnSignatures[name] = signature;
    this.runAgain = true;
  }
};

// Look up a type hint
InferTypes.prototype.getFnArgType = function (name, idx) {
  if (this.fnTypeHints[name]) {
    return this.fnTypeHints[name].items[idx];
  }
};

// Look up a type hint
InferTypes.prototype.getFnSignature = function (name) {
  if (this.fnSignatures[name]) {
    return this.fnSignatures[name];
  } else {
    return Dys.Empty;
  }
};

InferTypes.prototype.handleFile = function (ast) {
  // Repeat until runAgain isn't set by something in the transformation
  do {
    this.runAgain = false;
    ast = this.defaultHandler(ast);
  } while (this.runAgain);
  return ast;
};

InferTypes.prototype.handleOp = function (ast) {
  var result = this.defaultHandler(ast);

  // Some operators come with a pre-defined type, e.g. comparisons are always boolean
  if (!result.type.isEmpty()) return result;

  // Matching types
  if (result.left.type.type === result.right.type.type) {
    result.type = result.left.type;
  } else {
    // Missing types - only an error if we're not doing another pass
    if (result.left.type.isEmpty() || result.right.type.isEmpty()) {
      if (!this.runAgain) {
        throw new SyntaxError('Can\'t find the types in ' + result.toString());
      }

    // Complete but mis-matched types
    } else {
      throw new SyntaxError('Types don\'t match in ' + result.toString());
    }
  }

  return result;
};

InferTypes.prototype.handleFnDef = function (ast) {
  // Track return types within the function
  this.returnTypes = [];

  var self = this;
  // TODO: Limit scope only to the function
  if (ast.args.nodeType === 'List') {
    ast.args.forEach(function (arg, i) {
      // Find inferred argument type
      var inferredType = self.getFnArgType(ast.name, i);
      if (arg.type.isEmpty()) {
        arg.type = inferredType;
      } else {
        if (arg.type.type !== inferredType.type) {
          throw new SyntaxError('Can\'t use inferred type ' + inferredType.toString() +
            '; explicit type set to ' + arg.type.toString());
        }
      }
      arg.type = inferredType;
      self.varDefs[arg.name] = arg.type;
    });
  }
  var result = this.defaultHandler(ast);

  // Pick the first type
  // TODO: Check for type uniqueness
  if (this.returnTypes[0]) {
    result.type = this.returnTypes[0];
  }

  this.addFnSignature(result.name, result.signature);

  return result;
};

InferTypes.prototype.handleFnCall = function (ast) {
  var result = this.defaultHandler(ast);

  // Provide type hints for Fn defs
  var argTypes = result.args.mapList(function (arg) { return arg.type; });
  this.addFnArgTypes(result.name, argTypes);

  var signature = this.getFnSignature(result.name);
  if (!signature.isEmpty()) {
    // Don't bother adding a signature if it's the same as the function call
    if (signature.varArgs || !signature.args.equals(argTypes)) {
      result.signature = signature;
    }
    result.type = result.type.combine(signature.type);
  } else if (!this.runAgain) {
    throw new SyntaxError("Can't find definition of function " + result.name);
  }
  return result;
};

InferTypes.prototype.handleReturnStatement = function (ast) {
  var result = this.defaultHandler(ast);

  result.type = result.expression.type;

  this.returnTypes.push(result.type);

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

InferTypes.prototype.handleUseStatement = function (ast) {
  var result = this.defaultHandler(ast);
  this.addFnSignature(result.name, result.signature);
  return result;
};

InferTypes.prototype.handleReturnStatement = function (ast) {
  var result = this.defaultHandler(ast);
  result.type = result.expression.type;
  this.returnTypes.push(result.type);
  return result;
};

module.exports = InferTypes;
