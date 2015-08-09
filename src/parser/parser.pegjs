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
  = items:block* { return compiler.handleTop(items); }

block "block"
  = name:blockname ws? "{" content:blockcontent "}" { return compiler.handleBlock(name, content); }

blockname "block name"
  = lchar:[A-Za-z] rchars:[A-Za-z0-9_]+ { return lchar + rchars.join(""); }

blockcontent
  = ws? statements:(statementLine)* { return statements; }

statementLine "statement"
  = statement:statement ws? ";" ws? { return statement; }

statement
  = expression
  / returnStatement

returnStatement
  = "return" ws expr:expression { return compiler.handleReturnStatement(expr); }

expression
  = stringExpression
  / arithmeticExpression

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
 * Function imports (use)
 */
useStatement "use statement"
  = "use" ws name:blockname { return compiler.handleUse(name); }

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
  / contents:[^\\"]+ {return contents.join(""); }

integer "integer"
  = digits:[0-9]+ { return compiler.handleInt(parseInt(digits.join(""), 10)); }

float "floating point"
  = leftdigits:[0-9]+ "." rightdigits:[0-9]+
  {
    return compiler.handleFloat(parseFloat(leftdigits.join("") + "." + rightdigits.join(), 10));
  }
