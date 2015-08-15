Dysphasia
=========

[![Build Status](https://travis-ci.org/sminnee/dysphasia.svg?branch=master)](https://travis-ci.org/sminnee/dysphasia)
[![Code Climate](https://codeclimate.com/github/sminnee/dysphasia/badges/gpa.svg)](https://codeclimate.com/github/sminnee/dysphasia)
[![Test Coverage](https://codeclimate.com/github/sminnee/dysphasia/badges/coverage.svg)](https://codeclimate.com/github/sminnee/dysphasia/coverage)

At a certain point in every programmer's life, one develops the desire to create a programming language. I am no
different. This is extremely experimental, and best thought of as an art project.

Dysphasia is a simple language that compiles via LLVM.

Download
--------

	git clone https://github.com/sminnee/dysphasia.git 
	cd dysphasia
	npm install

On OSX, you can use Homebrew to install LLVM, which is a dependency. Note that you have to use the `llvm36` package, not
the `llvm` one.

	brew install llvm36

If you install this package, then you will get `llvm-config-3.6`, `clang++-3.6`, `llc-3.6` and `opt-3.6` in your path. If
these tools have different binary names, please set the `LLVM_CONFIG`, `CLANG`, `LLC` and `OPT` environment variables.

Try it out
----------

It doesn't do very much right, now, but this will show a parse tree:

    node main.js examples/simple.dp

This will compile to `examples/simple`, which you can then run:

	examples/simple


Language features
=================

Because this is in development, many basic features are missing, but this is what is implemented so far.

Function blocks
---------------

Functions are defined by writing a function name, followed by a set of statements in braces. Function names must
start with a letter, and subsequent characters should be alphanumerics or _.

    main {
      return 1;
    }


Expressions
-----------

Basic mathematical expressions are supported, with `+`, `-`, `*`, `/`, and brackets for precedence:

    12 * (2 + 4)

String expressions
------------------

Strings are double quoted:

  "Hello!"

Strings can be concatenated using `+`. Any other type that is concatenated to a string will be casted to a string:

  "I've called this" + 5 + " times!"
  5 + " o'clock"
  "Lucky number" + 5

If/then/else
------------

If/then/else synax is similar to C:

    main {
      if(1) {
        puts("Hello world");
      } else {
        puts("Goodbye world");
      }
    }

Loops
-----

For loops will iterate on an array. You can simply provide a list, as a way of repeating a statement a number of times:

  for(1..10) {
    puts("Show me ten times");
  }

Use
---

The "use" statement can import a C function, such as puts. Right now it only works with functions that take
a single char* argument.

    use puts(string);
    use print(string, ...);
    main {
      puts("hello world");
      printf("I can count to %i!\n", 5);
      return 0;
    }


