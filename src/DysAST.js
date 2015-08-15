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
  return 'File (\n' + indent(this.statements.toString()) + '\n)';
};

/**
 * An ordered list of AST nodes
 */
function List (items) {
  this.nodeType = 'List';
  this.items = items;
}
List.prototype.toString = function () {
  return this.items.map(function (item) { return item.toString(); }).join('\n');
};
List.prototype.map = function (callback) {
  return this.items.map(callback);
};

/**
 * A 'use' statement for importing external functions
 */
function UseStatement (name) {
  this.nodeType = 'UseStatement';
  this.name = name;
}
UseStatement.prototype.toString = function () {
  return 'UseStatement ' + this.name;
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
  return 'FnDef ' + this.name + ' (\n' + indent(this.statements.toString()) + '\n)';
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
    '\npass:\n' + indent(this.pass.toString()) +
    '\nfail:\n' + indent(this.fail.toString());
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
    '\nstatements:\n' + indent(this.statements.toString());
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
  return 'FnCall (' + this.name + '\n' + indent(this.args.toString()) + '\n)';
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
  Literal: Literal,

  Empty: Empty
};
