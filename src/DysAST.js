var util = require('util');

/**
 * Classes defining the dypashaia AST
 */

/**
 * Base class of all AST Nodes
 * @param string nodeType Name of the node type
 */
function ASTNode (nodeType) {
  this.nodeType = nodeType || 'Empty';
}

/**
 * Tests for an empty node
 * @return boolean True if the node is empty
 */
ASTNode.prototype.isEmpty = function () {
  return this.nodeType === 'Empty';
};

/**
 * Build a string representation of the given node.
 * Helper method for toString().
 *
 * @param  array inlineItems  Items to show inline after the node type. Empties ignored.
 * @param  array childItems   Items to show as named parameteres. Empties ignored.
 * @return string             A string representation of this node
 */
ASTNode.prototype.stringBuilder = function (inlineItems, childItems) {
  // Always show the node name
  var output = this.nodeType;

  // Some items are shown inline next to the node name;
  if (inlineItems) {
    inlineItems.forEach(function (item) {
      if (!item) return;
      if (item.isEmpty && item.isEmpty()) return;

      output += ' ' + (item.toString ? item.toString() : item);
    });
  }

  // Some items are shown as a nested block with named labels
  if (childItems) {
    var item;
    output += ' (';
    for (var key in childItems) {
      item = childItems[key];
      if (!item) continue;
      if (item.isEmpty && item.isEmpty()) continue;

      if (key) {
        output += '\n' + key + ': ';
      }
      output += (item.toString ? item.toString() : item);
    }
    output += ')';
  }
  return output;
};

/**
 * Combine two nodes. By default, only works if 1 is empty or the two nodes are equal.
 * May be overridden for more sophisticated combination semantics
 * @param  ASTNode other
 * @return ASTNode
 */
ASTNode.prototype.combine = function (other) {
  if (other.isEmpty()) return this;
  if (this.equals(other)) return this;

  throw new SyntaxError('Can\'t combine ' + this.toString() + ' with ' + other.toString());
};

/**
 * Return true if the two elements are of equal value
 * @param  ASTNode other The node to compare
 * @return true
 */
ASTNode.prototype.equals = function (other) {
  return this.toString() === other.toString();
};

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
 * A null value
 * We use this singleton to represent unset parameters for type consistency
 */
var Empty = new ASTNode('Empty');
Empty.toString = function () {
  return 'Empty';
};

Empty.transformChildren = function (transformer) {
  return this;
};
Empty.combine = function (other) {
  if (!other.nodeType) throw new SyntaxError("Can't combined with a non-AST-node");
  return other;
};
Empty.mapList = function () {
  return Empty;
};
Empty.map = function () {
  return Empty;
};

/**
 * A Dysphasia file
 */
function File (statements) {
  if (!statements.nodeType) throw new Error('File statements must be an AST node');

  ASTNode.call(this, 'File');
  this.nodeType = 'File';
  this.statements = statements;
}
util.inherits(File, ASTNode);

File.prototype.toString = function () {
  return 'File (' + this.statements.toString() + ')';
};

File.prototype.transformChildren = function (transformer) {
  return new File(transformer(this.statements).flatten());
};

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
  this.variable = variable;
  this.loopSource = loopSource;
  this.statements = statements;
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
 */
function Type (type) {
  ASTNode.call(this, 'Type');
  this.type = type;
}
util.inherits(Type, ASTNode);

Type.prototype.toString = function () {
  return '[Type ' + this.type + ']';
};

Type.prototype.transformChildren = function () {
  return this;
};

Type.prototype.equals = function (other) {
  return this.nodeType === other.nodeType && this.type === other.type;
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
  ASTNode.call(this, 'Literal');

  // Types should always be stored as Dys.Type objects
  if (typeof type === 'string') {
    type = new Type(type);
  }

  this.type = type;
  this.value = value;
}
util.inherits(Literal, ASTNode);

Literal.prototype.toString = function () {
  var val;
  switch (this.type.type) {
    case 'range':
      val = '\n' + indent(this.value.start + '\n' + this.value.end) + '\n'; break;
    default:
      val = '' + this.value;
  }

  return this.stringBuilder([this.type], { '': val });
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
