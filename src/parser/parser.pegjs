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
      return new Dys.File(new Dys.List(items));
    }

item
  = fnDef
  / useStatement

fnDef
  = type:(type ws)? name:symbolname ws? args:fnArgDef? lbrace content:blockcontent rbrace ws?
    {
      return new Dys.FnDef(
        name,
        type ? type[0] : Dys.Empty,
        args ? new Dys.List(args) : Dys.Empty,
        new Dys.List(content)
      );
    }

fnArgDef
  = lparenth ws? args:fnArgDefList ws? rparenth ws?
    {
      return args;
    }

fnArgDefList
  = left:fnSingleArgDef ws? comma ws? rest:fnArgDefList
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
      variable.type = type[0];
      return variable;
    }

blockcontent
  = ws? statements:(statementLine)*
    {
      return statements;
    }

statementLine
  = statement:statement ws? semicolon ws? {
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
  = functionCall
  / stringExpression
  / arithmeticExpression

stringExpression
  = left:simpleTypeOrVariable ws? plus ws? rest:stringExpression
    {
      return new Dys.StrConcat(left, rest);
    }
  / left:string ws? plus ws? right:simpleTypeOrVariable
    {
      return new Dys.StrConcat(left, right);
    }
  / string

/**
 * Statements can be arithmetic
 * With no variables, arithmetic expressions are compiled to their results
 */
arithmeticExpression
  = value:additive

additive
  = left:multiplicative ws? plus ws? right:additive
    {
      return new Dys.Op('+', left, right);
    }
  / multiplicative

multiplicative
  = left:primary ws? asterisk ws? right:multiplicative
    {
      return new Dys.Op('*', left, right);
    }
  / primary

primary
  = lparenth ws? additive:additive ws? rparenth
    {
      return additive;
    }
  / functionCall
  / integer
  / variable

/**
 * FunctionCall
 */
functionCall
  = name:symbolname ws? lparenth ws? arguments:functionArguments? ws? rparenth
    {
      return new Dys.FnCall(name, arguments ? new Dys.List(arguments) : Dys.Empty);
    }

functionArguments
  = argument:expression rest:extraFunctionArguments?
    {
      return rest ? [argument].concat(rest) : [argument];;
    }

extraFunctionArguments
  = ws? comma ws? argument:expression rest:extraFunctionArguments?
    {
      return rest ? [argument].concat(rest) : [argument];
    }

/**
 * If blocks
 */

ifBlock
  = if ws? lparenth ws? test:expression ws? rparenth ws? lbrace pass:blockcontent rbrace ws? fail:elseBlock?
    {
      return new Dys.IfBlock(test, new Dys.List(pass), fail ? new Dys.List(fail) : Dys.Empty);
    }
elseBlock
  = else ws? lbrace fail:blockcontent rbrace ws?
    {
      return fail;
    }

/**
 * For loops
 */
forLoop
  = for ws? lparenth ws? loopSource:loopExpression ws? rparenth ws? lbrace content:blockcontent rbrace ws?
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
  / lbracket ws? first:expression rest:extraArrayItems rbracket
    {
      return new Dys.Literal(new Dys.List(rest ? [first].concat(rest) : [first]), 'array')
    }

extraArrayItems
  = ws? comma ws? next:expression rest:extraFunctionArguments?
    {
      return next ? [next].concat(rest) : [next];
    }

/**
 * Variables
 */

/**
 * Function imports (use)
 */
useStatement
  = use ws type:(type ws)? name:symbolname ws? semicolon? ws? lparenth ws? args:useStatementParams ws? rparenth ws? semicolon? ws?
    {
      if(args && args.varArgs) {
        return new Dys.UseStatement(name, type ? type[0] : Dys.Empty, args.types, true);
      } else {
        return new Dys.UseStatement(name, type ? type[0] : Dys.Empty, args, false);
      }
    }

useStatementParams
  = types:typeList ws? "," ws? elipsis
    {
      return { varArgs: true, types: types }
    }
  / typeList

typeList
  = left:type ws? "," ws? rest:typeList
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
  / "bool")
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
  = lchar:[A-Za-z] rchars:[A-Za-z0-9_]*
    {
      return lchar + rchars.join("");
    }

variableDeclaration
  = type:type ws name:variable
    {
      return new Dys.VariableDeclaration(name, type);
    }
/**
 * Basic literals
 */
ws
  = wschar* { return null; }

wschar
  = [\n\r\t ]+
  / comment

comment
  = '//' p:([^\n]*) { return null; }

string "string"
  = "\"" contents:stringcontent* "\""
    {
      return new Dys.Literal(contents.join(""), 'string');
    }

simpleTypeOrVariable
  = integer
  / float
  / string
  / variable

integerOrVariable
  = integer
  / variable

stringcontent
  = "\\\\" { return "\\"; }
  / "\\\"" { return "\""; }
  / "\\n" { return "\n"; }
  / "\\r" { return "\r"; }
  / "\\t" { return "\t"; }
  / contents:[^\\"]+ {return contents.join(""); }

integer "integer"
  = digits:[0-9]+
  {
    return new Dys.Literal(parseInt(digits.join(""), 10), 'int');
  }

float "float"
  = leftdigits:[0-9]+ "." rightdigits:[0-9]+
  {
    return new Dys.Literal(parseFloat(leftdigits.join("") + "." + rightdigits.join(), 10), 'float');
  }

/**
 * Reserved symbols / words
 * Note that we mark these out as their own rules, and put descriptions only on these, as it makes error reporting
 * much more useful.
 */

return "return"
  = "return"

if "if"
  = "if"

else "else"
  = "else"

for "for"
  = "for"

in "in"
  = "in"

use "use"
  = "use"

lparenth "("
  = "("

rparenth ")"
  = ")"

lbracket "["
  = "["

rbracket "["
  = "["

lbrace "{"
  = "{"

rbrace "}"
  =  "}"

comma ","
  =  ","
semicolon ";"
  = ";"

doubledot ".."
  =  ".."

elipsis "..."
  =  "..."

plus "+"
  = "+"

asterisk "*"
  = "*"

