/**
 * Merge together all the executable code in the array of expressions,
 * setting the expression value / type to that of the last expression in the list.
 */

/**
 * An LLVM AST node
 */
function ASTNode (builder, options) {
  this.builder = builder;
  this.options = options;
  if (!this.options.code) this.options.code = '';
  if (!this.options.globalCode) this.options.globalCode = '';
}

Object.defineProperties(ASTNode.prototype, {
  value: {
    get: function () {
      return this.options.value;
    }
  },
  type: {
    get: function () {
      return this.options.type;
    }
  },
  blockLabel: {
    get: function () {
      return this.options.label;
    }
  }
});

/**
 * Push another expression onto the end of this expression, as a subsequent statement
 */
ASTNode.prototype.merge = function (next) {
  // Passing null to merge is okay - it's a no-op
  if (!next) return this;

  // TODO: clone next
  next.options.code = this.options.code + next.options.code;
  next.options.globalCode = this.options.globalCode + next.options.globalCode;
  return next;
};

/**
 * Adds an LLVM statement to the base, clearing the result
 */
ASTNode.prototype.addStatement = function (statement) {
  // TODO: this isn't very efficient
  return this.builder.nodeList([
    this,
    new ASTNode(this.builder, {
      code: statement + '\n'
    })
  ]);
};

/**
 * Adds an LLVM expression to the base, assigning the result to a new variable
 */
ASTNode.prototype.addExpression = function (type, expression, hint) {
  if (!hint) hint = 'var';
  var varName = this.builder.nextVarName(hint);

  return this.merge(new ASTNode(this.builder, {
    code: varName + ' = ' + expression + '\n',
    value: varName,
    type: type
  }));
};

/**
 * Label the statements in this ASTNode as a block
 * @param A hint, or if it starts with %, an exact block name
 */
ASTNode.prototype.labelBlock = function (label) {
  // If the label starts with % then we assume it has been previously generated, otherwise treat as a hint
  var labelName = (label[0] === '%') ? label : this.builder.nextVarName(label);

  this.options.code = labelName.substr(1) + ':' + '\n' + indent(this.options.code);
  this.options.label = labelName;

  return this;
};

/**
 * Add a label to the end of the block, effectively labelling the next block
 */
ASTNode.prototype.labelBlockEnd = function (label) {
  var labelName = (label[0] === '%') ? label : this.builder.nextVarName(label);

  this.options.code += labelName.substr(1) + ':' + '\n';

  return this;
};

/**
 * Turn the expressions into the body of a function
 */
ASTNode.prototype.defineFunction = function (name) {
  return new ASTNode(this.builder, {
    globalCode: this.options.globalCode + 'define i32 @' + name + '() {\n' + indent(this.options.code) + '}\n'
  });
};

/**
 * An AST Builder
 */
function ASTBuilder () {
  this.varNum = 0;
}

ASTBuilder.prototype.nextVarName = function (prefix) {
  // If the hint starts with % then assume it has been a previously generate variable
  if (prefix[0] === '%') return prefix;
  this.varNum++;
  return '%' + prefix + this.varNum;
};

ASTBuilder.prototype.nextGlobalVarName = function (prefix) {
  this.varNum++;
  return '@' + prefix + this.varNum;
};

/**
 * Return a node for a literal of the given type
 */
ASTBuilder.prototype.literal = function (type, value) {
  return new ASTNode(this, {type: type, value: value});
};

/**
 * Return a node for a literal of the given type
 */
ASTBuilder.prototype.statement = function (code) {
  return new ASTNode(this, {}).addStatement(code);
};

/**
 * Return an expression
 */
ASTBuilder.prototype.expression = function (type, value, hint) {
  return new ASTNode(this, {}).addExpression(type, value, hint);
};

/**
 * Combine 2 branches with an appropriate llvm operator - used for add, mul, etc
 */
ASTBuilder.prototype.combineWithOperator = function (opName, left, right) {
  if (left.type !== right.type) {
    throw new SyntaxError('Type mismatch: ' + left.type + ', ' + right.type);
  }

  return left.merge(right).addExpression(
    left.type,
    opName + ' ' + left.type + ' ' + left.value + ', ' + right.value
  );
};

/**
 * Return a new global declaration
 */
ASTBuilder.prototype.globalDeclare = function (content) {
  return new ASTNode(this, {globalCode: content + '\n'});
};

ASTBuilder.prototype.globalConst = function (type, definition) {
  var varName = this.nextGlobalVarName('str');
  return new ASTNode(this, {
    globalCode: varName + ' = ' + definition + '\n',
    value: varName,
    type: type
  });
};

/**
 * Return a node that combines an array of nodes by iterative merge
 */
ASTBuilder.prototype.nodeList = function (expressions) {
  var combined = null;

  expressions.forEach(function (e) {
    if (combined === null) {
      combined = e;
    } else {
      combined = combined.merge(e);
    }
  });

  return combined;
};

/**
 * LLVM IR generator
 */
function LLVM () {
  this.builder = new ASTBuilder();
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
