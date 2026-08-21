# Rspack source investigation

> **Causal status update:** The former source-only hypothesis is now
> source-patch proven. See the exact one-file patch and verifier evidence in
> [`source-fix/`](source-fix/README.md).

## Historical public-source context

| Source | Observation |
| --- | --- |
| [Commit `7cf13166ba`](https://github.com/web-infra-dev/rspack/commit/7cf13166ba23eae192aac0fb25877415b3c8e8d4) | Commit message: `fix(copy-plugin): support JS input file system for glob copies (#14023)`. |
| [PR #14023](https://github.com/web-infra-dev/rspack/pull/14023) | Merged 2026-05-18; merge commit is `7cf13166ba23eae192aac0fb25877415b3c8e8d4`. |
| [`glob_utils.rs` at the commit](https://raw.githubusercontent.com/web-infra-dev/rspack/7cf13166ba23eae192aac0fb25877415b3c8e8d4/crates/rspack_core/src/glob_utils.rs) | Adds `find_files_by_glob`, `extract_glob_base_dir`, and recursive `walk_dir`. |
| [`rspack_plugin_copy/src/lib.rs` at the commit](https://raw.githubusercontent.com/web-infra-dev/rspack/7cf13166ba23eae192aac0fb25877415b3c8e8d4/crates/rspack_plugin_copy/src/lib.rs) | Sends file, directory, and glob copy patterns through `find_files_by_glob`. |
| [Pre-commit copy plugin source](https://raw.githubusercontent.com/web-infra-dev/rspack/41524b1105609577497c2ce9c8b1376af0ad41ee/crates/rspack_plugin_copy/src/lib.rs) | Uses Rust `glob::glob_with` rather than the custom walker. |

The public `v2.0.3...v2.0.4` GitHub comparison response lists
`7cf13166ba` among the 2.0.4-side commits. Its comparison status is
`diverged`, so this is release-range evidence rather than a claim of simple
linear tag ancestry.

## What the literal-file path did

For `from: "./index.html"`, the copy plugin identifies an existing file,
escapes its path, and sends that literal query to `find_files_by_glob`.
The custom glob implementation extracts the literal file's parent directory
and recursively walks descendants. In the isolated layout, that reaches the
workspace package-local symlink graph.

## What patch D proves

[`source-fix/patch-D-literal-file-bypass-v2.0.4.diff`](source-fix/patch-D-literal-file-bypass-v2.0.4.diff)
changes only the `FromType::File` branch in
`crates/rspack_plugin_copy/src/lib.rs`. It returns the already-confirmed
literal `abs_from` path directly and leaves directories and real globs on the
existing glob walk.

The stock-to-patched public fixture collapse, unchanged compilation/output
hashes, and Office Host collapse with the copy plugin and `index.html` still
present prove that this literal-file recursive walk is the causal slow path.
The detailed measurements and raw evidence are retained in
[`source-fix/README.md`](source-fix/README.md).

## Resolver correction

The original investigation considered resolver #236 because it replays a
missing `node_modules` dependency. Patch B removes that replay, yet the 2.1.9
Boot case remains slow and increases from 653.228 to 753.984 seconds with
identical 19,744 missing dependencies. Resolver #236 is therefore not the
wall-time cause; see
[`source-fix/patch-B-remove-pr236.diff`](source-fix/patch-B-remove-pr236.diff).
