var ASTNode = require('./ASTNode');

/**
 * Builder for an LLVM-IR AST
 */
function ASTBuilder () {
  this.declared = {};
}

ASTBuilder.prototype.nextVarName = function (hint) {
  // If the hint starts with % then assume it has been a previously generate variable
  if (hint[0] === '%') return hint;
  else return this.uniqueName('%' + hint);
};

ASTBuilder.prototype.nextGlobalVarName = function (hint) {
  // If the hint starts with @ then assume it has been a previously generate variable
  if (hint[0] === '@') return hint;
  else return this.uniqueName('@' + hint);
};

ASTBuilder.prototype.uniqueName = function (hint) {
  if (!this.declared[hint]) {
    this.declared[hint] = 1;
    return hint;
  } else {
    this.declared[hint]++;
    return hint + this.declared[hint];
  }
};

/**
 * Return a null-object ASTNode.
 * Return this instead of null if your handler doesn't need to change the code.
 */
ASTBuilder.prototype.noop = function () {
  return new ASTNode(this, {});
};

/**
 * Return a node for a literal of the given type
 */
ASTBuilder.prototype.literal = function (type, value) {
  return new ASTNode(this, {type: type, value: value});
};

/**
 * Return a node for a literal of the given type
 */
ASTBuilder.prototype.statement = function (code) {
  return new ASTNode(this, {}).addStatement(code);
};

/**
 * Return an expression
 */
ASTBuilder.prototype.expression = function (type, value, hint) {
  return new ASTNode(this, {}).addExpression(type, value, hint);
};

/**
 * Combine 2 branches with an appropriate llvm operator - used for add, mul, etc
 */
ASTBuilder.prototype.combineWithOperator = function (opName, type, left, right) {
  return left.merge(right).addExpression(
    type,
    opName + ' ' + type + ' ' + left.value + ', ' + right.value
  );
};

/**
 * Return a new global declaration
 */
ASTBuilder.prototype.globalDeclare = function (content) {
  return new ASTNode(this, {globalCode: content + '\n'});
};

ASTBuilder.prototype.globalConst = function (type, definition) {
  var varName = this.nextGlobalVarName('str');
  return new ASTNode(this, {
    globalCode: varName + ' = ' + definition + '\n',
    value: varName,
    type: type
  });
};

/**
 * Return a node that combines an array of nodes by iterative merge
 */
ASTBuilder.prototype.nodeList = function (expressions) {
  var combined = null;

  expressions.forEach(function (e) {
    if (!e) {
      throw new Error('Bad item in nodeList: ' + JSON.stringify(expressions));
    }
    if (combined === null) {
      combined = e;
    } else {
      combined = combined.merge(e);
    }
  });

  return combined;
};

module.exports = ASTBuilder;
