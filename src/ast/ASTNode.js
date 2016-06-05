
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

module.exports = ASTNode;
