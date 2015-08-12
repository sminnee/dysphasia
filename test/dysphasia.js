/* global describe */

var Dysphasia = require('../src/dysphasia');
var assert = require('assert');
var fs = require('fs');

describe('Dysphasia', function () {
  it('supports if statements', function () {
    runDPTest('test/if-else.dptest');
  });
  it('supports basic arithmetic', function () {
    runDPTest('test/arithmetic.dptest');
  });
  it('supports use and puts', function () {
    runDPTest('test/use-puts.dptest');
  });
});

function runDPTest (filename) {
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
    compiled: parts[1]
  };
}
