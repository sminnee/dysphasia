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
 * Intends a string value by 2 spaces - used to format generated code
 */
function indent (str) {
  return '  ' + str.replace(/\n(.)/g, '\n  $1');
}

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
 * Return the final statement in the list as a string
 */
ASTNode.prototype.getLastStatement = function () {
  if (this.options.code.match(/(^|\n)([^\n]+)\n?$/)) {
    return RegExp.$2;
  } else {
    throw SyntaxError("Can't find last statement in:\n" + this.options.code);
  }
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
ASTNode.prototype.defineFunction = function (name, args) {
  if (!args) args = '';
  return new ASTNode(this.builder, {
    globalCode: this.options.globalCode + 'define i32 @' + name + '(' + args + ') {\n' + indent(this.options.code) + '}\n'
  });
};

module.exports = ASTNode;
