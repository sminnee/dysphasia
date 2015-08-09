/**
 * A few differnet compilers
 */

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

/**
 * LLVM IR generator
 */
function LLVM () {
  this.varNum = 0;
}
LLVM.prototype = {
  handleTop: function (blocks) {
    return blocks
      .map(function (b) { return b.code; })
      .join('');
  },
  handleBlock: function (name, statements) {
    var statementCode = statements.map(function (s) { return s.code; }).join('');
    return {
      globalCode: statements.map(function (s) { s.globalCode; }).join(''),
      code: 'define i32 @' + name + '() {\n  ' + statementCode.replace(/\n/g, '\n  ') + '\n}\n'
    };
  },
  handleStringExpression: function (expr) {
    var varName = this.nextGlobalVarName('str');
    var type = '[' + expr.length + ' x i18]';

    return {
      globalCode: varName + ' = private unnamed_addr constant ' + type + 'c"'
        + expr.replace(/[\\'"]/g, '\\$&') + '"\n',
      code: '',
      varName: varName,
      type: type
    };
  },
  handleReturnStatement: function (expr) {
    return {
      code: expr.code + '\n' + 'ret ' + expr.type + ' ' + expr.varName + '\n'
    };
  },
  handleArithmeticExpression: function (expr) {
    return expr;
  },
  handleAdd: function (left, right) {
    return this.combineBranchesWith('add', left, right);
  },
  handleMul: function (left, right) {
    return this.combineBranchesWith('mul', left, right);
  },

  handleString: function (value) {
    return {
      code: '; push "' + value + 'literal\n',
      varName: '%string'
    };
  },
  handleFloat: function (value) {
    return { globalCode: '', code: '', varName: value, type: 'float' };
  },
  handleInt: function (value) {
    return { globalCode: '', code: '', varName: value, type: 'i32' };
  },
  handleUse: function (name) {
    return { globalCode: 'declare i32 @' + name + '(i8* nocapture) nounwind' };
  },

  // ------------------------------------------------ //

  nextVarName: function (prefix) {
    this.varNum++;
    return '%' + prefix + this.varNum;
  },
  nextGlobalVarName: function (prefix) {
    this.varNum++;
    return '@' + prefix + this.varNum;
  },

  combineBranchesWith: function (fnName, left, right) {
    var varName = this.nextVarName('add');
    if (left.type !== right.type) {
      throw 'Type mismatch: ' + left.type + ', ' + right.type;
    }

    return {
      globalCode: left.globalCode + right.globalCode,
      code:
        left.code +
        right.code +
        varName + ' = ' + fnName + ' ' + left.type + ' ' + left.varName + ', ' + right.varName + '\n',
      varName: varName,
      type: left.type
    };
  }
};

module.exports = {
  ParseTree: ParseTree,
  LLVM: LLVM
};
