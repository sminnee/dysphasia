/**
 * Dysphasia parser
 */

{
  var compiler = options.compiler;
}

/**
 * Each dp file containers a number of named blocks.
 */
start
  = ws? items:item* { return compiler.handleTop(items); }

item
  = block
  / useStatement

block "block"
  = name:symbolname ws? "{" content:blockcontent "}" ws? { return compiler.handleBlock(name, content); }

blockcontent
  = ws? statements:(statementLine)* { return statements; }

statementLine "statement"
  = statement:statement ws? ";" ws? { return statement; }

statement
  = ifBlock
  / forLoop
  / returnStatement
  / expression

returnStatement
  = "return" ws expr:expression { return compiler.handleReturnStatement(expr); }

expression
  = stringExpression
  / arithmeticExpression
  / functionCall

stringExpression
  = value:string { return compiler.handleStringExpression(value); }

/**
 * Statements can be arithmetic
 * With no variables, arithmetic expressions are compiled to their results
 */
arithmeticExpression
  = value:additive { return compiler.handleArithmeticExpression(value); }

additive
  = left:multiplicative ws? "+" ws? right:additive { return compiler.handleAdd(left, right); }
  / multiplicative

multiplicative
  = left:primary ws? "*" ws? right:multiplicative { return compiler.handleMul(left, right); }
  / primary

primary
  = integer
  / "(" ws? additive:additive ws? ")" { return additive; }

/**
 * FunctionCall
 */
functionCall 
  = name:symbolname ws? "(" ws? arguments:functionArguments? ws? ")"
    {
      return compiler.handleFunctionCall(name, arguments ? arguments : [] );
    }

functionArguments
  = argument:expression rest:extraFunctionArguments?
    {
      return rest ? [argument].concat(rest) : [argument];;
    }

extraFunctionArguments
  = ws? "," ws? argument:expression rest:extraFunctionArguments? { 
    return rest ? [argument].concat(rest) : [argument]; 
  }

/**
 * If blocks
 */

ifBlock "if block"
  = "if" ws? "(" ws? test:expression ws? ")" ws? "{" pass:blockcontent "}" ws? fail:elseBlock?
    { return compiler.handleIfBlock(test, pass, fail); }
elseBlock "else block"
  = "else" ws? "{" fail:blockcontent "}" ws?
    { return fail; }

/**
 * For loops
 */
forLoop "for loop"
  = "for" ws? "(" ws? loopSource:loopExpression ws? ")" ws? "{" content:blockcontent "}" ws?
    { return compiler.handleForLoop(loopSource.variable, loopSource.expression, content); }

loopExpression "loop expression"
  = expression:arrayExpression { return { variable: null, expression: expression }; }
  / variable:symbolname ws "in" ws expression:arrayExpression { return { variable: null, expression: expression }; }

arrayExpression
  = arrayLiteral
  / symbolname

arrayLiteral
  = start:integer ".." end:integer { return compiler.handleIntRange(start, end); }
  / "[" ws? first:expression rest:extraArrayItems "]"
    {
      return compiler.handleArrayDefinition(rest ? [first].concat(rest) : [first]);
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
  = "use" ws name:symbolname ws? ";"? ws? { return compiler.handleUse(name); }

/**
 * Function name, etc
 */
symbolname "symbol name"
  = lchar:[A-Za-z] rchars:[A-Za-z0-9_]+ { return lchar + rchars.join(""); }

/**
 * Basic literals
 */
ws "whitespace"
  = [\n\r\t ]+ { return null; }

string "string"
  = "\"" contents:stringcontent* "\"" { return compiler.handleString(contents.join("")); }

stringcontent "string content"
  = "\\\\" { return "\\"; }
  / "\\\"" { return "\""; }
  / "\\n" { return "\n"; }
  / "\\r" { return "\r"; }
  / "\\t" { return "\t"; }
  / contents:[^\\"]+ {return contents.join(""); }

integer "integer"
  = digits:[0-9]+ { return compiler.handleInt(parseInt(digits.join(""), 10)); }

float "floating point"
  = leftdigits:[0-9]+ "." rightdigits:[0-9]+
  {
    return compiler.handleFloat(parseFloat(leftdigits.join("") + "." + rightdigits.join(), 10));
  }
