	.section	__TEXT,__text,regular,pure_instructions
	.macosx_version_min 14, 4
	.globl	_main
	.align	4, 0x90
_main:                                  ## @main
	.cfi_startproc
## BB#0:                                ## %IfTrue7
	pushq	%rax
Ltmp0:
	.cfi_def_cfa_offset 16
	leaq	l_str1(%rip), %rdi
	callq	_puts
	xorl	%eax, %eax
	popq	%rdx
	retq
	.cfi_endproc

	.globl	_other
	.align	4, 0x90
_other:                                 ## @other
	.cfi_startproc
## BB#0:
	movl	$11, %eax
	retq
	.cfi_endproc

	.section	__TEXT,__const
l_str1:                                 ## @str1
	.ascii	"hello world"


.subsections_via_symbols
