var ASTNode = require('./ASTNode');

/**
 * Builder for an LLVM-IR AST
 */
function ASTBuilder () {
  this.varNum = 0;
}

ASTBuilder.prototype.nextVarName = function (prefix) {
  // If the hint starts with % then assume it has been a previously generate variable
  if (prefix[0] === '%') return prefix;
  this.varNum++;
  return '%' + prefix + this.varNum;
};

ASTBuilder.prototype.nextGlobalVarName = function (prefix) {
  this.varNum++;
  return '@' + prefix + this.varNum;
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
ASTBuilder.prototype.combineWithOperator = function (opName, left, right) {
  if (left.type !== right.type) {
    throw new SyntaxError('Type mismatch: ' + left.type + ', ' + right.type);
  }

  return left.merge(right).addExpression(
    left.type,
    opName + ' ' + left.type + ' ' + left.value + ', ' + right.value
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
    if (combined === null) {
      combined = e;
    } else {
      combined = combined.merge(e);
    }
  });

  return combined;
};

module.exports = ASTBuilder;
