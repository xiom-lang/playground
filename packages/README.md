# Vendored packages

Offline copies of the two signed registry packages requested for C3,
extracted byte-for-byte from the verified registry bundle
(`registry-bundle.tar.gz` sha256 `aed9703a4abbc0b11ee13b9b21def1fb992a51766c97c9186e367c3a97367da5`,
`index.json` sha256 `02280fa79e28c34a76a0c9e02a57eb47bfa570cf17698d4f60ad8238c723a21d`).

| Package | Version | Artifact sha256 (bundle.json) | Published |
|---|---|---|---|
| `xiom.hello` | 0.1.0 | `2fc7a2aa296abe93dcda09c52787b5c31d9e0b87d6bba338c69c94103ab5d6e8` | 2026-09 |
| `xiom.csv` | 0.1.0 | `8d779431129a3421210cec34c5052c1b5b2a7f594abb4a203a5f2105d28fabb5` | 2026-09 |

`lib/packages.js` copies `package.xi` and `src/` from these trees into a
submission's work directory when the program imports the module, which is
where the compiler's single-file module discovery finds `use xiom.hello;` /
`use xiom.csv;` offline. A read-only mount of the full 343-package bundle
(`XIOM_PACKAGE_BUNDLE`, see `DEPLOY.md`) extends the same mechanism to every
package in the export; these two are the always-available baseline.

To refresh a vendored package: extract its artifact from the bundle
(`artifacts/<name>/<version>/package.tar.gz`), replace the directory, and
update the hash in this table. The digests above are the `bundle.json`
artifact digests, so a refresh is verifiable against a fresh bundle.
