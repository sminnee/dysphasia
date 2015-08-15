/**
 * Merge together all the executable code in the array of expressions,
 * setting the expression value / type to that of the last expression in the list.
 */

var ASTBuilder = require('../ASTBuilder');

/**
 * LLVM IR generator
 */
function LLVM () {
  this.builder = new ASTBuilder();
}

LLVM.prototype = {
  /**
   * Overall file
   */
  handleTop: function (blocks) {
    return blocks
      .map(function (b) { return b.options.globalCode; })
      .join('');
  },

  /**
   * Single function definition
   */
  handleBlock: function (name, statements) {
    return this.builder.nodeList(statements).defineFunction(name);
  },

  /**
   * Return statement
   */
  handleReturnStatement: function (expr) {
    return expr.addStatement('ret ' + expr.type + ' ' + expr.value);
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
    return this.builder.combineWithOperator('add', left, right);
  },
  handleMul: function (left, right) {
    return this.builder.combineWithOperator('mul', left, right);
  },

  /**
   * Function call
   */
  handleFunctionCall: function (fName, fArgs) {
    // Cast arguments as needed
    fArgs = fArgs.map(function (arg) {
      if (arg.type !== 'i8*') {
        return arg.addExpression('i8*', 'getelementptr ' + arg.type + '* ' + arg.value + ', i64 0, i64 0');
      } else {
        return arg;
      }
    });

    // Call
    return this.builder.nodeList(fArgs).addExpression(
      'i32',
      'call i32 @' + fName + '(' + fArgs.map(function (b) { return b.type + ' ' + b.value; }).join(', ') + ')'
    );
  },

  // ------------------------------------------------ //

  /**
   * If and If/Else block
   */
  handleIfBlock: function (test, pass, fail) {
    // If
    var contLabel = this.builder.nextVarName('Continue');
    var falseBlock = false;

    pass = this.builder.nodeList(pass);

    var trueBlock = pass.addStatement('br label ' + contLabel).labelBlock('IfTrue');

    // Fail block handling for If..Else
    if (fail) {
      fail = this.builder.nodeList(fail);
      falseBlock = fail.addStatement('br label ' + contLabel).labelBlock('IfFalse');
    }

    var branch = test.addStatement('br i1 ' + test.value + ', label ' + trueBlock.blockLabel + ', label ' +
      (fail ? falseBlock.blockLabel : contLabel));

    return branch.merge(trueBlock).merge(falseBlock).labelBlockEnd(contLabel);
  },

  /**
   * For loop
   */
  handleForLoop: function (variable, loopSource, block) {
    // TODO: Only range is handled
    var startValue = null;
    var endValue = null;
    if (loopSource.type === '*range') {
      startValue = loopSource.value.start;
      endValue = loopSource.value.end;
    }

    var loopLabel = this.builder.nextVarName('Loop');
    var contLabel = this.builder.nextVarName('Continue');
    var nextVar = this.builder.nextVarName('nextvar');

    // Start of loop - a labelled block that breaks to the loop
    var entry = this.builder
      .statement('br label ' + loopLabel)
      .labelBlock('Entry');

    entry = this.builder.statement('br label ' + entry.blockLabel).merge(entry);

    // Loop block start - value is the Phi expression: our incrementor variable
    var loop = startValue
      .merge(endValue)
      .addExpression('i32', 'phi i32 [ ' + startValue.value + ', ' + entry.blockLabel + ' ], [ ' + nextVar + ', ' + loopLabel + ' ]', 'i')
      .labelBlock(loopLabel);

    // Test and break
    var test = this.builder
      .expression('i1', 'icmp uge ' + endValue.type + ' ' + nextVar + ', ' + endValue.value, 'break');
    test = test
      .addStatement('br i1 ' + test.value + ', label ' + contLabel + ', label ' + loop.blockLabel);

    loop = loop
      .merge(this.builder.nodeList(block))
      .addExpression('i32', 'add i32 ' + loop.value + ', 1', nextVar);

    // Join it all together!
    return entry.merge(loop).merge(test).labelBlockEnd(contLabel);
  },

  // ------------------------------------------------ //

  /**
   * Array literal - range expression x..y
   */
  handleIntRange: function (start, end) {
    return this.builder.literal('*range', { start: start, end: end });
  },

  /**
   * Array literal - expression [x, y, z]
   */
  handleArrayDefinition: function (items) {
    return this.builder.literal('*list', items);
  },

  // ------------------------------------------------ //

  /**
   * String literals
   */
  handleString: function (value) {
    var type = '[' + (value.length + 1) + ' x i8]';
    return this.builder.globalConst(
      type,
      'private unnamed_addr constant ' + type + ' c"' +
        value.replace(/[\\'"]/g, '\\$&').replace(/\n/g, '\\0A').replace(/\r/g, '\\00') + '\\00"'
    );
  },

  handleFloat: function (value) {
    return this.builder.literal('float', value);
  },

  handleInt: function (value) {
    return this.builder.literal('i32', value);
  },

  handleUse: function (name) {
    return this.builder.globalDeclare('declare i32 @' + name + '(i8* nocapture) nounwind');
  }
};

module.exports = LLVM;
