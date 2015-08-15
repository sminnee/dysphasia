/* global describe, it */

var Dysphasia = require('../src/dysphasia');
var assert = require('assert');
var fs = require('fs');

describe('Dysphasia', function () {
  it('supports if statements', function () {
    testIntermediateCode('test/if-else.dptest');
  });
  it('supports basic arithmetic', function () {
    testIntermediateCode('test/arithmetic.dptest');
  });
  it('supports use and puts', function () {
    testAST('test/use-puts.dptest');
    testIntermediateCode('test/use-puts.dptest');
  });
  it('supports for loops', function () {
    testIntermediateCode('test/for-loop.dptest');
  });
  it('supports comments', function () {
    testAST('test/comments.dptest');
  });
  it('can convert int to string', function () {
    testIntermediateCode('test/string-casting.dptest');
  });
});

function testAST (filename) {
  var parts = loadTest(filename);
  var dp = Dysphasia.loadString(parts.source);
  assert.equal(dp.parseTree().toString(), parts.ast);
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
