/* global describe, it */

var Dysphasia = require('../src/dysphasia');
var assert = require('assert');
var fs = require('fs');
var InferTypes = require('../src/ast-transforms/InferTypes');
var GetFnDefs = require('../src/ast-transforms/GetFnDefs');

describe('Dysphasia', function () {
  it('supports if statements', function () {
    testIntermediateCode('test/if-else.dptest');
  });
  it('supports basic arithmetic', function () {
    testASTInferredTypes('test/arithmetic.dptest');
    testIntermediateCode('test/arithmetic.dptest');
  });
  it('supports use and puts', function () {
    testAST('test/use-puts.dptest');
    testIntermediateCode('test/use-puts.dptest');
  });
  it('supports for loops without a bound variable', function () {
    testIntermediateCode('test/for-loop.dptest');
  });
  it('supports for loops with a bound variable', function () {
    testAST('test/for-loop-with-variable.dptest');
    testIntermediateCode('test/for-loop-with-variable.dptest');
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
});

function testAST (filename) {
  var parts = loadTest(filename);
  var dp = Dysphasia.loadString(parts.source);
  assert.equal(dp.parseTree().toString(), parts.ast.replace(/\s+$/, ''));
}

/*
function testASTTransform (filename, transform) {
  var parts = loadTest(filename);
  var dp = Dysphasia.loadString(parts.source);
  var ast = dp.parseTree();
  ast = transform.handle(ast);
  assert.equal(ast.toString(), parts.ast.replace(/\s+$/, ''));
}
*/

function testASTInferredTypes (filename) {
  var parts = loadTest(filename);
  var dp = Dysphasia.loadString(parts.source);
  var ast = dp.parseTree();

  var fnDefs = (new GetFnDefs()).handle(ast);
  ast = (new InferTypes(fnDefs)).handle(ast);

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
    ast: parts[2]
  };
}
