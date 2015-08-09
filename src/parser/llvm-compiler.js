/**
 * LLVM IR generator
 */
function LLVM () {
  this.varNum = 0;
}

/**
 * Merge together all the executable code in the array of expressions,
 * setting the expression value / type to that of the last expression in the list.
 */
function mergeExpressions (expressions) {
  var lastExpression = expressions[expressions.length - 1];

  var result = {
    code: expressions.map(function (exp) { return (exp && exp.code) ? exp.code : ''; }).join(''),
    globalCode: expressions.map(function (exp) { return (exp && exp.globalCode) ? exp.globalCode : ''; }).join('')
  };

  if (lastExpression.varName) result.varName = lastExpression.varName;
  if (lastExpression.type) result.type = lastExpression.type;

  return result;
}

/**
 * Adds an LLVM expression to the base, assigning the result to a new variable
 */
function addLLVMExpression (varBucket, base, type, llvmExpression) {
  var varName = varBucket.nextVarName('var');

  return mergeExpressions([base, {
    code: varName + ' = ' + llvmExpression + '\n',
    varName: varName,
    type: type
  }]);
}

/**
 * Adds an LLVM statement to the base, clearing the result
 */
function addLLVMStatement (base, llvmStatement) {
  return mergeExpressions([base, {
    code: llvmStatement + '\n'
  }]);
}

/**
 * Returns a labelled block based on the given expression
 */
function labelledBlock (label, expression) {
  expression.code = label + ':' + '\n' + indent(expression.code);
  return expression;
}

/**
 * Combine 2 branches with an appropriate llvm operator - used for add, mul, etc
 */
function combineWithOperator (varBucket, opName, left, right) {
  if (left.type !== right.type) {
    throw 'Type mismatch: ' + left.type + ', ' + right.type;
  }

  return addLLVMExpression(
    varBucket,
    mergeExpressions([left, right]),
    left.type,
    opName + ' ' + left.type + ' ' + left.varName + ', ' + right.varName
  );
}

/**
 * Intends a string value by 2 spaces - used to format generated code
 */
function indent (str) {
  return '  ' + str.replace(/\n(.)/g, '\n  $1');
}

LLVM.prototype = {
  /**
   * Overall file
   */
  handleTop: function (blocks) {
    return blocks
      .map(function (b) { return b.globalCode; })
      .join('');
  },

  /**
   * Single function definition
   */
  handleBlock: function (name, statements) {
    var block = mergeExpressions(statements);
    return {
      globalCode: block.globalCode + 'define i32 @' + name + '() {\n' + indent(block.code) + '}\n'
    };
  },

  /**
   * Return statement
   */
  handleReturnStatement: function (expr) {
    return addLLVMStatement(expr, 'ret ' + expr.type + ' ' + expr.varName);
  },

  /**
   * Expression
   */
  handleStringExpression: function (expr) {
    return expr;
  },
  handleArithmeticExpression: function (expr) {
    return expr;
  },
  handleAdd: function (left, right) {
    return combineWithOperator(this, 'add', left, right);
  },
  handleMul: function (left, right) {
    return combineWithOperator(this, 'mul', left, right);
  },

  /**
   * Function call
   */
  handleFunctionCall: function (fName, fArgs) {
    var varBucket = this;

    // Cast arguments as needed
    fArgs = fArgs.map(function (arg) {
      if (arg.type !== 'i8*') {
        return addLLVMExpression(
          varBucket,
          arg,
          'i8*',
          'getelementptr ' + arg.type + '* ' + arg.varName + ', i64 0, i64 0'
        );
      } else {
        return arg;
      }
    });

    // Call
    return addLLVMExpression(
      this,
      mergeExpressions(fArgs),
      'i32',
      'call i32 @' + fName + '(' + fArgs.map(function (b) { return b.type + ' ' + b.varName; }).join(', ') + ')'
    );
  },

  // ------------------------------------------------ //

  /**
   * If and If/Else block
   */
  handleIfBlock: function (test, pass, fail) {
    // If
    var trueLabel = this.nextVarName('IfTrue').substr(1);
    var contLabel = this.nextVarName('Continue').substr(1);
    var falseLabel = contLabel;
    var falseBlock = {};

    var trueBlock = labelledBlock(trueLabel, addLLVMStatement(
      mergeExpressions(pass),
      'br label %' + contLabel
    ));

    // Fail block handling for If..Else
    if (fail) {
      falseLabel = this.nextVarName('IfFalse').substr(1);
      falseBlock = labelledBlock(falseLabel, addLLVMStatement(
        mergeExpressions(fail),
        'br label %' + contLabel
      ));
    }

    var branch = addLLVMStatement(test, 'br i1 ' + test.varName + ', label %' + trueLabel + ', label %' + falseLabel);

    return addLLVMStatement(
      mergeExpressions([branch, trueBlock, falseBlock]),
      contLabel + ':'
    );
  },

  // ------------------------------------------------ //

  /**
   * String literals
   */
  handleString: function (value) {
    var varName = this.nextGlobalVarName('str');
    var type = '[' + value.length + ' x i8]';

    return {
      globalCode: varName + ' = private unnamed_addr constant ' + type + ' c"'
        + value.replace(/[\\'"]/g, '\\$&').replace(/\n/g, '\\0A').replace(/\r/g, '\\00') + '"\n',
      varName: varName,
      type: type
    };
  },
  handleFloat: function (value) {
    return { varName: value, type: 'float' };
  },
  handleInt: function (value) {
    return { varName: value, type: 'i32' };
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
  }
};

module.exports = LLVM;
