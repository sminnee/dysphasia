/* global describe, it */

var Dysphasia = require('../src/dysphasia');
var assert = require('assert');
var fs = require('fs');

var InlineFnGuards = require('../src/ast-transforms/InlineFnGuards');
var InferTypes = require('../src/ast-transforms/InferTypes');

describe('Dysphasia', function () {
  it('supports if statements', function () {
    testIntermediateCode('test/if-else.dptest');
  });
  it('supports basic arithmetic', function () {
    testASTInferredTypes('test/arithmetic.dptest');
    testIntermediateCode('test/arithmetic.dptest');
  });
  it('supports comparison operator', function () {
    testAST('test/comparison.dptest');
    testIntermediateCode('test/comparison.dptest');
  });
  it('supports use and puts', function () {
    testASTTransform('test/use-puts.dptest', [new InferTypes()]);
    testIntermediateCode('test/use-puts.dptest');
  });
  it('supports for loops without a bound variable', function () {
    testIntermediateCode('test/for-loop.dptest');
  });
  it('supports for loops with a bound variable', function () {
    testAST('test/for-loop-with-variable.dptest');
    testIntermediateCode('test/for-loop-with-variable.dptest');
  });
  it('supports for loops iterating an array', function () {
    testASTTransform('test/for-loop-array.dptest', [new InferTypes()]);
    testIntermediateCode('test/for-loop-array.dptest');
  });
  it('supports comments', function () {
    testAST('test/comments.dptest');
  });
  it('can convert int to string', function () {
    testIntermediateCode('test/string-casting.dptest');
  });
  it('will convert int to string regardless of where the int is', function () {
    testAST('test/string-casting-variants.dptest');
  });
  it('can infer types', function () {
    testASTInferredTypes('test/infer-types.dptest');
  });
  it('allows calls to user-defined functions', function () {
    testAST('test/call-custom-fn.dptest');
    testIntermediateCode('test/call-custom-fn.dptest');
  });
  it('allows concise arrow syntax for function definition', function () {
    testAST('test/concise-functions.dptest');
    testASTTransform('test/concise-functions.dptest', [new InlineFnGuards()]);
  });
  it('infers ambiguous function types by creating multiple functions', function () {
    testASTTransform('test/infer-ambiguous-types.dptest', [new InferTypes()]);
  });
  it('supports floats and ints', function () {
    testAST('test/floats-and-ints.dptest');
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
