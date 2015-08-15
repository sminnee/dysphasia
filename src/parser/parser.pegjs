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
  = block
  / useStatement
  / comment

block "block"
  = name:symbolname ws? "{" content:blockcontent "}" ws?
    {
      return new Dys.FnDef(name, new Dys.List(content));
    }

blockcontent
  = ws? statements:(statementLine)*
    {
      return statements;
    }

statementLine "statement"
  = statement:statement ws? ";" ws? {
    return statement;
  }

statement
  = ifBlock
  / forLoop
  / returnStatement
  / expression

returnStatement
  = "return" ws expr:expression
    {
      return new Dys.ReturnStatement(expr);
    }

expression
  = stringExpression
  / arithmeticExpression
  / functionCall

stringExpression
  = value:string

/**
 * Statements can be arithmetic
 * With no variables, arithmetic expressions are compiled to their results
 */
arithmeticExpression
  = value:additive

additive
  = left:multiplicative ws? "+" ws? right:additive
    {
      return new Dys.Op('+', left, right);
    }
  / multiplicative

multiplicative
  = left:primary ws? "*" ws? right:multiplicative
    {
      return new Dys.Op('*', left, right);
    }
  / primary

primary
  = integer
  / "(" ws? additive:additive ws? ")"
    {
      return additive;
    }

/**
 * FunctionCall
 */
functionCall 
  = name:symbolname ws? "(" ws? arguments:functionArguments? ws? ")"
    {
      return new Dys.FnCall(name, arguments ? new Dys.List(arguments) : Dys.Empty);
    }

functionArguments
  = argument:expression rest:extraFunctionArguments?
    {
      return rest ? [argument].concat(rest) : [argument];;
    }

extraFunctionArguments
  = ws? "," ws? argument:expression rest:extraFunctionArguments?
    { 
      return rest ? [argument].concat(rest) : [argument]; 
    }

/**
 * If blocks
 */

ifBlock "if block"
  = "if" ws? "(" ws? test:expression ws? ")" ws? "{" pass:blockcontent "}" ws? fail:elseBlock?
    {
      return new Dys.IfBlock(test, new Dys.List(pass), fail ? new Dys.List(fail) : Dys.Empty);
    }
elseBlock "else block"
  = "else" ws? "{" fail:blockcontent "}" ws?
    {
      return fail;
    }

/**
 * For loops
 */
forLoop "for loop"
  = "for" ws? "(" ws? loopSource:loopExpression ws? ")" ws? "{" content:blockcontent "}" ws?
    { return new Dys.ForLoop(
        loopSource.variable ? loopSource.variable : Dys.Empty,
        loopSource.expression,
        new Dys.List(content)
      );
    }

loopExpression "loop expression"
  = expression:arrayExpression { return { variable: null, expression: expression }; }
  / variable:symbolname ws "in" ws expression:arrayExpression { return { variable: null, expression: expression }; }

arrayExpression
  = arrayLiteral
  / symbolname

arrayLiteral
  = start:integer ".." end:integer { return new Dys.Literal('range', { start: start, end: end }); }
  / "[" ws? first:expression rest:extraArrayItems "]"
    {
      return new Dys.Literal('array', new Dys.List(rest ? [first].concat(rest) : [first]))
    }

extraArrayItems
  = ws? "," ws? next:expression rest:extraFunctionArguments?
    {
      return next ? [next].concat(rest) : [next];
    }

/**
 * Variables
 */

/**
 * Function imports (use)
 */
useStatement "use statement"
  = "use" ws name:symbolname ws? ";"? ws? "(" ws? args:useStatementParams ws? ")" ws? ";"? ws?
    {
      if(args && args.varArgs) {
        return new Dys.UseStatement(name, args.types, true);
      } else {
        return new Dys.UseStatement(name, args, false);
      }
    }

useStatementParams "type list"
  = types:typeList ws? "," ws? "..."
    {
      return { varArgs: true, types: types }
    }
  / typeList

typeList "type list"
  = left:type ws? "," ws? rest:typeList
    {
      return new Dys.List([left, rest]);
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

/**
 * Function name, etc
 */
symbolname "symbol name"
  = lchar:[A-Za-z] rchars:[A-Za-z0-9_]+
    {
      return lchar + rchars.join("");
    }

/**
 * Basic literals
 */
ws "whitespace"
  = wschar { return null; }
  / comment { return null; }

wschar "whitespace character"
  = [\n\r\t ]+

comment "comment"
  = wschar? '//' p:([^\n]*) wschar? { return "" }

string "string"
  = "\"" contents:stringcontent* "\""
    {
      return new Dys.Literal('string', contents.join(""));
    }

stringcontent "string content"
  = "\\\\" { return "\\"; }
  / "\\\"" { return "\""; }
  / "\\n" { return "\n"; }
  / "\\r" { return "\r"; }
  / "\\t" { return "\t"; }
  / contents:[^\\"]+ {return contents.join(""); }

integer "integer"
  = digits:[0-9]+
  {
    return new Dys.Literal('int', parseInt(digits.join(""), 10));
  }

float "floating point"
  = leftdigits:[0-9]+ "." rightdigits:[0-9]+
  {
    return new Dys.Literal('float', parseFloat(leftdigits.join("") + "." + rightdigits.join(), 10));
  }
