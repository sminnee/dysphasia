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
  this.fnRenaming = {};
  this.runAgain = false;
}

util.inherits(InferTypes, ASTTransform);

/**
 * Indicate the Type of a named variable
 * @param string name
 * @param ASTNode type
 */
InferTypes.prototype.declareVariable = function (name, type) {
  if (!type || !type.isComplete()) {
    throw new Error('Can\'t declare ' + name + ' to be incomplete type');
  }
  if (!this.varDefs[name] || !this.varDefs[name].isComplete()) {
    this.varDefs[name] = type;
    this.runAgain = true;
  }
};

InferTypes.prototype.getVariable = function (name) {
  return this.varDefs[name];
};

// Provide an arg type hint
// Returns the function name to use
InferTypes.prototype.addFnArgTypes = function (name, types) {
  if (this.fnTypeHints[name]) {
    // Multiple argument signatures detected in the call; generate duplicate implementations of the
    // function
    if (!this.fnTypeHints[name].equals(types)) {
      var typeList = types.map(function (type) { return type.type; }).join('_');
      var altName = name + '_' + typeList;

      if (!this.fnRenaming[name]) this.fnRenaming[name] = [];
      this.fnRenaming[name].push(altName);
      this.fnTypeHints[altName] = types;
      this.runAgain = true;
      return altName;
    }
  } else {
    if (types.nodeType !== 'List') {
      throw new SyntaxError('addFnArgTypes must be passed a Dys.List node');
    }
    this.fnTypeHints[name] = types;
    this.runAgain = true;
  }
  return name;
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
  var self = this;

  function processFnDef (ast) {
    self.returnTypes = [];

    // Clone to avoid side-effects
    ast = ast.clone();

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
    var result = self.defaultHandler(ast);

    // Pick the first type
    // TODO: Check for type uniqueness
    if (self.returnTypes[0]) {
      result.type = self.returnTypes[0];
    }

    self.addFnSignature(result.name, result.signature);

    return result;
  }

  var result = processFnDef(ast);

  // Duplicate functions if needed
  if (this.fnRenaming[result.name] && this.fnRenaming[result.name].length) {
    var originalName = result.name;

    result = new Dys.List([result]);

    this.fnRenaming[originalName].forEach(function (rename) {
      var derivedAst = ast.clone();
      derivedAst.name = rename;
      var derivedFn = processFnDef(derivedAst);
      result.items.push(derivedFn);
      this.runAgain = true;
    });

    this.fnRenaming[originalName] = [];
  }

  return result;
};

InferTypes.prototype.handleFnCall = function (ast) {
  var result = this.defaultHandler(ast);

  // Provide type hints for Fn defs
  var argTypes = result.args.mapList(function (arg) { return arg.type; });
  result.name = this.addFnArgTypes(result.name, argTypes);

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
  this.declareVariable(ast.variable.name, ast.type);

  return Dys.Empty;
};

InferTypes.prototype.handleAssignment = function (ast) {
  // Ensure that expression type is bubbles
  if (!ast.type.isComplete() && ast.expression.type.isComplete()) {
    ast.type = ast.expression.type;
    this.runAgain = true;
  }

  // Declare the type of the assigned bubble
  if (ast.type.isComplete()) {
    this.declareVariable(ast.variable.name, ast.type);
  }

  return this.defaultHandler(ast);
};

InferTypes.prototype.handleVariable = function (ast) {
  if (ast.type.isEmpty()) {
    var inferredType = this.getVariable(ast.name);
    if (inferredType) {
      ast.type = inferredType;
      this.runAgain = true;
    } else if (!this.runAgain) {
      throw new SyntaxError('Can\'t infer type for "' + ast.name + '"');
    }
  }

  return this.defaultHandler(ast);
};

/**
 * Literals: infer the type of array from its contents
 */
InferTypes.prototype.handleLiteral = function (ast) {
  // Infer the type of an array
  if (ast.type.type === 'array' && ast.type.subtype.isEmpty()) {
    var itemTypes = ast.value.items
      .reduce(function (a, b) { return a.combine(b.type); }, Dys.Empty);
    ast.type.subtype = itemTypes;
    this.runAgain = true;
  }

  // To do: allow for ranges of types other than int
  if (ast.type.type === 'range' && ast.type.subtype.isEmpty()) {
    ast.type.subtype = new Dys.Type('int');
  }
  return this.defaultHandler(ast);
};

/**
 * For loops: infer the type of the iterator variable from the loop source subtype
 */
InferTypes.prototype.handleForLoop = function (ast) {
  if (!ast.variable.isEmpty() &&
    !ast.variable.type.isComplete() &&
    ast.loopSource.type.isComplete()) {
    ast.variable.type = ast.loopSource.type.subtype;
    this.declareVariable(ast.variable.name, ast.variable.type);
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
