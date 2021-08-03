	.section	__TEXT,__text,regular,pure_instructions
	.macosx_version_min 14, 5
	.globl	_main
	.align	4, 0x90
_main:                                  ## @main
	.cfi_startproc
## BB#0:
	pushq	%rbp
Ltmp0:
	.cfi_def_cfa_offset 16
Ltmp1:
	.cfi_offset %rbp, -16
	movq	%rsp, %rbp
Ltmp2:
	.cfi_def_cfa_register %rbp
	pushq	%r15
	pushq	%r14
	pushq	%r12
	pushq	%rbx
Ltmp3:
	.cfi_offset %rbx, -48
Ltmp4:
	.cfi_offset %r12, -40
Ltmp5:
	.cfi_offset %r14, -32
Ltmp6:
	.cfi_offset %r15, -24
	leaq	l_str(%rip), %r15
	leaq	L_str2(%rip), %r14
	xorl	%r12d, %r12d
	.align	4, 0x90
LBB0_1:                                 ## %Loop
                                        ## =>This Inner Loop Header: Depth=1
	movl	(%r15), %ecx
	movq	%rsp, %rbx
	addq	$-112, %rbx
	movq	%rbx, %rsp
	movl	$100, %esi
	xorl	%eax, %eax
	movq	%rbx, %rdi
	movq	%r14, %rdx
	callq	_snprintf
	movq	%rbx, %rdi
	callq	_puts
	incl	%r12d
	addq	$4, %r15
	cmpl	$5, %r12d
	jb	LBB0_1
## BB#2:                                ## %Continue
	xorl	%eax, %eax
	leaq	-32(%rbp), %rsp
	popq	%rbx
	popq	%r12
	popq	%r14
	popq	%r15
	popq	%rbp
	retq
	.cfi_endproc

	.section	__TEXT,__const
	.align	4                       ## @str
l_str:
	.long	1                       ## 0x1
	.long	4                       ## 0x4
	.long	9                       ## 0x9
	.long	16                      ## 0x10
	.long	25                      ## 0x19

	.section	__TEXT,__cstring,cstring_literals
L_str2:                                 ## @str2
	.asciz	"x = %i"


.subsections_via_symbols
