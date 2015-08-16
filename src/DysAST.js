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
 * A Dysphasia file
 */
function File (statements) {
  this.nodeType = 'File';
  this.statements = statements;
}
File.prototype.toString = function () {
  return 'File (' + this.statements.toString() + ')';
};

/**
 * An ordered list of AST nodes
 */
function List (items) {
  this.nodeType = 'List';
  validateItems(items);
  this.items = items;
}

List.prototype.toString = function () {
  return '[\n' + indent(this.items.map(function (item) { return item.toString(); }).join('\n')) + '\n]';
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
function UseStatement (name, args, varArgs) {
  this.nodeType = 'UseStatement';
  this.name = name;
  this.args = args;
  this.varArgs = varArgs;
}
UseStatement.prototype.toString = function () {
  return 'UseStatement ' + this.name + (this.varArgs ? ' var_args ' : ' ') + '(' +
    this.args.toString() + ')';
};

/**
 * A function definition
 */
function FnDef (name, statements) {
  this.nodeType = 'FnDef';
  this.name = name;
  this.statements = statements;
}
FnDef.prototype.toString = function () {
  return 'FnDef ' + this.name + ' (' + this.statements.toString() + ')';
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
    '\nfail: ' + this.fail.toString();
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

/**
 * A function call
 */
function FnCall (name, args) {
  this.nodeType = 'FnCall';
  this.name = name;
  this.args = args;
}
FnCall.prototype.toString = function () {
  return 'FnCall (' + this.name + ' ' + this.args.toString() + ')';
};

/**
 * A 'return' statement
 */
function ReturnStatement (expression) {
  this.nodeType = 'ReturnStatement';
  this.expression = expression;
}
ReturnStatement.prototype.toString = function () {
  return 'ReturnStatement (' + this.expression.toString() + ')';
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

/**
 * A binary operation
 */
function Op (op, left, right) {
  this.nodeType = 'Op';
  this.op = op;
  this.left = left;
  this.right = right;
}
Op.prototype.toString = function () {
  return 'Op (' + this.op + '\n' + indent(this.left.toString() + '\n' + this.right.toString()) + '\n)';
};

/**
 * A string concatenation
 */
function StrConcat (left, right) {
  this.nodeType = 'StrConcat';

  validateItem(left, 'StrConcat');
  validateItem(right, 'StrConcat');

  // Left and Right may be StrContact options too
  if (left.nodeType === 'StrConcat') {
    this.items = left.items;
  } else {
    this.items = new List([left]);
  }
  if (right.nodeType === 'StrConcat') {
    this.items = this.items.concat(right.items);
  } else {
    this.items = this.items.concat(right);
  }
}
StrConcat.prototype.toString = function () {
  return 'StrConcat(' + this.items.toString() + ')';
};

/**
 * A casted value
 */
function Cast (type, expression) {
  this.nodeType = 'Cast';
  this.type = type;
  this.expression = expression;
}

/**
 * A buffer for loading string values into
 */
function Buffer (variable, length) {
  this.nodeType = 'Buffer';
  this.variable = variable;
  this.length = length;
}
Buffer.prototype.toString = function () {
  return 'Buffer ' + this.length + ' (' + this.variable.toString() + ')';
};

/**
 * A variable
 */
function Variable (name, type) {
  this.nodeType = 'Variable';
  this.name = name;
  this.type = type;
}
Variable.prototype.toString = function () {
  if (this.type) {
    return 'Variable ' + this.type + ' (' + this.name + ')';
  } else {
    return 'Variable (' + this.name + ')';
  }
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
  return 'Type (' + this.type + ')';
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
  this.nodeType = 'Literal';
  this.type = type;
  this.value = value;
}
Literal.prototype.toString = function () {
  var val;
  switch (this.type) {
    case 'string':
      val = '"' + this.value + '"'; break;
    case 'range':
      val = '\n' + indent(this.value.start + '\n' + this.value.end) + '\n'; break;
    default:
      val = '' + this.value;
  }
  return 'Literal ' + this.type + ' (' + val + ')';
};

/**
 * A null value
 * We use this singleton to represent unset parameters for type consistency
 */
var Empty = {
  nodeType: 'Empty',
  toString: function () {
    return 'Empty';
  }
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
