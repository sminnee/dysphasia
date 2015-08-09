/**
 * Simple JSON parse-tree generator
 */
function ParseTree () {
}
ParseTree.prototype = {
  handleTop: function (blocks) {
    return blocks;
  },
  handleBlock: function (name, statements) {
    var result = {};
    result[name] = statements;
    return result;
  },
  handleStringExpression: function (expr) {
    return expr;
  },
  handleReturnStatement: function (expr) {
    return { returns: expr };
  },
  handleArithmeticExpression: function (expr) {
    return expr;
  },
  handleAdd: function (left, right) {
    return ['+', left, right ];
  },
  handleMul: function (left, right) {
    return ['*', left, right ];
  }
};

module.exports = ParseTree;