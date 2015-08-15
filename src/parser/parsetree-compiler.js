var Dys = require('../DysAST');

/**
 * Parser-handler that generates a Dysphasia AST
 */

function ParseTree () {
}
ParseTree.prototype = {
  handleTop: function (blocks) {
    return new Dys.File(new Dys.List(blocks));
  },
  handleBlock: function (name, statements) {
    return new Dys.FnDef(name, new Dys.List(statements));
  },
  handleReturnStatement: function (expr) {
    return new Dys.ReturnStatement(expr);
  },

  handleStringExpression: function (expr) {
    return expr;
  },
  handleArithmeticExpression: function (expr) {
    return expr;
  },
  handleAdd: function (left, right) {
    return new Dys.Op('+', left, right);
  },
  handleMul: function (left, right) {
    return new Dys.Op('*', left, right);
  },

  handleFunctionCall: function (fName, fArgs) {
    return new Dys.FnCall(fName, new Dys.List(fArgs));
  },

  handleIfBlock: function (test, pass, fail) {
    return new Dys.IfBlock(test, new Dys.List(pass), fail ? new Dys.List(fail) : Dys.Empty);
  },

  handleForLoop: function (variable, loopSource, block) {
    return new Dys.ForLoop(variable ? variable : Dys.Empty, loopSource, new Dys.List(block));
  },
  handleIntRange: function (start, end) {
    return new Dys.Literal('range', { start: start, end: end });
  },
  handleArrayDefinition: function (items) {
    return new Dys.Literal('array', new Dys.List(items));
  },

  handleString: function (value) {
    return new Dys.Literal('string', value);
  },
  handleFloat: function (value) {
    return new Dys.Literal('float', value);
  },
  handleInt: function (value) {
    return new Dys.Literal('int', value);
  },
  handleUse: function (name) {
    return new Dys.UseStatement(name);
  }
};

module.exports = ParseTree;
