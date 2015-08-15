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
    '\nstatements: ' + this.statements.toString();
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
function Variable (type, name) {
  this.nodeType = 'Variable';
  this.type = type;
  this.name = name;
}
Buffer.prototype.toString = function () {
  return 'Variable ' + this.name + ' (' + this.type + ')';
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
function Literal (type, value) {
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
  Op: Op,
  StrConcat: StrConcat,
  Cast: Cast,
  Buffer: Buffer,
  Variable: Variable,
  Type: Type,
  Literal: Literal,

  Empty: Empty
};
