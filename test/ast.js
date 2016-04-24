/* global describe, it */

var assert = require('assert');

var Dys = require('../src/DysAST');
var ASTTransform = require('../src/ast-transforms/ASTTransform');

describe('DysAST', function () {
  it('default transformation does not alter AST', function () {
    // Simple test AST that uses all node types
    var input = new Dys.File(
      new Dys.List([
        new Dys.UseStatement(
          'sprintf',
          new Dys.Type('int'),
          new Dys.List([new Dys.Type('buffer')]),
          Dys.Empty
        ),
        new Dys.FnDef(
          'test2',
          new Dys.Type('int'),
          new Dys.List([
            new Dys.Variable('arg1', Dys.Type('int'))
          ]),
          Dys.Empty,
          new Dys.List([
            new Dys.Buffer(new Dys.Variable('myBuffer', new Dys.Type('string')), 100),
            new Dys.StrConcat(new Dys.List([ new Dys.Literal('count to ', 'string'), new Dys.Literal(5, 'int') ])),
            new Dys.FnCall('test1', new Dys.List([ new Dys.Literal(1, new Dys.Type('int')) ])),
            new Dys.ReturnStatement(
              new Dys.Op('+', new Dys.Literal(2, new Dys.Type('int')), new Dys.Literal(3, new Dys.Type('int'))),
              new Dys.Type('int')
            )
          ])
        )
      ])
    );

    var transform = new ASTTransform();

    assert.deepEqual(input, transform.handle(input));
  });

  it('merges list arg', function () {
    // Simple test AST - op inside a function call
    var input = new Dys.File(
      new Dys.List([
        new Dys.FnCall('test1', new Dys.List([
          new Dys.Op('+', new Dys.Literal(2, new Dys.Type('int')), new Dys.Literal(3, new Dys.Type('int')))
        ]))
      ])
    );

    // Transformer that returns 2 items - a preparation step and then the result
    var transform = new ASTTransform();
    transform.handleOp = function (ast) {
      return new Dys.List([
        new Dys.FnCall('preparationStep', Dys.Empty),
        this.defaultHandler(ast)
      ]);
    };

    // The preparation step will be added before the function call
    var output = new Dys.File(
      new Dys.List([
        new Dys.FnCall('preparationStep', Dys.Empty),
        new Dys.FnCall('test1', new Dys.List([
          new Dys.Op('+', new Dys.Literal(2, new Dys.Type('int')), new Dys.Literal(3, new Dys.Type('int')))
        ]))
      ])
    );

    assert.deepEqual(output.toString(), transform.handle(input).toString());
  });
});
