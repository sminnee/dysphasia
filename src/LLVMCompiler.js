/**
 * Merge together all the executable code in the array of expressions,
 * setting the expression value / type to that of the last expression in the list.
 */

var ASTBuilder = require('./ASTBuilder');

/**
 * LLVM IR generator
 */
function LLVMCompiler () {
  this.builder = new ASTBuilder();
  this.variableDefinitions = {};
}

LLVMCompiler.prototype.generateLLVMCode = function (ast) {
  return this.handle(ast);
};

LLVMCompiler.prototype.setVariable = function (name, expr) {
  this.variableDefinitions[name] = expr;
};

LLVMCompiler.prototype.getVariable = function (name) {
  return this.variableDefinitions[name];
};

/**
 * Return a compiler helper for a particular method
 * Ensures local variable declarations stay local
 */
LLVMCompiler.prototype.forMethod = function () {
  var self = this;
  var l = new LLVMCompiler();
  l.builder = this.builder;
  l.getFnDef = function (name) { return self.getFnDef(name); };
  l.argSpecFromFnDef = function (fnDef, argCallback) { return self.argSpecFromFnDef(fnDef, argCallback); };
  return l;
};

LLVMCompiler.prototype.argSpecFromFnDef = function (fnDef, argCallback) {
  var self = this;

  if (fnDef.args.isEmpty()) {
    return '';
  }

  var argSpec = fnDef.args.map(function (arg) {
    var type;
    switch (arg.nodeType) {
      case 'Type':
        type = self.handle(arg).type;
        break;

      case 'List':
        console.log(fnDef);
        console.log(fnDef.args.items);
        throw Error('Can\'t process a list as an argument');

      case 'Empty':
        throw Error('Can\'t have an empty arguement');

      default:
        if (arg.type.nodeType === 'Empty') {
          console.log(fnDef.toString());
          throw new Error('Empty argument, can\'t determine argSpec of ' + arg.toString());
        }
        type = self.handle(arg.type).type;
    }

    if (argCallback) {
      type = argCallback(arg, type);
    }

    return type;
  }).join(', ');
  if (fnDef.varArgs) {
    argSpec += ', ...';
  }
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
  var contLabel = null;
  var falseBlock = false;

  var trueBlock = this.handle(ast.pass);

  // Only add a break statement if we haven't already returned
  if (!trueBlock.getLastStatement().match(/^ret /)) {
    if (!contLabel) {
      contLabel = this.builder.nextVarName('Continue');
    }
    trueBlock = trueBlock.addStatement('br label ' + contLabel);
  }
  trueBlock = trueBlock.labelBlock('IfTrue');

  // Fail block handling for If..Else
  if (ast.fail.nodeType !== 'Empty') {
    falseBlock = this.handle(ast.fail);
    if (!falseBlock.getLastStatement().match(/^ret /)) {
      if (!contLabel) {
        contLabel = this.builder.nextVarName('Continue');
      }
      falseBlock = falseBlock.addStatement('br label ' + contLabel);
    }
    falseBlock = falseBlock.labelBlock('IfFalse');
  } else {
    if (!contLabel) {
      contLabel = this.builder.nextVarName('Continue');
    }
  }

  var test = this.handle(ast.test);
  var branch = test.addStatement('br i1 ' + test.value + ', label ' + trueBlock.blockLabel + ', label ' +
    (falseBlock ? falseBlock.blockLabel : contLabel));

  var result = branch.merge(trueBlock).merge(falseBlock);
  if (contLabel) {
    result = result.labelBlockEnd(contLabel);
  }
  return result;
};

/**
 * For loop
 */
LLVMCompiler.prototype.handleForLoop = function (ast) {
  // var variable = this.handle(ast.variable);
  var loopSource = this.handle(ast.loopSource);
  var block = this.handle(ast.statements);

  var startValue = null;
  var endValue = null;
  if (loopSource.options.start && loopSource.options.end) {
    startValue = loopSource.options.start;
    endValue = loopSource.options.end;
  } else {
    throw new SyntaxError('Can\'t iterate on loopSource without start & end: ' + loopSource);
  }

  var iterator = this.builder.literal('i32', '%i');
  var boundVar = this.builder.noop();

  // TODO: Better empty check
  if (ast.variable.nodeType !== 'Empty') {
    if (ast.variable.type.isEmpty()) {
      throw new SyntaxError("Can't  determine type of " + ast.variable.toString());
    }

    boundVar = this.handle(ast.variable);
    // Simple assignment of the index
    if (loopSource.type === '*range') {
      iterator = boundVar;

    // Look up array item
    } else {
      var ptrVar = this.builder.expression('i32*', 'getelementptr inbounds ' + loopSource.type + '* ' + loopSource.value +
        ', i32 0, ' + iterator.type + ' ' + iterator.value, 'ptr');
      boundVar = ptrVar.addExpression('i32', 'load i32* ' + ptrVar.value, boundVar.value);
    }
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
  var loop = loopSource
    .merge(startValue)
    .merge(endValue)
    .addExpression(iterator.type, 'phi ' + iterator.type +
      ' [ ' + startValue.value + ', ' + entry.blockLabel +
      ' ], [ ' + nextVar + ', ' + loopLabel + ' ]', iterator.value)
    .merge(boundVar)
    .labelBlock(loopLabel);

  // Test and break
  var test = this.builder
    .expression('i1', 'icmp ugt ' + endValue.type + ' ' + nextVar + ', ' + endValue.value, 'break');
  test = test
    .addStatement('br i1 ' + test.value + ', label ' + contLabel + ', label ' + loop.blockLabel);

  loop = loop
    .merge(block)
    .addExpression('i32', 'add i32 ' + iterator.value + ', 1', nextVar);

  // Join it all together!
  return entry.merge(loop).merge(test).labelBlockEnd(contLabel);
};

/**
 * Function call
 */
LLVMCompiler.prototype.handleFnCall = function (ast) {
  var llvm = this;

  var fnDef = ast;
  var fArgs;

  // Parse a signature (needed for string conversion and var args)
  if (!ast.signature.isEmpty()) {
    fnDef = ast.signature;

    // Cast arguments as needed
    fArgs = ast.args.map(function (argAst, i) {
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

  // Simply pass the arguments in
  } else {
    fArgs = ast.args.map(function (argAst) {
      return llvm.handle(argAst);
    });
  }

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
 * Variable assignment
 */
LLVMCompiler.prototype.handleAssignment = function (ast) {
  if (ast.type.isEmpty()) {
    throw new SyntaxError('Variable without types referneced; has the InferTypes transform executed? ' +
      ast.toString());
  }

  // TODO: Check against a local variable registry
  var llName = '%' + ast.variable.name;
  var expr = this.handle(ast.expression);

  this.setVariable(llName, expr.with({ code: '', globalCode: '' }));

  return expr;
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

  var left = this.handle(ast.left);
  var right = this.handle(ast.right);
  var outputType = this.handle(ast.type).type;

  if (left.type !== right.type) {
    throw new SyntaxError("Types don't match: " + ast.toString());
  }

  return left.merge(right).addExpression(
    outputType,
    opMap[ast.op] + ' ' + left.type + ' ' + left.value + ', ' + right.value
  );
};

/**
 *
 */
LLVMCompiler.prototype.handleVariable = function (ast) {
  if (ast.type.isEmpty()) {
    throw new SyntaxError('Variable without types referneced; has the InferTypes transform executed? ' +
      ast.toString());
  }

  var llName = '%' + ast.name;

  var expr = this.getVariable(llName);
  if (expr) {
    return expr;
  } else {
    var variable = this.handle(ast.type);
    variable.options.value = llName;
    return variable;
  }
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
  var type = this.builder.literal(null, null);

  switch (ast.type) {
    case 'array':
      if (ast.length) {
        type.options.type = '[' + ast.length + ' x ' + this.handle(ast.subtype).type + ']';
        type.options.length = ast.length;
        type.options.start = this.builder.literal('i32', 0);
        type.options.end = this.builder.literal('i32', ast.length - 1);
      } else {
        type.options.type = this.handle(ast.subtype).type + '*';
      }
      break;

    case 'range':
      type.options.type = '*range';
      break;

    case 'string':
      if (ast.length) {
        type.options.type = '[' + (ast.length + 1) + ' x i8]';
      } else {
        type.options.type = 'i8*';
      }
      break;

    default:
      var typeMap = {
        'string': 'i8*',
        'buffer': 'i8*',
        'int': 'i32',
        'float': 'float',
        'bool': 'i1'
      };

      if (!typeMap[ast.type]) {
        throw new SyntaxError('Unrecognised type "' + ast.toString() + '"');
      }
      type.options.type = typeMap[ast.type];
  }

  return type;
};

/**
 * Handle a literal - simple type, array or range
 */
LLVMCompiler.prototype.handleLiteral = function (ast) {
  var llvm = this;
  var val = null;

  var type = this.handle(ast.type);

  switch (ast.type.type) {
    case 'array':
      var literal = '[' + ast.value.map(function (astItem) {
        var item = llvm.handle(astItem);
        if (item.code) throw new SyntaxError('Can\'t put ' + astItem.toString() + ' in an array literal');
        return item.type + ' ' + item.value;
      }).join(', ') + ']';

      val = this.builder.globalConst(
        type.type,
        'private unnamed_addr constant ' + type.type + literal
      );
      val.options.start = type.options.start;
      val.options.end = type.options.end;
      return val;

    case 'range':
      type.options.start = this.handle(ast.value.start);
      type.options.end = this.handle(ast.value.end);
      return type;

    case 'string':
      return this.builder.globalConst(
        type.type,
        'private unnamed_addr constant ' + type.type + ' c"' +
          ast.value.replace(/[\\'"]/g, '\\$&').replace(/\n/g, '\\0A').replace(/\r/g, '\\00') + '\\00"'
      );

    default:
      type.options.value = ast.value;
      return type;
  }
};

module.exports = LLVMCompiler;
