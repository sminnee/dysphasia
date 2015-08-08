Dysphasia
=========

At a certain point in every programmer's life, one develops the desire to create a programming language. I am no
different.

This is beyond experimental, and best thought of as an art project.

Download
--------


	git clone https://github.com/sminnee/dysphasia.git 
	cd dysphasia
	npm install

Recompile the parser
--------------------

The parser is defined in `src/parser/parser.pegjs` and must be recompiled if you change it:

    npm run build

Try it out
----------

It doesn't do very much right, now, but this will show a parse tree:

    node main.js examples/simple.dp