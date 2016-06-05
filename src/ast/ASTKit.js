var util = require('util');

function ASTKit () {

}

function construct (constructor, args) {
  function F () {
    return constructor.apply(this, args);
  }
  F.prototype = constructor.prototype;
  return new F();
}

ASTKit.prototype.addNodeType = function (name, propSpec) {
  function Subclass () {
    var self = this;
    this.nodeType = name;
    this.props = {};

    var args = arguments;
    propSpec.forEach(function (spec, i) {
      if (spec.type && spec.type.match(/^Node/)) {
        var value = args[i] || Empty;
        if (spec.valueConverter) {
          value = spec.valueConverter(value) || Empty;
        }
      } else {
        value = args[i];
      }

      self.props[spec.name] = value;
    });
  }
  util.inherits(Subclass, this.ASTNode);

  var propDefs = {};
  propSpec.forEach(function (spec, i) {
    var propName = spec.name;
    propDefs[propName] = {
      get: function () {
        return this.props[propName];
      },
      set: function (value) {
        this.props[propName] = value;
      }
    };
  });
  Object.defineProperties(Subclass.prototype, propDefs);

  Subclass.prototype.transformChildren = function (transformer) {
    var self = this;
    var constructorArgs = [ ];

    propSpec.forEach(function (spec, i) {
      if (spec.type && spec.type.match(/^Node/)) {
        constructorArgs[i] = transformer(self.props[spec.name]);
        if (spec.transformCallback) {
          constructorArgs[i] = (spec.transformCallback)(constructorArgs[i]);
        }
      } else {
        constructorArgs[i] = self.props[spec.name];
      }
    });

    var result = construct(Subclass, constructorArgs);
    return result;
  };

  Subclass.prototype.equals = function (other) {
    var i, spec;
    for (i = 0; i < propSpec.length; i++) {
      spec = propSpec[i];
      if (spec.type && spec.type.match(/^Node/)) {
        if (!this.props[spec.name].equals(other[spec.name])) return false;
      } else {
        if (this.props[spec.name] !== other[spec.name]) return false;
      }
    }
    return true;
  };

  this[name] = Subclass;
};

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

ASTNode.prototype.clone = function () {
  return this.transformChildren(function (ast) { return ast.clone(); });
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

ASTKit.prototype.ASTNode = ASTNode;


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
Empty.isComplete = function () {
  return false;
};
Object.defineProperties(Empty, {
  type: {
    get: function () {
      return Empty;
    }
  },
  subtype: {
    get: function () {
      return Empty;
    }
  },
  variable: {
    get: function () {
      return Empty;
    }
  },
  name: {
    get: function () {
      return null;
    }
  }
});

ASTKit.prototype.Empty = Empty;

module.exports = ASTKit;
