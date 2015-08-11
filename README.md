Dysphasia
=========

At a certain point in every programmer's life, one develops the desire to create a programming language. I am no
different. This is extremely experimental, and best thought of as an art project.

Dysphasia is a simple language that compiles via LLVM.

Download
--------

	git clone https://github.com/sminnee/dysphasia.git 
	cd dysphasia

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