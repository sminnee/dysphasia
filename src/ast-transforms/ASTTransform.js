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
    throw new Error('Bad AST passed to handle(): ' + JSON.stringify(ast));
  }

  // transform-specific handler
  if (typeof this['handle' + ast.nodeType] === 'function') {
    var result = this['handle' + ast.nodeType](ast);
    if (!result) {
      throw new Error('ASTTransform.handle' + ast.nodeType + ' didn\'t return a value');
    }
    return result;

  // default handler - no-op, but keep traversing the tree
  } else {
    return this.defaultHandler(ast);
  }
};

ASTTransform.prototype.defaultHandler = function (ast) {
  if (!ast.transformChildren) console.log(ast);
  return ast.transformChildren(this.handle.bind(this));
};

module.exports = ASTTransform;

