# C24: `io.read_line()` is broken on v0.62.1 (bad pointer codegen)

Playground finding C24 (AUDIT 33.5). Standard input cannot be read on the
pinned toolchain: the compiled program either prints an empty line or
aborts in glibc. This blocks text-input lessons; the playground does not
teach `io.read_line()` until this is fixed.

## Repro

```sh
bash run.sh /path/to/v0.62.1/toolchain    # or set XIOM_TOOLCHAIN
```

Manual form:

```sh
# run mode: silently returns an empty string
printf 'Ada\n' | xiom run --no-cache read_line.xi
#   got: []
#   exit code: 0

# compile mode: aborts inside glibc
xiom -o prog.exe read_line.xi
printf 'Ada\n' | ./prog.exe
#   Fatal error: glibc detected an invalid stdio handle
#   (core dumped, exit 134)
```

Expected after the fix: `got: [Ada]` in both modes.

## Root cause (from the binary, no source needed)

`lib/runtime/xiom_runtime.c` correctly returns the FILE*:

```c
void* xiom_stdin(void) { return (void*)stdin; }
```

and the compiled `xiom_stdin` does return the real FILE*:

```asm
xiom_stdin:
  mov  0x115e1(%rip),%rax   # &stdin (GOT)
  mov  (%rax),%rax          # FILE* value
  ret
```

The caller, however, passes a pointer to a one-byte stack slot instead of
that value:

```asm
call  xiom_stdin
mov   %al,0x7(%rsp)     # <- truncates the pointer to one byte
lea   0x7(%rsp),%rdx    # <- fgets FILE* argument = &rsp[7]
```

So `fgets(buf, 4096, <bad pointer>)` runs with a bogus stdio handle. The
stdlib call site is `fgets(buf, 4096, xiom_stdin() as *UInt8)` in
`lib/xiom/io/io.xi` / `console.xi`; every stdin function goes through it
(`read_line`, `read_line_trim`, `console_read_line`, `read_char`, ...).
The pointer-cast lowering for the extern call (`-> Int`, then `as *UInt8`)
appears to store the value to a temporary and pass its address rather
than passing the value as the pointer.

## Environment

- Pinned toolchain v0.62.1 (`/home/lefteris/xiom_v0621/tc`), WSL2 Ubuntu,
  kernel `6.6.87.2-microsoft-standard-WSL2`, Ubuntu clang 18.1.3.
- Same result with a fresh `HOME`/script cache and `--no-cache`.

## After the fix

`run.sh` is the playground's acceptance check: it pipes `Ada` in and
expects `got: [Ada]`. Once it passes, the playground wires the stdin
field through `/api/compile` (the runner already supports an `input`
option) and adds the input box + sample-input field to lessons.
