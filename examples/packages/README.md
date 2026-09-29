# Offline package example (C3)

`main.xi` imports two signed registry packages (`xiom.hello`, `xiom.csv`)
and runs without network access. The playground copies the sources of every
package a submission imports into its work directory before compiling, from
the read-only registry bundle (`XIOM_PACKAGE_BUNDLE`) when one is mounted,
or from the vendored copies in `packages/` otherwise.

Prepare and type-check it locally:

```sh
node tools/prepare-packages.js examples/packages/main.xi /tmp/pkg-demo/work
xiom --check /tmp/pkg-demo/work/main.xi
```

Running it standalone needs a toolchain where `xiom run` sees the script's
directory: on v0.62.1 the run path compiles a temp copy and cannot resolve
sibling modules or packages (compiler finding C22), so only the check stage
resolves them. The playground stages the package sources next to that temp
copy (`lib/packages.js`, `stageForRun`) and its test suite exercises the
run path; the expected output is the greeting, `rows: 3`, the three CSV
rows and `rectangular: true`.
