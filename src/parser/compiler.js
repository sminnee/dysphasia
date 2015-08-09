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
      .map(function (b) { return b.globalCode; })
      .join('');
  },
  handleBlock: function (name, statements) {
    var statementCode = statements.map(function (s) { return s.code; }).join('');
    return {
      globalCode: 
        statements.map(function (s) { return s.globalCode; }).join('')
        + 'define i32 @' + name + '() {\n  ' + statementCode.replace(/\n/g, '\n  ') + '\n}\n'
    };
  },
  handleStringExpression: function (expr) {
    return expr;
  },
  handleReturnStatement: function (expr) {
    return {
      globalCode: expr.globalCode,
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

  handleFunctionCall: function (fName, fArgs) {
    var varName = this.nextVarName('fn');
    fArgs = fArgs.map(this.processArgument.bind(this));

    return { 
      code:
        fArgs.map(function (b) { return b.code; })
        + varName +' = call i32 @' + fName + '(' + fArgs.map(function (b) { return b.type + ' ' + b.varName; }).join(', ') + ')\n' , 
      globalCode: fArgs.map(function (b) { return b.globalCode; }),
      varName: varName
    }
  },

  processArgument: function(argument) {
    // Cast the argument,
    if(argument.type != 'i8*') {
      var varName = this.nextVarName('cast');
      return {
        globalCode: argument.globalCode,
        code: varName + ' = getelementptr ' + argument.type + '* ' + argument.varName + ', i64 0, i64 0\n',
        varName: varName,
        type: 'i8*'
      }
    } else {
      return argument;
    }
  },

  handleString: function (value) {
    var varName = this.nextGlobalVarName('str');
    var type = '[' + value.length + ' x i8]';

    return {
      globalCode: varName + ' = private unnamed_addr constant ' + type + ' c"'
        + value.replace(/[\\'"]/g, '\\$&').replace(/\n/g,"\\0A").replace(/\r/g,"\\00") + '"\n',
      code: '',
      varName: varName,
      type: type
    };
  },
  handleFloat: function (value) {
    return { globalCode: '', code: '', varName: value, type: 'float' };
  },
  handleInt: function (value) {
    return { globalCode: '', code: '', varName: value, type: 'i32' };
  },
  handleUse: function (name) {
    return { globalCode: 'declare i32 @' + name + '(i8* nocapture) nounwind\n' };
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
