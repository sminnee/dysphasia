var util = require('util');

var ASTKit = require('./ast/ASTKit');

var Dysphasia = new ASTKit();

Dysphasia.setRenderSettings({
  prefixedProperties: [ 'type', 'name', 'varArgs' ]
});

Dysphasia.addNodeType(
  'File',
  {
    statements: {
      type: 'Node.List',
      transformCallback: function (node) { return node.flatten(); }
    }
  }
);

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
 * A 'use' statement for importing external functions
 */

Dysphasia.addNodeType(
  'UseStatement',
  {
    name: { type: 'string' },
    type: { type: 'Node.Type' },
    args: { type: 'Node.List' },
    varArgs: {
      toString: {
        prefix: true,
        transform: function (value) { return value ? 'var_args' : ''; }
      }
    }
  }
);

Object.defineProperties(Dysphasia.UseStatement.prototype, {
  signature: {
    get: function () {
      return new Dysphasia.UseStatement(Empty, this.type, this.args, this.varArgs);
    }
  }
});

Dysphasia.UseStatement.prototype.combine = function (other) {
  if (!this.type) throw new SyntaxError('RAR: ' + this.toString());
  return new Dysphasia.UseStatement(
    this.name,
    this.type.combine(other.type),
    this.args.combine(other.args),
    this.varArgs
  );
};

/**
 * A function definition
 */
Dysphasia.addNodeType(
  'FnDef',
  {
    name: { type: 'string' },
    type: { type: 'Node.Type' },
    args: { type: 'Node.List' },
    guard: { type: 'Node' },
    statements: { type: 'Node.List' }
  }
);

Object.defineProperties(Dysphasia.FnDef.prototype, {
  signature: {
    get: function () {
      return new Dysphasia.UseStatement(null, this.type, this.args.mapList(function (arg) { return arg.type; }), false);
    }
  }
});

/**
 * An if block
 */
Dysphasia.addNodeType(
  'IfBlock',
  {
    test: { type: 'Node' },
    pass: { type: 'Node' },
    fail: { type: 'Node' }
  }
);

/**
 * A for loop
 */
Dysphasia.addNodeType(
  'ForLoop',
  {
    variable: { type: 'Node.Variable' },
    loopSource: { type: 'Node' },
    statements: { type: 'Node.List' }
  }
);

/**
 * A function call
 */
Dysphasia.addNodeType(
  'FnCall',
  {
    name: { type: 'string' },
    args: { type: 'Node.List', toString: { label: '' } },
    signature: { type: 'Node.List' },
    type: { type: 'Node.Type' }
  }
);

Dysphasia.FnCall.prototype.transformChildren = function (transformer) {
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
  var fnCall = new Dysphasia.FnCall(this.name, args);
  if (prefix.length > 0) {
    prefix.push(fnCall);
    return new Dysphasia.List(prefix);
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
Dysphasia.addNodeType(
  'ReturnStatement',
  {
    expression: { type: 'Node' },
    type: { type: 'Node.Type' }
  }
);

/**
 * A variable declaration
 */
Dysphasia.addNodeType(
  'VariableDeclaration',
  {
    variable: { type: 'Node.Variable' },
    type: { type: 'Node.Type' }
  }
);

/**
 * A variable assigment
 */
Dysphasia.addNodeType(
  'Assignment',
  {
    variable: { type: 'Node.Variable' },
    expression: { type: 'Node' },
    type: {
      type: 'Node.Type',
      toString: { prefix: true },
      valueConverter: function (type) { return type.isEmpty() ? this.props.expression.type : type; }
    }
  }
);

/**
 * A binary operation
 */
Dysphasia.addNodeType(
  'Op',
  {
    op: { type: 'string', toString: { label: '' } },
    left: { type: 'Node', toString: { label: '' } },
    right: { type: 'Node', toString: { label: '' } },
    type: { type: 'Node.Type' }
  }
);

/**
 * A type expression
 */
Dysphasia.addNodeType(
  'Type',
  {
    type: {},
    subtype: { type: 'Node.Type' },
    length: {}
  }
);

Dysphasia.Type.prototype.toString = function () {
  if (this.subtype.isEmpty()) return '[Type ' + this.type + ']';
  else {
    var lengthSuffix = this.length === null ? '' : ' x ' + this.length;
    return '[Type ' + this.type + ' ' + this.subtype.toString() + lengthSuffix + ' ]';
  }
};
/**
 * Returns true if there are no gaps in the type spec.
 * An array without a subtype is considered incomplete
 */
Dysphasia.Type.prototype.isComplete = function () {
  return (this.type !== 'array' && this.type !== 'range') || this.subtype.isComplete();
};

/**
 * A string concatenation
 */
Dysphasia.addNodeType(
  'StrConcat',
  {
    items: { type: 'Node.List' },
    type: {
      type: 'Node.Type',
      valueConverter: function (value) { return value.isEmpty() ? new Dysphasia.Type('string') : value; }
    }
  }
);

Dysphasia.StrConcat.prototype.toString = function () {
  return this.stringBuilder([this.type], { '': this.items });
};

/**
 * A casted value
 */
Dysphasia.addNodeType(
  'Cast',
  {
    type: { type: 'Node.Type' },
    expression: { type: 'Node' }
  }
);
Dysphasia.Cast.prototype.toString = function () {
  return this.stringBuilder([this.type], { '': this.expression });
};

/**
 * A buffer for loading string values into
 */

Dysphasia.addNodeType(
  'Buffer',
  {
    variable: { type: 'Node.Variable' },
    length: {}
  }
);
Object.defineProperties(Dysphasia.Buffer.prototype, {
  type: {
    get: function () {
      return this.variable.type;
    }
  }
});

Dysphasia.Buffer.prototype.toString = function () {
  return this.stringBuilder([this.length, this.variable]);
};

Dysphasia.addNodeType(
  'Variable',
  {
    name: {},
    type: { type: 'Node.Type' }
  }
);

Dysphasia.Variable.prototype.toString = function () {
  return this.stringBuilder([this.type], { '': this.name });
};
Dysphasia.Variable.prototype.combine = function (other) {
  if (this.type.equals(other.type)) return this;
  throw new SyntaxError('Can\'t combine ' + this.toString() + ' with ' + other.toString());
};

Dysphasia.addNodeType(
  'Literal',
  {
    value: {},
    type: {
      type: 'Node.Type',
      valueConverter: function (value) {
        if (typeof value === 'string') return new Dysphasia.Type(value);
        return value;
      }
    }
  }
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

module.exports = Dysphasia;
