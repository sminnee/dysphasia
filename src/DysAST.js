/**
 * Classes defining the dypashaia AST
 */

/**
 * Intends a string value by 2 spaces
 */
function indent (str) {
  return '  ' + str.replace(/\n(.)/g, '\n  $1');
}

/**
 * Validate a single item, throw a SyntaxError if there is a bad one
 */
function validateItem (item, className) {
  if (typeof className !== 'string') className = 'List';

  if (!item || !item.nodeType) {
    throw new SyntaxError('Can\'t add item to Dys.' + className + ': ' + item);
  }
}

/**
 * Validate an array of items, throw a SyntaxError if there is a bad one
 * If singleItemAllowed is true, then a single item will also be valid
 */
function validateItems (items, singleItemAllowed) {
  if (items && items.nodeType && singleItemAllowed === true) {
    return true;
  }

  items.forEach(validateItem);
}

/**
 * A null value
 * We use this singleton to represent unset parameters for type consistency
 */
var Empty = {
  nodeType: 'Empty',
  toString: function () {
    return 'Empty';
  },
  transformChildren: function () {
    return Empty;
  }
};

/**
 * A Dysphasia file
 */
function File (statements) {
  this.nodeType = 'File';
  this.statements = statements;
}

File.prototype.toString = function () {
  return 'File (' + this.statements.toString() + ')';
};

File.prototype.transformChildren = function (transformer) {
  return new File(transformer(this.statements));
};

/**
 * An ordered list of AST nodes
 */
function List (items) {
  this.nodeType = 'List';
  validateItems(items);
  this.items = items.filter(function (item) { return item.nodeType !== 'Empty'; });
}

List.prototype.toString = function () {
  return '[\n' + indent(this.items.map(function (item) { return item.toString(); }).join('\n')) + '\n]';
};

List.prototype.transformChildren = function (transformer) {
  return new List(this.items.map(transformer));
};

List.prototype.map = function (callback) {
  return this.items.map(callback);
};

List.prototype.forEach = function (callback) {
  return this.items.forEach(callback);
};

List.prototype.concat = function (extra) {
  if (extra.nodeType === 'List') {
    return new List(this.items.concat(extra.items));

  } else {
    validateItems(extra, true);
    return new List(this.items.concat(extra));
  }
};

/**
 * A 'use' statement for importing external functions
 */
function UseStatement (name, type, args, varArgs) {
  this.nodeType = 'UseStatement';
  this.type = type;
  this.name = name;
  this.args = args;
  this.varArgs = varArgs;
}

UseStatement.prototype.toString = function () {
  var type = (this.type.nodeType === 'Empty') ? '' : (this.type.toString + ' ');
  return 'UseStatement ' + type + this.name + (this.varArgs ? ' var_args ' : ' ') + '(' +
    this.args.toString() + ')';
};

UseStatement.prototype.transformChildren = function (transformer) {
  return new UseStatement(this.name, transformer(this.type), transformer(this.args), this.varArgs);
};

/**
 * A function definition
 */
function FnDef (name, type, args, statements) {
  this.nodeType = 'FnDef';
  this.name = name;
  this.type = type;
  this.args = args;
  this.statements = statements;
}

FnDef.prototype.toString = function () {
  var type = (this.type.nodeType === 'Empty') ? '' : (this.type.toString() + ' ');
  return 'FnDef ' + type + this.name + ' (' +
    '\nargs: ' + this.args.toString() +
    '\nstatements: ' + this.statements.toString() + ')';
};

FnDef.prototype.transformChildren = function (transformer) {
  return new FnDef(this.name, transformer(this.type), transformer(this.args), transformer(this.statements));
};

/**
 * An if block
 */
function IfBlock (test, pass, fail) {
  this.nodeType = 'IfBlock';
  this.test = test;
  this.pass = pass;
  this.fail = fail;
}

IfBlock.prototype.toString = function () {
  return 'IfBlock (\ntest:\n' + indent(this.test.toString()) +
    '\npass: ' + this.pass.toString() +
    '\nfail: ' + this.fail.toString() + ')';
};

IfBlock.prototype.transformChildren = function (transformer) {
  return new IfBlock(transformer(this.test), transformer(this.pass), transformer(this.fail));
};

/**
 * A for loop
 */
function ForLoop (variable, loopSource, statements) {
  this.nodeType = 'ForLoop';
  this.variable = variable;
  this.loopSource = loopSource;
  this.statements = statements;
}

ForLoop.prototype.toString = function () {
  return 'ForLoop (\nvariable:\n' + indent(this.variable.toString()) +
    '\nloopSource:\n' + indent(this.loopSource.toString()) +
    '\nstatements: ' + this.statements.toString() + ')';
};

ForLoop.prototype.transformChildren = function (transformer) {
  return new ForLoop(transformer(this.variable), transformer(this.loopSource), transformer(this.statements));
};

/**
 * A function call
 */
function FnCall (name, args) {
  this.nodeType = 'FnCall';
  this.name = name;
  this.args = args;
  this.type = Empty;
}

FnCall.prototype.toString = function () {
  var type = (this.type.nodeType === 'Empty') ? '' : (this.type.toString() + ' ');
  return 'FnCall ' + type + this.name + ' (' + this.args.toString() + ')';
};

FnCall.prototype.transformChildren = function (transformer) {
  return new FnCall(this.name, transformer(this.args));
};

/**
 * A 'return' statement
 */
function ReturnStatement (expression, type) {
  this.nodeType = 'ReturnStatement';
  this.expression = expression;
  this.type = type ? type : Empty;
}

ReturnStatement.prototype.toString = function () {
  var typeStr = (this.type.nodeType === 'Empty') ? '' : (this.type.toString() + ' ');
  return 'ReturnStatement ' + typeStr + '(' + this.expression.toString() + ')';
};

ReturnStatement.prototype.transformChildren = function (transformer) {
  return new ReturnStatement(transformer(this.expression), transformer(this.type));
};

/**
 * A variable declaration
 */
function VariableDeclaration (variable, type) {
  if (type.nodeType !== 'Type') {
    throw new SyntaxError('VariableDeclaration type must be a Dys.Type object');
  }
  if (variable.nodeType !== 'Variable') {
    throw new SyntaxError('VariableDeclaration variable must be a Dys.Variable object');
  }

  this.nodeType = 'VariableDeclaration';
  this.type = type;
  this.variable = variable;
}

VariableDeclaration.prototype.toString = function () {
  return 'VariableDeclaration (' + this.type + ', ' + this.variable + ')';
};

VariableDeclaration.prototype.transformChildren = function (transformer) {
  return new VariableDeclaration(transformer(this.variable), transformer(this.type));
};

/**
 * A binary operation
 */
function Op (op, left, right, type) {
  this.nodeType = 'Op';
  this.op = op;
  this.left = left;
  this.right = right;
  this.type = type ? type : Empty;
}

Op.prototype.toString = function () {
  var typeStr = (this.type.nodeType === 'Empty') ? '' : (this.type.toString() + ' ');
  return 'Op ' + typeStr + '(' + this.op + '\n' + indent(this.left.toString() + '\n' + this.right.toString()) + '\n)';
};

Op.prototype.transformChildren = function (transformer) {
  return new Op(this.op, transformer(this.left), transformer(this.right), transformer(this.type));
};

/**
 * A string concatenation
 */
function StrConcat (left, right) {
  this.nodeType = 'StrConcat';
  this.type = new Type('string');

  validateItem(left, 'StrConcat');

  // Left and Right may be StrContact options too
  if (left.nodeType === 'StrConcat') {
    this.items = left.items;
  } else if (left.nodeType === 'List') {
    this.items = left;
  } else {
    this.items = new List([left]);
  }
  // Right is optional - left may simply be a list
  if (right) {
    validateItem(right, 'StrConcat');
    if (right.nodeType === 'StrConcat') {
      this.items = this.items.concat(right.items);
    } else {
      this.items = this.items.concat(right);
    }
  }
}

StrConcat.prototype.toString = function () {
  return 'StrConcat ' + this.type.toString() + ' (' + this.items.toString() + ')';
};

StrConcat.prototype.transformChildren = function (transformer) {
  return new StrConcat(transformer(this.items));
};

/**
 * A casted value
 */
function Cast (type, expression) {
  this.nodeType = 'Cast';
  this.type = type;
  this.expression = expression;
}

Cast.prototype.toString = function () {
  return 'Cast (' + this.type.toString() + ' ' + this.expression.toString() + ')';
};

Cast.prototype.transformChildren = function (transformer) {
  return new Cast(transformer(this.type), transformer(this.expression));
};

/**
 * A buffer for loading string values into
 */
function Buffer (variable, length) {
  this.nodeType = 'Buffer';
  this.variable = variable;
  this.length = length;
}

Object.defineProperties(Buffer.prototype, {
  type: {
    get: function () {
      return this.variable.type;
    }
  }
});

Buffer.prototype.toString = function () {
  return 'Buffer ' + this.length + ' (' + this.variable.toString() + ')';
};

Buffer.prototype.transformChildren = function (transformer) {
  return new Buffer(transformer(this.variable), this.length);
};

/**
 * A variable
 */
function Variable (name, type) {
  this.nodeType = 'Variable';
  this.name = name;
  this.type = type ? type : Empty;
}

Variable.prototype.toString = function () {
  if (this.type && this.type !== Empty) {
    return 'Variable ' + this.type + ' (' + this.name + ')';
  } else {
    return 'Variable (' + this.name + ')';
  }
};

Variable.prototype.transformChildren = function (transformer) {
  return new Variable(this.name, transformer(this.type));
};

/**
 * A reference to a type
 *
 * @param string type: int, float, string, array or range
 * @param value:
 *  - value for type int/float/string
 *  - array for type array
 *  - map { start, end } for type range
 */
function Type (type) {
  this.nodeType = 'Type';
  this.type = type;
}

Type.prototype.toString = function () {
  return '[Type ' + this.type + ']';
};

Type.prototype.transformChildren = function () {
  return this;
};

/**
 * A literal value
 *
 * @param string type: int, float, string, array or range
 * @param value:
 *  - value for type int/float/string
 *  - array for type array
 *  - map { start, end } for type range
 */
function Literal (value, type) {
  // Types should always be stored as Dys.Type objects
  if (typeof type === 'string') {
    type = new Type(type);
  }

  this.nodeType = 'Literal';
  this.type = type;
  this.value = value;
}

Literal.prototype.toString = function () {
  var val;
  switch (this.type.type) {
    case 'range':
      val = '\n' + indent(this.value.start + '\n' + this.value.end) + '\n'; break;
    default:
      val = '' + this.value;
  }
  return 'Literal ' + this.type + ' (' + val + ')';
};

Literal.prototype.transformChildren = function () {
  return this;
};

module.exports = {
  File: File,
  List: List,

  UseStatement: UseStatement,
  FnDef: FnDef,

  IfBlock: IfBlock,
  ForLoop: ForLoop,

  FnCall: FnCall,
  ReturnStatement: ReturnStatement,
  VariableDeclaration: VariableDeclaration,

  Op: Op,
  StrConcat: StrConcat,
  Cast: Cast,
  Buffer: Buffer,
  Variable: Variable,
  Type: Type,
  Literal: Literal,

  Empty: Empty
};
