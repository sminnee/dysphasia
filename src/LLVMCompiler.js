/**
 * Merge together all the executable code in the array of expressions,
 * setting the expression value / type to that of the last expression in the list.
 */

var ASTBuilder = require('../ASTBuilder');

/**
 * LLVM IR generator
 */
function LLVMCompiler () {
  this.builder = new ASTBuilder();
}

LLVMCompiler.prototype.generateLLVMCode = function (ast) {
  return this.handle(ast);
};

/**
 * Handle the given node
 * Dispatches to a method 'handle' + nodeType
 */
LLVMCompiler.prototype.handle = function (ast) {
  return this['handle' + ast.nodeType](ast);
};

/**
 * Overall file
 */
LLVMCompiler.prototype.handleFile = function (ast) {
  return this.handle(ast.statements).options.globalCode;
};

/**
 * List of statemtns
 */
LLVMCompiler.prototype.handleList = function (ast) {
  var llvm = this;
  return this.builder.nodeList(ast.items.map(function (i) { return llvm.handle(i); }));
};

/**
 * Use statement
 */
LLVMCompiler.prototype.handleUseStatement = function (ast) {
  return this.builder.globalDeclare('declare i32 @' + ast.name + '(i8* nocapture) nounwind');
};

/**
 * Single function definition
 */
LLVMCompiler.prototype.handleFnDef = function (ast) {
  return this.handle(ast.statements).defineFunction(ast.name);
};

/**
 * If and If/Else block
 */
LLVMCompiler.prototype.handleIfBlock = function (ast) {
  // If
  var contLabel = this.builder.nextVarName('Continue');
  var falseBlock = false;

  var pass = this.handle(ast.pass);

  var trueBlock = pass.addStatement('br label ' + contLabel).labelBlock('IfTrue');

  // Fail block handling for If..Else
  var fail = false;
  if (ast.fail.nodeType !== 'Empty') {
    fail = this.handle(ast.fail);
    falseBlock = fail.addStatement('br label ' + contLabel).labelBlock('IfFalse');
  }

  var test = this.handle(ast.test);
  var branch = test.addStatement('br i1 ' + test.value + ', label ' + trueBlock.blockLabel + ', label ' +
    (fail ? falseBlock.blockLabel : contLabel));

  return branch.merge(trueBlock).merge(falseBlock).labelBlockEnd(contLabel);
};

/**
 * For loop
 */
LLVMCompiler.prototype.handleForLoop = function (ast) {
  // var variable = this.handle(ast.variable);
  var loopSource = this.handle(ast.loopSource);
  var block = this.handle(ast.statements);

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
    .merge(block)
    .addExpression('i32', 'add i32 ' + loop.value + ', 1', nextVar);

  // Join it all together!
  return entry.merge(loop).merge(test).labelBlockEnd(contLabel);
};

/**
 * Function call
 */
LLVMCompiler.prototype.handleFnCall = function (ast) {
  var llvm = this;
  // Cast arguments as needed
  var fArgs = ast.args.map(function (ast) {
    var arg = llvm.handle(ast);
    if (arg.type !== 'i8*') {
      return arg.addExpression('i8*', 'getelementptr ' + arg.type + '* ' + arg.value + ', i64 0, i64 0');
    } else {
      return arg;
    }
  });

  // Call
  return this.builder.nodeList(fArgs).addExpression(
    'i32',
    'call i32 @' + ast.name + '(' + fArgs.map(function (b) { return b.type + ' ' + b.value; }).join(', ') + ')'
  );
};

/**
 * Return statement
 */
LLVMCompiler.prototype.handleReturnStatement = function (ast) {
  var expr = this.handle(ast.expression);
  return expr.addStatement('ret ' + expr.type + ' ' + expr.value);
};

/**
 * Expression
 */
LLVMCompiler.prototype.handleOp = function (ast) {
  var opMap = {
    '*': 'mul',
    '+': 'add'
  };
  return this.builder.combineWithOperator(opMap[ast.op], this.handle(ast.left), this.handle(ast.right));
};

/**
 * Array literal - range expression x..y
 */
LLVMCompiler.prototype.handleLiteral = function (ast) {
  var llvm = this;
  switch (ast.type) {
    case 'array':
      return this.builder.literal(
        '*list',
        ast.value.map(function (i) { return llvm.handle(i); })
      );

    case 'range':
      return this.builder.literal(
        '*range',
        { start: this.handle(ast.value.start), end: this.handle(ast.value.end) }
      );

    case 'string':
      var type = '[' + (ast.value.length + 1) + ' x i8]';
      return this.builder.globalConst(
        type,
        'private unnamed_addr constant ' + type + ' c"' +
          ast.value.replace(/[\\'"]/g, '\\$&').replace(/\n/g, '\\0A').replace(/\r/g, '\\00') + '\\00"'
      );

    case 'float':
      return this.builder.literal('float', ast.value);

    case 'int':
      return this.builder.literal('i32', ast.value);

    default:
      throw new SyntaxError('Bad type in AST: "' + ast.type + '"');
  }
};

module.exports = LLVMCompiler;
