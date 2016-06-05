var ASTNode = require('./ASTNode');
var util = require('util');

function indent (str) {
  return '  ' + str.replace(/\n(.)/g, '\n  $1');
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

module.exports = List;
