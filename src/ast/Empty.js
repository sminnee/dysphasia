var ASTNode = require('./ASTNode');

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

module.exports = Empty;
