/**
 * Dysphasia parser
 */

{
  var Dys = require('../DysAST');
}

/**
 * Each dp file containers a number of named blocks.
 */
start
  = ws? items:item*
    {
      var list = new Dys.List();
      items.forEach(function (item) {
        if(item.nodeType) item = [item];
        list = list.concat(item);
      });
      return new Dys.File(list);
    }

item
  = fnDef
  / useStatement

/**
 * Assign a name & return type to a set of lambdas
 */
fnDef
  = type:(type ws)? name:symbolname lambdas:fnLambda+
    {
      return lambdas.map(function (lambda) {
        lambda.name = name;
        if(type) lambda.type = type[0];
        return lambda;
      });
    }

/**
 * function without a name
 */
fnLambda
  = args:fnArgDef? lbrace content:blockcontent rbrace
    {
      return new Dys.FnDef(
        Dys.Empty,
        Dys.Empty,
        args ? new Dys.List(args[0]) : Dys.Empty,
        (args && args[1]) ? args[1] : Dys.Empty,
        new Dys.List(content)
      );
    }
  / args:fnArgDef? arrow content:statementLine
    {
      return new Dys.FnDef(
        Dys.Empty,
        Dys.Empty,
        args ? new Dys.List(args[0]) : Dys.Empty,
        (args && args[1]) ? args[1] : Dys.Empty,
        new Dys.List([content])
      );
    }

fnArgDef
  = lparenth args:fnArgDefList guard:fnGuardDef? rparenth
    {
      return [args, guard];
    }

fnArgDefList
  = left:fnSingleArgDef comma rest:fnArgDefList
    {
      return [left].concat(rest);
    }
  / arg:fnSingleArgDef
    {
      return [arg]
    }

fnSingleArgDef
  = type:(type ws)? variable:variable
    {
      variable.type = type ? type[0] : Dys.Empty;
      return variable;
    }

/**
 * Guard expression, e.g. x | x > 2
 */
fnGuardDef
  = pipe expression:arithmeticExpression
    {
      return expression;
    }

blockcontent
  = statements:(statementLine)*
    {
      return statements;
    }

statementLine
  = statement:statement semicolon {
    return statement;
  }

statement
  = ifBlock
  / forLoop
  / returnStatement
  / variableDeclaration
  / expression

returnStatement
  = return ws expr:expression
    {
      return new Dys.ReturnStatement(expr);
    }

expression
  = stringExpression
  / arithmeticExpression

stringExpression
  = left:simpleTypeOrVariable plus rest:stringExpression
    {
      return new Dys.StrConcat(left, rest);
    }
  / left:string plus right:simpleTypeOrVariable
    {
      return new Dys.StrConcat(left, right);
    }
  / string

/**
 * Expressions are parsed with the following predecence
 * - boolean
 * - comparison
 * - multiplicative
 * - additive
 * - parentheses
 */
arithmeticExpression
  = boolean

boolean
  = left:comparison op:boolOp right:boolean
    {
      return new Dys.Op(op, left, right, new Dys.Type('bool'));
    }
  / comparison

comparison
  = left:additive op:cmpOp right:comparison
    {
      return new Dys.Op(op, left, right, new Dys.Type('bool'));
    }
  / additive

additive
  = left:multiplicative op:addOp right:additive
    {
      return new Dys.Op(op, left, right);
    }
  / multiplicative

multiplicative
  = left:primary op:mulOp right:multiplicative
    {
      return new Dys.Op(op, left, right);
    }
  / primary

primary
  = lparenth subExpr:comparison rparenth
    {
      return subExpr;
    }
  / functionCall
  / integer
  / bool
  / variable

cmpOp
  = eq
  / ne
  / gte
  / lte
  / gt
  / lt

boolOp
  = and
  / or
addOp
  = plus
  / minus
mulOp
  = asterisk
  / slash


/**
 * FunctionCall
 */
functionCall
  = name:symbolname lparenth arguments:functionArguments? rparenth
    {
      return new Dys.FnCall(name, arguments ? new Dys.List(arguments) : Dys.Empty);
    }

functionArguments
  = argument:expression rest:extraFunctionArguments?
    {
      return rest ? [argument].concat(rest) : [argument];;
    }

extraFunctionArguments
  = comma argument:expression rest:extraFunctionArguments?
    {
      return rest ? [argument].concat(rest) : [argument];
    }

/**
 * If blocks
 */

ifBlock
  = if lparenth test:expression rparenth lbrace pass:blockcontent rbrace fail:elseBlock?
    {
      return new Dys.IfBlock(test, new Dys.List(pass), fail ? new Dys.List(fail) : Dys.Empty);
    }
elseBlock
  = else lbrace fail:blockcontent rbrace
    {
      return fail;
    }

/**
 * For loops
 */
forLoop
  = for lparenth loopSource:loopExpression rparenth lbrace content:blockcontent rbrace
    { return new Dys.ForLoop(
        loopSource.variable ? loopSource.variable : Dys.Empty,
        loopSource.expression,
        new Dys.List(content)
      );
    }

loopExpression
  = variable:variable ws in ws expression:arrayExpression { return { variable: variable, expression: expression }; }
  / expression:arrayExpression { return { variable: null, expression: expression }; }

arrayExpression
  = arrayLiteral
  / variable

arrayLiteral
  = start:integer doubledot end:integer { return new Dys.Literal({ start: start, end: end }, 'range'); }
  / lbracket items:arrayItems rbracket
    {
      return new Dys.Literal(new Dys.List(items), 'array')
    }

arrayItems
  = first:expression comma rest:arrayItems
    {
      return rest ? [first].concat(rest) : [first];
    }
  / expression

/**
 * Variables
 */

/**
 * Function imports (use)
 */
useStatement
  = use ws type:(type ws)? name:symbolname semicolon? lparenth args:useStatementParams rparenth semicolon?
    {
      return new Dys.UseStatement(name, type ? type[0] : Dys.Empty, args.types, args.varArgs);
    }

useStatementParams
  = types:typeList comma elipsis
    {
      return { varArgs: true, types: types }
    }
  / types:typeList
    {
      return { varArgs: false, types: types }
    }

typeList
  = left:type comma rest:typeList
    {
      return new Dys.List([left]).concat(rest);
    }
  / type:type
    {
      return new Dys.List([type]);
    }

type "type"
  = type:("string"
  / "buffer"
  / "int"
  / "float"
  / "bool") ws?
    {
      return new Dys.Type(type)
    }

variable "variable"
  = name:symbolname
    {
      return new Dys.Variable(name);
    }

/**
 * Function name, etc
 */
symbolname "symbol name"
  = lchar:[A-Za-z] rchars:[A-Za-z0-9_]* ws?
    {
      return lchar + rchars.join("");
    }

variableDeclaration
  = type:type ws name:variable
    {
      return new Dys.VariableDeclaration(name, type);
    }

simpleTypeOrVariable
  = integer
  / float
  / string
  / variable

integerOrVariable
  = integer
  / variable

string "string"
  = "\"" contents:stringcontent* "\"" ws?
    {
      return new Dys.Literal(contents.join(""), 'string');
    }
stringcontent
  = "\\\\" { return "\\"; }
  / "\\\"" { return "\""; }
  / "\\n" { return "\n"; }
  / "\\r" { return "\r"; }
  / "\\t" { return "\t"; }
  / contents:[^\\"]+ {return contents.join(""); }

integer "integer"
  = digits:[0-9]+ ws?
  {
    return new Dys.Literal(parseInt(digits.join(""), 10), 'int');
  }

float "float"
  = leftdigits:[0-9]+ "." rightdigits:[0-9]+ ws?
  {
    return new Dys.Literal(parseFloat(leftdigits.join("") + "." + rightdigits.join(), 10), 'float');
  }

bool "boolean"
  = value:("true" / "false") ws?
  {
    return new Dys.Literal(value, 'bool');
  }

/**
 * Reserved symbols / words
 * Note that we mark these out as their own rules, and put descriptions only on these, as it makes error reporting
 * much more useful.
 */

return "return"
  = val:"return" ws? { return val; }

if "if"
  = val:"if" ws? { return val; }

else "else"
  = val:"else" ws? { return val; }

for "for"
  = val:"for" ws? { return val; }

in "in"
  = val:"in" ws? { return val; }

use "use"
  = val:"use" ws? { return val; }

lparenth "("
  = val:"(" ws? { return val; }

rparenth ")"
  = val:")" ws? { return val; }

lbracket "["
  = val:"[" ws? { return val; }

rbracket "]"
  = val:"]" ws? { return val; }

lbrace "{"
  = val:"{" ws? { return val; }

rbrace "}"
  = val:"}" ws? { return val; }

comma ","
  = val:"," ws? { return val; }
semicolon ";"
  = val:";" ws? { return val; }

doubledot ".."
  =  val:".." ws? { return val; }

elipsis "..."
  =  val:"..." ws? { return val; }
arrow "=>"
  =  val:"=>" ws? { return val; }
pipe "|"
  =  val:"|" ws? { return val; }

plus "+"
  = val:"+" ws? { return val; }
minus "-"
  = val:"-" ws? { return val; }
asterisk "*"
  = val:"*" ws? { return val; }
slash "/"
  = val:"/" ws? { return val; }

lt "<"
  = val:"<" ws? { return val; }
lte "<="
  = val:"<=" ws? { return val; }
gt "<"
  = val:">" ws? { return val; }
gte ">="
  = val:">=" ws? { return val; }
eq "=="
  = val:"==" ws? { return val; }
ne "!="
  = val:"!=" ws? { return val; }

and "&&"
  = val:"&&" ws? { return val; }
or "||"
  = val:"||" ws? { return val; }

/**
 * Whitespace
 */
ws
  = wschar* { return null; }

wschar
  = [\n\r\t ]+
  / comment

comment
  = '//' ([^\n]*) { return null; }
  / "/*" (!"*/" .)* "*/" { return null; }
