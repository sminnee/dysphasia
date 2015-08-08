/**
 * Dysphasia parser
 */

/**
 * Each dp file containers a number of named blocks.
 */
start
  = block *

block "block"
  = name:blockname ws? "{" content:blockcontent "}" { return { type: "block", name: name, statements: content } } 

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
  = "return" ws expr:expression { return [ 'return', expr ]; }

expression
  = stringExpression
  / arithmeticExpression

stringExpression
  = value:string { return { type: 'stringExpression', value: value } }

/**
 * Statements can be arithmetic
 * With no variables, arithmetic expressions are compiled to their results
 */
arithmeticExpression
  = additive

additive
  = left:multiplicative ws? "+" ws? right:additive { return left + right; }
  / multiplicative

multiplicative
  = left:primary ws? "*" ws? right:multiplicative { return left * right; }
  / primary

primary
  = integer
  / "(" ws? additive:additive ws? ")" { return additive; }


/**
 * Basic literals
 */
ws "whitespace"
  = [\n\r\t ]+ { return null; }

string "string"
  = "\"" contents:stringcontent* "\"" { return contents.join(""); }

stringcontent "string content"
  = "\\\\" { return "\\"; }
  / "\\\"" { return "\""; }
  / contents:[^\\"]+ {return contents.join(""); }

integer "integer"
  = digits:[0-9]+ { return parseInt(digits.join(""), 10); }

float "floating point"
  = leftdigits:[0-9]+ "." rightdigits:[0-9]+ { return parseFloat(leftdigits.join("") + "." + rightdigits.join(), 10); }
