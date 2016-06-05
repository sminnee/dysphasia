var util = require('util');

var ASTKit = require('./ast/ASTKit');

var Dysphasia = new ASTKit();

Dysphasia.addNodeType(
  'File',
  [
    {
      name: 'statements',
      type: 'Node.List',
      transformCallback: function (node) { return node.flatten(); }
    }
  ]
);

Dysphasia.File.prototype.toString = function () {
  return 'File (' + this.statements.toString() + ')';
};

/**
 * Classes defining the dypashaia AST
 */

var ASTNode = Dysphasia.ASTNode;
var Empty = Dysphasia.Empty;

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
  if (typeof className !== 'string') {
    className = 'List';
  }

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
 * An ordered list of AST nodes
 */
function List (items) {
  ASTNode.call(this, 'List');
  if (items) {
    validateItems(items);
    this.items = items.filter(function (item) { return item.nodeType !== 'Empty'; });
  } else {
    this.items = [];
  }
}
util.inherits(List, ASTNode);

Object.defineProperties(List.prototype, {
  length: {
    get: function () {
      return this.items.length;
    }
  },
  first: {
    get: function () {
      return this.items[0];
    },
    set: function (item) {
      this.items[0] = item;
    }
  },
  last: {
    get: function () {
      return this.items[this.items.length - 1];
    },
    set: function (item) {
      this.items[this.items.length - 1] = item;
    }
  }
});

List.prototype.toString = function () {
  return '[\n' + indent(this.items.map(function (item) { return item.toString(); }).join('\n')) + '\n]';
};

List.prototype.transformChildren = function (transformer) {
  return this.mapList(transformer);
};

List.prototype.equals = function (other) {
  if (this.length !== other.length) return false;
  if (this.nodeType !== other.nodeType) return false;

  var diffCheck = Math.min.apply(Math, this.items.map(function (val, i) {
    return val.equals(other.items[i]) ? 1 : 0;
  }));
  return diffCheck === 1;
};

List.prototype.map = function (callback) {
  return this.items.map(callback);
};
List.prototype.mapList = function (callback) {
  return new List(this.items.map(callback));
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
 * Return a new list where any nested List items are flattened
 */
List.prototype.flatten = function () {
  return this.items.reduce(function (list, next) {
    return list.concat(next);
  }, new List());
};

/**
 * A 'use' statement for importing external functions
 */
function UseStatement (name, type, args, varArgs) {
  ASTNode.call(this, 'UseStatement');
  this.type = type;
  this.name = name;
  this.args = args;
  this.varArgs = varArgs;
}
util.inherits(UseStatement, ASTNode);

Object.defineProperties(UseStatement.prototype, {
  signature: {
    get: function () {
      return new UseStatement(Empty, this.type, this.args, this.varArgs);
    }
  }
});

UseStatement.prototype.toString = function () {
  return this.stringBuilder([
    this.type,
    this.name,
    (this.varArgs ? 'var_args' : null)
  ], {
    '': this.args
  });
};

UseStatement.prototype.transformChildren = function (transformer) {
  return new UseStatement(this.name, transformer(this.type), transformer(this.args), this.varArgs);
};

UseStatement.prototype.equals = function (other) {
  return this.name === other.name &&
    this.type.equals(other.type) &&
    this.args.equals(other.args) &&
    this.varArgs === other.varArgs;
};

UseStatement.prototype.combine = function (other) {
  if (!this.type) throw new SyntaxError('RAR: ' + this.toString());
  return new UseStatement(
    this.name,
    this.type.combine(other.type),
    this.args.combine(other.args),
    this.varArgs
  );
};

/**
 * A function definition
 */
function FnDef (name, type, args, guard, statements) {
  ASTNode.call(this, 'FnDef');
  this.name = name;
  this.type = type;
  this.args = args;
  this.guard = guard;
  this.statements = statements;
}
util.inherits(FnDef, ASTNode);

Object.defineProperties(FnDef.prototype, {
  signature: {
    get: function () {
      return new UseStatement(null, this.type, this.args.mapList(function (arg) { return arg.type; }), false);
    }
  }
});

FnDef.prototype.toString = function () {
  return this.stringBuilder(
    [ this.type, this.name ],
    {
      args: this.args,
      guard: this.guard,
      statements: this.statements
    }
  );
};

FnDef.prototype.transformChildren = function (transformer) {
  return new FnDef(
    this.name, transformer(this.type), transformer(this.args), transformer(this.guard), transformer(this.statements)
  );
};

/**
 * An if block
 */
function IfBlock (test, pass, fail) {
  ASTNode.call(this, 'IfBlock');
  this.test = test;
  this.pass = pass;
  this.fail = fail;
}
util.inherits(IfBlock, ASTNode);

IfBlock.prototype.toString = function () {
  return this.stringBuilder([], {
    test: this.test,
    pass: this.pass,
    fail: this.fail
  });
};

IfBlock.prototype.transformChildren = function (transformer) {
  return new IfBlock(transformer(this.test), transformer(this.pass), transformer(this.fail));
};

/**
 * A for loop
 */
function ForLoop (variable, loopSource, statements) {
  ASTNode.call(this, 'ForLoop');
  this.variable = variable || Empty;
  this.loopSource = loopSource || Empty;
  this.statements = statements || Empty;
}
util.inherits(ForLoop, ASTNode);

ForLoop.prototype.toString = function () {
  return this.stringBuilder([], {
    variable: this.variable,
    loopSource: this.loopSource,
    statements: this.statements
  });
};

ForLoop.prototype.transformChildren = function (transformer) {
  return new ForLoop(transformer(this.variable), transformer(this.loopSource), transformer(this.statements));
};

/**
 * A function call
 */
function FnCall (name, args) {
  ASTNode.call(this, 'FnCall');
  this.name = name;
  this.args = args;
  this.signature = Empty;
  this.type = Empty;
}
util.inherits(FnCall, ASTNode);

FnCall.prototype.toString = function () {
  return this.stringBuilder([this.type, this.name], { '': this.args, 'signature': this.signature });
};

FnCall.prototype.transformChildren = function (transformer) {
  var args = transformer(this.args);
  var prefix = [];
  args = args.mapList(function (arg) {
    // If transformer turned an argument into a list, then pull all but the last item as a prefix to this FnCall
    if (arg.nodeType === 'List') {
      prefix.push.apply(prefix, arg.items.slice(0, -1));
      return arg.last;
    }
    return arg;
  });

  // If there is a prefix, return a list
  var fnCall = new FnCall(this.name, args);
  if (prefix.length > 0) {
    prefix.push(fnCall);
    return new List(prefix);
  }

  if (!this.type.isEmpty()) {
    fnCall.type = transformer(this.type);
  }
  if (!this.signature.isEmpty()) {
    fnCall.signature = transformer(this.signature);
  }

  return fnCall;
};

/**
 * A 'return' statement
 */
function ReturnStatement (expression, type) {
  ASTNode.call(this, 'ReturnStatement');
  this.expression = expression;
  this.type = type || Empty;
}
util.inherits(ReturnStatement, ASTNode);

ReturnStatement.prototype.toString = function () {
  return this.stringBuilder([this.type], { '': this.expression });
};

ReturnStatement.prototype.transformChildren = function (transformer) {
  return new ReturnStatement(transformer(this.expression), transformer(this.type));
};

/**
 * A variable declaration
 */
function VariableDeclaration (variable, type) {
  ASTNode.call(this, 'VariableDeclaration');

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
util.inherits(VariableDeclaration, ASTNode);

VariableDeclaration.prototype.toString = function () {
  return this.stringBuilder([this.type], { '': this.variable });
};

VariableDeclaration.prototype.transformChildren = function (transformer) {
  return new VariableDeclaration(transformer(this.variable), transformer(this.type));
};

/**
 * A variable assigment
 */
function Assignment (variable, expression, type) {
  ASTNode.call(this, 'Assignment');

  this.variable = variable;
  this.expression = expression;
  this.type = type || this.expression.type || Empty;
}
util.inherits(Assignment, ASTNode);

Assignment.prototype.toString = function () {
  var typeStr = (this.type.isEmpty()) ? '' : (this.type.toString() + ' ');
  return 'Assignment ' + typeStr + '(\n' + indent(this.variable.toString() + '\n' + this.expression.toString()) + '\n)';
};

Assignment.prototype.transformChildren = function (transformer) {
  return new Assignment(transformer(this.variable), transformer(this.expression), transformer(this.type));
};

/**
 * A binary operation
 */
function Op (op, left, right, type) {
  ASTNode.call(this, 'Op');

  this.op = op;
  this.left = left;
  this.right = right;
  this.type = type || Empty;
}
util.inherits(Op, ASTNode);

Op.prototype.toString = function () {
  var typeStr = (this.type.isEmpty()) ? '' : (this.type.toString() + ' ');
  return 'Op ' + typeStr + '(' + this.op + '\n' + indent(this.left.toString() + '\n' + this.right.toString()) + '\n)';
};

Op.prototype.transformChildren = function (transformer) {
  return new Op(this.op, transformer(this.left), transformer(this.right), transformer(this.type));
};

/**
 * A string concatenation
 */
function StrConcat (left, right) {
  ASTNode.call(this, 'StrConcat');

  this.type = new Type('string');

  validateItem(left, 'StrConcat');

  // Left and Right may be StrConcat options too
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
util.inherits(StrConcat, ASTNode);

StrConcat.prototype.toString = function () {
  return this.stringBuilder([this.type], { '': this.items });
};

StrConcat.prototype.transformChildren = function (transformer) {
  return new StrConcat(transformer(this.items));
};

/**
 * A casted value
 */
function Cast (type, expression) {
  ASTNode.call(this, 'Cast');

  this.type = type;
  this.expression = expression;
}
util.inherits(Cast, ASTNode);

Cast.prototype.toString = function () {
  return this.stringBuilder([this.type], { '': this.expression });
};

Cast.prototype.transformChildren = function (transformer) {
  return new Cast(transformer(this.type), transformer(this.expression));
};

/**
 * A buffer for loading string values into
 */
function Buffer (variable, length) {
  ASTNode.call(this, 'Buffer');

  this.variable = variable;
  this.length = length;
}
util.inherits(Buffer, ASTNode);

Object.defineProperties(Buffer.prototype, {
  type: {
    get: function () {
      return this.variable.type;
    }
  }
});

Buffer.prototype.toString = function () {
  return this.stringBuilder([this.length, this.variable]);
};

Buffer.prototype.transformChildren = function (transformer) {
  return new Buffer(transformer(this.variable), this.length);
};

/**
 * A variable
 */
function Variable (name, type) {
  ASTNode.call(this, 'Variable');

  this.name = name;
  this.type = type || Empty;
}
util.inherits(Variable, ASTNode);

Variable.prototype.toString = function () {
  return this.stringBuilder([this.type], { '': this.name });
};

Variable.prototype.transformChildren = function (transformer) {
  return new Variable(this.name, transformer(this.type));
};

Variable.prototype.equals = function (other) {
  return this.nodeType === other.nodeType && this.name === other.name && this.type.equals(other.type);
};

Variable.prototype.combine = function (other) {
  if (this.type.equals(other.type)) return this;
  throw new SyntaxError('Can\'t combine ' + this.toString() + ' with ' + other.toString());
};

/**
 * A reference to a type
 *
 * @param string type: int, float, string, array or range
 * @param ASTNode subtype: for an array, the type of the items
 */
function Type (type, subtype, length) {
  ASTNode.call(this, 'Type');
  this.type = type;
  this.subtype = subtype || Empty;
  this.length = length || null;
}
util.inherits(Type, ASTNode);

Type.prototype.toString = function () {
  if (this.subtype.isEmpty()) return '[Type ' + this.type + ']';
  else {
    var lengthSuffix = this.length === null ? '' : ' x ' + this.length;
    return '[Type ' + this.type + ' ' + this.subtype.toString() + lengthSuffix + ' ]';
  }
};

Type.prototype.transformChildren = function (transformer) {
  return new Type(this.type, transformer(this.subtype), this.length);
};

Type.prototype.equals = function (other) {
  return this.nodeType === other.nodeType &&
    this.type === other.type &&
    this.subtype.equals(other.subtype) &&
    this.length === other.length;
};

/**
 * Returns true if there are no gaps in the type spec.
 * An array without a subtype is considered incomplete
 */
Type.prototype.isComplete = function () {
  return (this.type !== 'array' && this.type !== 'range') || this.subtype.isComplete();
};

Dysphasia.addNodeType(
  'Literal',
  [
    {
      name: 'value'
    },
    {
      name: 'type',
      type: 'Node.Type',
      valueConverter: function (value) {
        if (typeof value === 'string') return new Type(value);
        return value;
      }
    }
  ]
);
Dysphasia.Literal.prototype.toString = function () {
  var val;
  switch (this.type.type) {
    case 'range':
      val = '\n' + indent(this.value.start + '\n' + this.value.end) + '\n'; break;
    default:
      val = '' + this.value;
  }

  return this.stringBuilder([this.type], { '': val });
};

module.exports = {
  File: Dysphasia.File,
  List: List,

  UseStatement: UseStatement,
  FnDef: FnDef,

  IfBlock: IfBlock,
  ForLoop: ForLoop,

  FnCall: FnCall,
  ReturnStatement: ReturnStatement,
  VariableDeclaration: VariableDeclaration,
  Assignment: Assignment,

  Op: Op,
  StrConcat: StrConcat,
  Cast: Cast,
  Buffer: Buffer,
  Variable: Variable,
  Type: Type,
  Literal: Dysphasia.Literal,

  Empty: Dysphasia.Empty
};


