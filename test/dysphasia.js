/* global describe, it */

var Dysphasia = require('../src/dysphasia');
var assert = require('assert');
var fs = require('fs');

var InlineFnGuards = require('../src/ast-transforms/InlineFnGuards');
var InferTypes = require('../src/ast-transforms/InferTypes');

describe('The Dysphasia language', function () {
  it('supports comments (comments)', function () {
    testAST('test/comments.dptest');
  });
  it('can infer types (infer types)', function () {
    testASTInferredTypes('test/infer-types.dptest');
  });
  it('supports floats and ints (floats-and-ints)', function () {
    testAST('test/floats-and-ints.dptest');
  });

  describe('Expressions', function () {
    it('support basic arithmetic (arithmetic)', function () {
      testASTInferredTypes('test/arithmetic.dptest');
      testIntermediateCode('test/arithmetic.dptest');
    });
    it('support comparison operators (comparison)', function () {
      testAST('test/comparison.dptest');
      testIntermediateCode('test/comparison.dptest');
    });
    it('supports use and puts', function () {
      testASTTransform('test/use-puts.dptest', [new InferTypes()]);
      testIntermediateCode('test/use-puts.dptest');
    });
  });

  describe('Variable assignments', function () {
    it('are supported (variable-assignment)', function () {
      testAST('test/variable-assignment.dptest');
    });
    it('supports type inferencing (variable-assignment)', function () {
      testASTTransform('test/variable-assignment.dptest', [new InferTypes()]);
    });
    it('can be compiled', function () {
      testIntermediateCode('test/variable-assignment.dptest');
    });
    it('supports array literals (variable-assignment-array)', function () {
      testAST('test/variable-assignment-array.dptest');
    });
    it('can infer types from the values of array literals (variable-assignment-array)', function () {
      testASTTransform('test/variable-assignment-array.dptest', [new InferTypes()]);
    });
  });

  describe('String parsing', function () {
    it('can convert int to string (string-casting)', function () {
      testIntermediateCode('test/string-casting.dptest');
    });
    it('will convert int to string regardless of where the int is (string-casting-variants)', function () {
      testAST('test/string-casting-variants.dptest');
    });
  });

  describe('For loops', function () {
    it('work without a bound variable (for-loop)', function () {
      testIntermediateCode('test/for-loop.dptest');
    });
    it('work with a bound variable (for-loop-with-variable)', function () {
      testAST('test/for-loop-with-variable.dptest');
      testIntermediateCode('test/for-loop-with-variable.dptest');
    });
    it('support iterating an array (for-loop-array)', function () {
      testASTTransform('test/for-loop-array.dptest', [new InferTypes()]);
      testIntermediateCode('test/for-loop-array.dptest');
    });
  });

  describe('If statements', function () {
    it('are supports (if-else)', function () {
      testIntermediateCode('test/if-else.dptest');
    });
  });

  describe('Functions', function () {
    it('can be user-defined (call-custom-fn)', function () {
      testAST('test/call-custom-fn.dptest');
      testIntermediateCode('test/call-custom-fn.dptest');
    });
    it('can be defined with concise arrow syntax (concise-functions)', function () {
      testAST('test/concise-functions.dptest');
      testASTTransform('test/concise-functions.dptest', [new InlineFnGuards()]);
    });
    it('infers ambiguous function types by creating multiple functions (infer-ambiguous-types)', function () {
      testASTTransform('test/infer-ambiguous-types.dptest', [new InferTypes()]);
    });
  });
});

function testAST (filename) {
  var parts = loadTest(filename);
  var dp = Dysphasia.loadString(parts.source);
  assert.equal(dp.parseTree().toString(), parts.ast.replace(/\s+$/, ''));
}

function testASTTransform (filename, transforms) {
  var parts = loadTest(filename);
  var dp = Dysphasia.loadString(parts.source);
  var ast = dp.parseTree();

  transforms.forEach(function (transform) {
    ast = transform.handle(ast);
  });

  assert.equal(ast.toString(), parts.transformed.replace(/\s+$/, ''));
}

function testASTInferredTypes (filename) {
  var parts = loadTest(filename);
  var dp = Dysphasia.loadString(parts.source);
  var ast = dp.parseTree();

  ast = (new InferTypes()).handle(ast);

  assert.equal(ast.toString(), parts.ast.replace(/\s+$/, ''));
}

function testIntermediateCode (filename) {
  var parts = loadTest(filename);
  var dp = Dysphasia.loadString(parts.source);

  assert.equal(dp.generateLLVMCode(), parts.compiled);
}

/**
 * Loads a dptest file returning
 */
function loadTest (filename) {
  var content = fs.readFileSync(filename) + '';
  var parts = content.split(/\n-----*\n/);

  return {
    source: parts[0],
    compiled: parts[1],
    ast: parts[2],
    transformed: parts[3]
  };
}
