/**
 * Merge together all the executable code in the array of expressions,
 * setting the expression value / type to that of the last expression in the list.
 */

var ASTBuilder = require('./ASTBuilder');

/**
 * LLVM IR generator
 */
function LLVMCompiler (fnDefs) {
  this.builder = new ASTBuilder();
  this.fnDefs = fnDefs;
}

LLVMCompiler.prototype.generateLLVMCode = function (ast) {
  return this.handle(ast);
};

/**
 * Return a compiler helper for a particular method
 * Ensures local variable declarations stay local
 */
LLVMCompiler.prototype.forMethod = function (methodName) {
  var self = this;
  var l = new LLVMCompiler();
  l.builder = this.builder;
  l.getFnDef = function (name) { return self.getFnDef(name); };
  l.argSpecFromFnDef = function (fnDef, argCallback) { return self.argSpecFromFnDef(fnDef, argCallback); };
  return l;
};

/**
 * Return a function definition for the given name
 */
LLVMCompiler.prototype.getFnDef = function (name) {
  return this.fnDefs[name];
};

LLVMCompiler.prototype.argSpecFromFnDef = function (fnDef, argCallback) {
  var self = this;

  if (fnDef.args.nodeType === 'Empty') return '';

  var argSpec = fnDef.args.map(function (arg) {
    var type = self.handle(arg).type;
    if (argCallback) type = argCallback(arg, type);
    return type;
  }).join(', ');
  if (fnDef.varArgs) argSpec += ', ...';
  return argSpec;
};

// --------------------------------------------------------------------------- //

/**
 * Handle the given node
 * Dispatches to a method 'handle' + nodeType
 */
LLVMCompiler.prototype.handle = function (ast) {
  if (!ast.nodeType) {
    throw new Error('Bad AST passed to handle(): ' + JSON.stringify(ast));
  }
  if (typeof this['handle' + ast.nodeType] === 'function') {
    var result = this['handle' + ast.nodeType](ast);
    if (!result) {
      throw new Error('LLVMCompiler.handle' + ast.nodeType + ' didn\'t return a value');
    }
    return result;

  } else {
    throw new Error('LLVMCompiler.handle' + ast.nodeType + '() not defined.');
  }
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
  // Log the fnDef for those who call it
  this.fnDefs[ast.name] = ast;

  // Process args adding flags to pointer type
  var argList = this.argSpecFromFnDef(ast, function (arg, type) {
    return (type.match(/\*$/) ? (type + ' noalias nocapture') : type);
  });

  return this.builder.globalDeclare('declare i32 @' + ast.name + '(' + argList + ') nounwind');
};

/**
 * Single function definition
 */
LLVMCompiler.prototype.handleFnDef = function (ast) {
  return this.forMethod(ast.name).handle(ast.statements).defineFunction(
    ast.name,
    this.argSpecFromFnDef(ast, function (arg, type) {
      return type + ' %' + arg.name;
    })
  );
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

  var iterator;
  // TODO: Better empty check
  if (ast.variable.nodeType !== 'Empty') {
    if (ast.variable.type.nodeType === 'Empty') {
      throw new SyntaxError("Can't  determine type of " + ast.variable.toString());
    }
    iterator = this.handle(ast.variable);
  } else {
    iterator = this.builder.literal('i32', '%i');
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
    .addExpression(iterator.type, 'phi ' + iterator.type +
      ' [ ' + startValue.value + ', ' + entry.blockLabel +
      ' ], [ ' + nextVar + ', ' + loopLabel + ' ]', iterator.value)
    .labelBlock(loopLabel);

  // Test and break
  var test = this.builder
    .expression('i1', 'icmp ugt ' + endValue.type + ' ' + nextVar + ', ' + endValue.value, 'break');
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

  // Get the function definition
  var fnDef = this.getFnDef(ast.name);
  if (!fnDef) {
    throw new SyntaxError('Can\'t find function ' + ast.name);
  }

  // Cast arguments as needed
  var fArgs = ast.args.map(function (argAst, i) {
    // Validate source
    if (!argAst.nodeType) {
      throw new SyntaxError('Bad argument AST: ' + argAst);
    }

    // expectType not set for varArgs
    var expectedType = fnDef.args.items[i] ? llvm.handle(fnDef.args.items[i]).type : null;
    var arg = llvm.handle(argAst);
    if (expectedType && arg.type !== expectedType) {
      // Cast i8 const array as i8* pointer
      if (expectedType === 'i8*' && arg.type.match(/^\[[0-9]+ x i8\]/)) {
        return arg.addExpression('i8*', 'getelementptr ' + arg.type + '* ' + arg.value + ', i64 0, i64 0');
      } else {
        throw new SyntaxError('Can\'t cast "' + arg.type.toString() + ' to "' + expectedType + '" (arg ' +
          (i + 1) + ' of ' + ast.name + ')');
      }
    } else {
      return arg;
    }
  });

  var fnArgSpec = '(' + this.argSpecFromFnDef(fnDef) + ')*';

  // Call
  return this.builder.nodeList(fArgs).addExpression(
    'i32',
    'call i32 ' + fnArgSpec + ' @' + ast.name + '(' + fArgs.map(function (b) { return b.type + ' ' + b.value; }).join(', ') + ')'
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
    '/': 'div',
    '+': 'add',
    '-': 'sub',

    '==': 'icmp eq',
    '!=': 'icmp ne',
    '<': 'icmp slt',
    '>': 'icmp sgt',
    '<=': 'icmp sle',
    '>=': 'icmp sge',

    '&&': 'and',
    '||': 'or'
  };

  return this.builder.combineWithOperator(
    opMap[ast.op],
    this.handle(ast.type).type,
    this.handle(ast.left),
    this.handle(ast.right)
  );
};

/**
 * Represents a buffer that can be loaded by another function call (usually a c-library call)
 */
LLVMCompiler.prototype.handleVariable = function (ast) {
  if (ast.type.nodeType === 'Empty') {
    throw new SyntaxError('Variable without types referneced; has the InferTypes transform executed? ' +
      ast.toString());
  }

  // TODO: Check against a local variable registry
  var llName = '%' + ast.name;

  return this.builder.literal(this.handle(ast.type).type, llName);
};

/**
 * Represents a buffer that can be loaded by another function call (usually a c-library call)
 */
LLVMCompiler.prototype.handleBuffer = function (ast) {
  // Buffers only work on variables
  if (ast.variable.nodeType !== 'Variable') {
    throw new SyntaxError('A Buffer can only be created for a Variable');
  }

  // Buffers only work for strings at the moment
  if (ast.variable.type.type !== 'string') {
    throw new SyntaxError('Can\'t create a Buffer for variable of type ' + ast.variable.type.toString());
  }

  var llVar = this.handle(ast.variable);
  return this.builder.expression(llVar.type, 'alloca i8, i32 ' + ast.length, llVar.value);
};

/**
 * A type reference
 */
LLVMCompiler.prototype.handleType = function (ast) {
  var typeMap = {
    'string': 'i8*',
    'buffer': 'i8*',
    'int': 'i32',
    'bool': 'i1'
  };

  if (!typeMap[ast.type]) {
    throw new SyntaxError('Unrecognised type "' + ast.toString() + '"');
  }

  return this.builder.literal(typeMap[ast.type], null);
};

/**
 * Handle a literal - simple type, array or range
 */
LLVMCompiler.prototype.handleLiteral = function (ast) {
  var llvm = this;
  switch (ast.type.type) {
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

    case 'bool':
      return this.builder.literal('i1', ast.value);

    default:
      throw new SyntaxError('Bad type in AST: "' + ast.type + '"');
  }
};

module.exports = LLVMCompiler;
