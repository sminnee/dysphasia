/**
 * Merge together all the executable code in the array of expressions,
 * setting the expression value / type to that of the last expression in the list.
 */

var ASTBuilder = require('./ASTBuilder');
var Dys = require('./DysAST');

/**
 * LLVM IR generator
 */
function LLVMCompiler () {
  this.builder = new ASTBuilder();
  this.fnDefs = {};
  this.varDefs = {};
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
  l.argSpecFromFnDef = function (name) { return self.argSpecFromFnDef(name); };
  return l;
};

/**
 * Return a function definition for the given name
 */
LLVMCompiler.prototype.getFnDef = function (name) {
  return this.fnDefs[name];
};

LLVMCompiler.prototype.argSpecFromFnDef = function (fnDef) {
  var self = this;

  var argSpec = fnDef.args.map(function (arg) {
    return self.handle(arg).type;
  }).join(', ');
  if (fnDef.varArgs) argSpec += ', ...';
  return argSpec;
};

LLVMCompiler.prototype.declareVariable = function (name, type) {
  this.varDefs[name] = type;
};
LLVMCompiler.prototype.getVariable = function (name) {
  return this.varDefs[name];
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
  var self = this;

  // Log the fnDef for those who call it
  this.fnDefs[ast.name] = ast;

  // More complex argSpec than that given by getArgSpecFromFnDef as it has the 'noalias nocapture' flags
  var argList = ast.args.map(function (arg) {
    var type = self.handle(arg).type;
    // Pointers have some flags
    if (type.match(/\*$/)) type += ' noalias nocapture';
    return type;
  }).join(', ');
  if (ast.varArgs) argList += ', ...';

  return this.builder.globalDeclare('declare i32 @' + ast.name + '(' + argList + ') nounwind');
};

/**
 * Single function definition
 */
LLVMCompiler.prototype.handleFnDef = function (ast) {
  return this.forMethod(ast.name).handle(ast.statements).defineFunction(ast.name);
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
        throw new SyntaxError('Can\'t cast "' + arg.type + ' to "' + expectedType + '" (arg ' +
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
 * Return statement
 */
LLVMCompiler.prototype.handleVariableDeclaration = function (ast) {
  this.declareVariable(ast.variable.name, ast.type.type);
  return this.builder.noop();
};

/**
 * Expression
 */
LLVMCompiler.prototype.handleStrConcat = function (ast) {
  var self = this;

  // TO DO: strConcat will need to be checked for uniqueness against a local variable registrys
  var buffer = new Dys.Buffer(new Dys.Variable('strConcat', 'string'), 100);

  // Convert into an sprintf call
  var formatMap = {
    'int': '%i',
    'float': '%f',
    'string': '%s'
  };

  var snprintfArgs = [ buffer, new Dys.Literal(100, 'int'), new Dys.Literal('', 'string') ];

  ast.items.forEach(function (item) {
    // Look up variable type
    // TODO: This should probably be a pre-pass on the the AST
    if (item.nodeType === 'Variable' && !item.type) {
      var type = self.getVariable(item.name);
      if (!type) {
        throw new SyntaxError('Undeclared variable "' + item.name + '"');
      }
      item.type = type;
    }

    // Compile string literals directly into the sprintf call
    if (item.type === 'string' && item.nodeType === 'Literal') {
      snprintfArgs[2].value += item.value;

    } else if (formatMap[item.type]) {
      snprintfArgs[2].value += formatMap[item.type];
      snprintfArgs.push(item);

    } else {
      throw new SyntaxError('Can\'t embed in string: ' + JSON.stringify(item));
    }
  });

  // Rewrite as AST: Call snprintf, populating the myVar variable and then return that variable
  var newAST = new Dys.List([
    new Dys.FnCall('snprintf', snprintfArgs),
    buffer.variable
  ]);

//    new Dys.UseStatement('snprintf', new Dys.List([ new Dys.Type('buffer'), new Dys.Type('string'), ]))
//    new Dys.FnCall('snprintf', sprintfArgs),
//  ]);

  return this.handle(newAST);
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
 * Represents a buffer that can be loaded by another function call (usually a c-library call)
 */
LLVMCompiler.prototype.handleVariable = function (ast) {
  var type = ast.type ? ast.type : this.getVariable(ast.name);

  var typeMap = {
    'string': 'i8*',
    'buffer': 'i8*',
    'int': 'i32'
  };

  // TODO: Check against a local variable registry
  var llName = '%' + ast.name;

  return this.builder.literal(typeMap[type], llName);
};

/**
 * Represents a buffer that can be loaded by another function call (usually a c-library call)
 */
LLVMCompiler.prototype.handleBuffer = function (ast) {
  // Buffers only work on variables
  if (ast.variable.nodeType !== 'Variable') {
    throw new SyntaxError('A Buffer can only be createad for a Variable');
  }

  // Buffers only work for strings at the moment
  if (ast.variable.type !== 'string') {
    throw new SyntaxError('Can\'t create a Buffer for variable of type ' + ast.type);
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
    'int': 'i32'
  };

  if (!typeMap[ast.type]) {
    throw new SyntaxError('Unrecognised type "' + ast.type + '"');
  }

  return this.builder.literal(typeMap[ast.type], null);
};

/**
 * Handle a literal - simple type, array or range
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
