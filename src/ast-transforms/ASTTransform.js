/**
 * Base class of AST transformations
 * AST transformations are used to do preliminary steps before passing the AST ot to the LLVM compiler.
 * The goal is to reduce the complexity of the LLVM compiler.
 *
 * To create your own transformation, subclass ASTTransform and override the applicable handle() methods.
 */
function ASTTransform () {

}

/**
 * Handle the given node
 * Dispatches to a method 'handle' + nodeType
 * Default behaviour is to call transformChildren on the node
 */
ASTTransform.prototype.handle = function (ast) {
  if (!ast.nodeType) {
    throw new Error('Bad AST passed to handle() - no nodeType: ' + JSON.stringify(ast));
  }

  var result;

  // transform-specific handler
  if (typeof this['handle' + ast.nodeType] === 'function') {
    result = this['handle' + ast.nodeType](ast);

  // default handler - no-op, but keep traversing the tree
  } else {
    result = this.defaultHandler(ast);
  }

  // Validation
  if (!result) {
    throw new Error('ASTTransform.handle' + ast.nodeType + ' didn\'t return a value');
  }
  if (!result.nodeType) {
    console.log(result);
    throw new Error('ASTTransform.handle' + ast.nodeType + ' didn\'t return an AST node');
  }

  return result;
};

ASTTransform.prototype.defaultHandler = function (ast) {
  if (!ast.transformChildren) throw new Error('No transformChildren() method on ' + ast);
  return ast.transformChildren(this.handle.bind(this));
};

module.exports = ASTTransform;

