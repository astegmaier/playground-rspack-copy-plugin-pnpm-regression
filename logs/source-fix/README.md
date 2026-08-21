# Literal-file bypass causal proof

## Verdict

**Source-patch proven:** Rspack's recursive walk of a literal
`CopyRspackPlugin` source file is necessary and sufficient for the wall-time
regression in this fixture and the verified Office Artifact Viewer case.

The exact patch is
[`patch-D-literal-file-bypass-v2.0.4.diff`](patch-D-literal-file-bypass-v2.0.4.diff).
It changes one file,
`crates/rspack_plugin_copy/src/lib.rs`, with 15 additions and 6 deletions. For
`FromType::File`, after `metadata()` has already proved `abs_from` exists and
is a file, it returns `Ok(vec![abs_from.clone()])` instead of sending the
escaped literal path to `find_files_by_glob`.

This bypass leaves directory and real glob patterns on the existing glob path.
It changes no resolver logic, fixture source, copy pattern, or emitted input.

## Verification commands and variants

The public fixture used the same direct command as the root README:

```sh
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

The causal verifier ran it against stock v2.0.4 and a locally rebuilt v2.0.4
binding containing patch D. The binding build command recorded by the verifier
was:

```sh
node scripts/build.js --profile release
```

The Office verifier used the same Host and Boot compiler configurations with
stock or locally rebuilt Rspack roots. Its sequential runner invoked:

```sh
BUILD_FLAVOR=release node run-boot-compiler.mjs --rspack-root=<variant> \
  --label=<label> --result=<result.json>
```

The runner captured elapsed time, module count, missing dependencies, and
process resource fields into JSON followed by `/usr/bin/time -lp` output.
The imported raw records contain the exact observed outputs. No native binding,
build directory, or large result blob is copied here.

## Public fixture: necessity and sufficiency

These are external causal-verifier trials on the public fixture. They are
separate from the root README's final 14-package timing matrix and retained
here because they isolate the source patch.

| Variant | Wall-time trials (s) | Median (s) | Interpretation |
| --- | --- | ---: | --- |
| Stock core 2.0.4 | 40.81, 39.14, 39.23 | 39.23 | Literal file uses the recursive glob walk. |
| Core 2.0.4 + patch D | 0.68, 0.67, 0.92 | 0.68 | Only the literal-file walk is bypassed. |
| Core 2.0.3 boundary | 0.69, 0.66, 1.04 | 0.69 | Matches the patched behavior. |
| Root fixture plugin-removal control | 0.68, 0.67, 0.93 | 0.68 | Matches the patched behavior without the plugin. |

The stock and patched D public runs retain the same compilation hash
`9e2b16be98e9b848`; the verifier also established identical emitted output
hashes. The copy plugin remains enabled and `index.html` remains emitted for
patch D. This rules out a broad optimizer, resolver, output, or module-graph
explanation for the collapse from 39.23 seconds to 0.68 seconds.

Raw files:

```text
raw/fixture-stock-2.0.4-t{1,2,3}.log
raw/fixture-patchedD-2.0.4-t{1,2,3}.log
raw/boundary-core2.0.{3,4}-t{1,2,3}.log
```

## Office Artifact Viewer proof

With the Host configuration's `CopyRspackPlugin` still enabled and
`index.html` still emitted:

| Operation | Stock v2.0.4 | Patch D | Proven implication |
| --- | ---: | ---: | --- |
| Host | 673.44 s | 0.18 s median | Patch D collapses the same production slow path. |
| Boot | Slow stock path | 5.17 s verifier result | The patched build returns to a normal Boot duration. |

The copied Host records show patch-D `/usr/bin/time` values of 0.71, 0.18, and
0.18 seconds. The Boot records retain both internal `elapsedSeconds` and
external `/usr/bin/time` values; use the raw files for per-trial clock details
rather than combining them. The verifier's reported Boot result is 5.17
seconds.

The stock Host record has 151 modules and 299 missing dependencies. Patch-D
Host records retain those values while moving processing-assets timing from the
stock 673-second path to milliseconds. This confirms the patch does not
achieve its result by changing the module graph or resolver bookkeeping.

Raw files:

```text
raw/v2.0.4-stock-host-timed.log
raw/v2.0.4-localD-host-t{1,2,3}.log
raw/v2.0.4-localD-boot-t{1,2,3}.log
```

## Resolver #236 is not the wall-time cause

[`patch-B-remove-pr236.diff`](patch-B-remove-pr236.diff) removes the
`ctx.add_missing_dependency(self.path.join("node_modules"))` replay associated
with resolver #236. The A/B result disproves it as the cause of this wall-time
issue:

| Core 2.1.9 variant | Boot elapsed (s) | Missing dependencies |
| --- | ---: | ---: |
| Stock resolver, local A | 653.228 | 19,744 |
| #236 replay removed, local B | 753.984 | 19,744 |

Removing #236 does not collapse the slow path; it is slower in this A/B run
and has identical missing dependencies. The no-copy sweep is also fast from
core 2.0.1 through 2.1.9, with copied summary values between 3.70 and 5.63
seconds for the sampled Boot runs. The resolver replay remains a real
bookkeeping behavior, but it is definitively not the cause of this wall-time
regression.

Raw A/B records are:

```text
raw/v2.1.9-localA-run1.log
raw/v2.1.9-localB-run1.log
```

`SUMMARY.json` retains the complete concise no-copy sweep and all verifier
result rows.

## Microsoft Defender caveat

Locally rebuilding or swapping a native Rspack binding can trigger Microsoft
Defender or other endpoint-protection scanning. That can perturb first-run
absolute wall time and is one reason the proof relies on repeated trials,
unchanged configuration, retained raw timings, and output/module parity rather
than a single elapsed value.

The caveat does not restore #236 as a plausible wall-time cause: patch B did
not collapse the issue, while the one-file patch D consistently collapses it
in both the public fixture and Office Host case with the copy plugin still
enabled. Treat absolute host-specific timings as environment-sensitive; treat
the stock-versus-D causal contrast as the supported conclusion.

## Imported text artifacts

| File or directory | Contents |
| --- | --- |
| `patch-D-literal-file-bypass-v2.0.4.diff` | Exact one-file causal fix. |
| `patch-B-remove-pr236.diff` | Exact resolver #236 A/B patch. |
| `SUMMARY.json` | Concise verifier result sweep. |
| `raw/` | Public fixture, version-boundary, Office Host/Boot, and #236 A/B logs. |

All imported files are text and total less than 100 KB. No native binary,
`node_modules`, output directory, or large result JSON is retained.
