# Rspack CopyRspackPlugin pnpm wall-time repro

**This is a direct, reproducible wall-time regression.** With the checked-in
source and configuration, `@rspack/core@2.0.4`,
`@rspack/cli@2.0.4`, and pnpm `nodeLinker: isolated` take a **53.10 second
median** to copy one literal `index.html` file. The same one-module build takes
**0.71 seconds** when only core is 2.0.3, with the CLI still 2.0.4, and
**0.69 seconds** with core and CLI 2.0.4 plus `nodeLinker: hoisted`.

The fixture deliberately has no benchmark harness. The measurement command is
always:

```sh
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

The canonical checked-in cell is the affected one: pnpm 11.22.0,
`nodeLinker: isolated`, `@rspack/core@2.0.4`, and `@rspack/cli@2.0.4`.

## Run the checked-in affected cell

From a fresh checkout:

```sh
pnpm install --frozen-lockfile
cd apps/artifact-viewer
rm -rf dist
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

Repeat the last two commands in three separately started shell processes to
make three fresh-process trials. On macOS, `/usr/bin/time -lp` reports portable
POSIX wall time plus `maximum resident set size` and `peak memory footprint`.
On systems without that implementation, use the portable command below for
wall time, or Linux `/usr/bin/time -v` for memory.

```sh
time pnpm exec rspack build --config rspack.config.cjs
```

## Select a matrix cell without mismatched locks

Use a separate fresh checkout for each cell. That is the simplest way to avoid
pnpm retaining workspace-local `node_modules` from the other layout.

### Fixed-version control: core 2.0.3, CLI 2.0.4, isolated

Start in a fresh canonical checkout. Leave `nodeLinker: isolated` unchanged and
run this exact package command. It changes both the manifest and lockfile, so
do **not** run a frozen install after it.

```sh
pnpm --filter @copy-repro/artifact-viewer add --save-dev --save-exact @rspack/core@2.0.3
cd apps/artifact-viewer
rm -rf dist
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

`@rspack/cli` remains 2.0.4. The final raw records print both
`pnpm exec rspack --version` and the resolved core version to prove this.

### Layout control: core 2.0.4, CLI 2.0.4, hoisted

Start in a fresh canonical checkout. Change only this setting:

```yaml
nodeLinker: hoisted
```

Then clean ignored install artifacts and materialize the same canonical lock:

```sh
git clean -fdX
pnpm install --frozen-lockfile
cd apps/artifact-viewer
rm -rf dist
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

For the fourth cell, make the `nodeLinker: hoisted` edit above and then run the
core-only 2.0.3 command from the fixed-version section.

If a checkout was changed in place after this fixture has been committed,
restore the canonical version and lock before using `--frozen-lockfile`:

```sh
cd "$(git rev-parse --show-toplevel)"
git restore apps/artifact-viewer/package.json pnpm-lock.yaml pnpm-workspace.yaml
git clean -fdX
pnpm install --frozen-lockfile
```

`git clean -fdX` is appropriate only in a disposable fixture checkout. It
removes ignored `node_modules` and `dist` directories, not tracked timing logs.

## Final 2 x 2 matrix

All results below were collected on macOS arm64 with Node 24.16.0 and pnpm
11.22.0. Each cell has three fresh Rspack processes. `Max RSS` is the
`/usr/bin/time -l` `maximum resident set size`, converted to MiB.

| Core | CLI | pnpm nodeLinker | Wall-time trials (s) | Median [range] (s) | Max RSS median [range] (MiB) |
| --- | --- | --- | --- | --- | --- |
| 2.0.3 | 2.0.4 | hoisted | 0.68, 0.67, 0.72 | 0.68 [0.67, 0.72] | 209.33 [209.22, 215.41] |
| 2.0.3 | 2.0.4 | isolated | 0.71, 0.96, 0.68 | 0.71 [0.68, 0.96] | 211.58 [209.16, 213.69] |
| 2.0.4 | 2.0.4 | hoisted | 0.69, 0.68, 0.94 | 0.69 [0.68, 0.94] | 210.00 [209.64, 211.39] |
| 2.0.4 | 2.0.4 | isolated | 53.10, 52.06, 53.48 | 53.10 [52.06, 53.48] | 214.30 [211.75, 217.52] |

The final affected median clears both independent gates:

- Holding the isolated layout and CLI 2.0.4 fixed, core 2.0.4 is **74.8x**
  the core 2.0.3 median.
- Holding core and CLI 2.0.4 fixed, isolated is **77.0x** the hoisted median.
- Both affected-versus-control median deltas exceed **52 seconds**, well above
  the required 15 seconds.

Removing only `CopyRspackPlugin` from the canonical 2.0.4/2.0.4 isolated
configuration produced 0.68, 0.67, and 0.93 seconds: a **0.68 second
median**. The exact control diff is
[`logs/plugin-removal-control.diff`](logs/plugin-removal-control.diff).

The self-identifying raw `/usr/bin/time -lp` transcripts are in
[`logs/raw/final/`](logs/raw/README.md). The measurement method, candidate
reduction data, and output parity are in
[`logs/measurement-record.md`](logs/measurement-record.md).

## Deliberately small source and filesystem graph

The compiler has one JavaScript module:

```text
apps/artifact-viewer/src/index.js
```

Its entire configuration-relevant behavior is the literal copy pattern:

```js
new CopyRspackPlugin({
  patterns: [{ from: "./index.html", to: "./" }],
})
```

The checked-in workspace manifests form this transparent DAG:

```text
artifact-viewer
  -> 4 fanout packages
  -> 4 relay packages
  -> 3 branch packages
  -> 3 leaf packages
  -> @fluentui/react-icons@2.0.332
```

This is `4 * 4 * 3 * 3 = 144` distinct leaf paths. Each leaf has a real
public `@fluentui/react-icons` dependency, whose published package contains
46,742 files on the measured host. The workspace paths amplify directory
traversal without adding compiler modules or generated code.

The final graph was minimized empirically. The 13-package 108-path and
12-package 81-path candidates both failed the 50x gate; the complete candidate
table and raw transcripts are retained in
[`logs/iteration-notes.md`](logs/iteration-notes.md).

Under isolated pnpm, the clean final materialization has 15 workspace-local
`node_modules` directories and 49 workspace symlinks. Under hoisted pnpm, the
workspace links remain but leaves no longer have local public-package links; it
has 12 local `node_modules` directories and 41 workspace symlinks.

Every final 2 x 2 transcript reports the same one module, Rspack compilation
hash, and output hashes:

```text
Rspack compilation hash: 9e2b16be98e9b848
bundle.js SHA-256:      46dc534e192706175ec6ff369a7438c22e86fd1e27ce83b3190a77af076905ba
index.html SHA-256:     f37dbb8d4d8553e9182a0c4503d239a52caa88c64ff28c53e05ba66b7fbfeca0
```

## Root-cause investigation

**Source-patch proven.** The exact v2.0.4
[`patch D`](logs/source-fix/patch-D-literal-file-bypass-v2.0.4.diff) changes
only `CopyRspackPlugin` handling for `FromType::File`. After `metadata()` has
already established that the literal source exists, it returns that one path
instead of calling `find_files_by_glob` on the literal. The patch is one file,
15 additions, and 6 deletions.

The causal-verifier public fixture moves from a 39.23-second stock median to a
0.68-second patch-D median with `CopyRspackPlugin` still enabled. That matches
the 0.69-second core-2.0.3 boundary and 0.68-second plugin-removal controls,
while retaining the same compilation and output hashes. This makes the
recursive literal-file walk necessary and sufficient for the reproduced
wall-time regression.

**Office source-patch proof.** The verified Artifact Viewer Host case moves
from 673.44 seconds with stock v2.0.4 to a 0.18-second patched-D median with
the plugin present and `index.html` emitted; the verifier reports a 5.17-second
patched-D Boot result. The copied Office raw records retain the module and
missing-dependency counts alongside both timing clocks.

**Resolver #236 disproven as the cause.** Removing #236's missing-dependency
replay changes a stock 2.1.9 Boot run from 653.228 to 753.984 seconds while
leaving its 19,744 missing dependencies unchanged. The no-copy sweep remains
fast across core 2.0.1 through 2.1.9. The archived resolver work describes a
real bookkeeping behavior, but it is not the wall-time cause.

**Microsoft Defender caveat.** Locally rebuilt native bindings can receive
endpoint-protection scanning, including Microsoft Defender, which can perturb
absolute first-run timings. The source-patch conclusion relies on repeated
trials, unchanged configuration, copied raw outputs, and module/output parity,
not a single timing. It does not weaken the one-file stock-versus-D contrast.

The complete commands, exact patch, public fixture transcripts, Office
Host/Boot records, #236 A/B evidence, no-copy sweep, and caveat are in
[`logs/source-fix/`](logs/source-fix/README.md).

## Limits

Wall time depends on filesystem cache, CPU, storage, Node, pnpm, and the
platform's Rspack binary. Each recorded invocation used a fresh process and a
clean output directory, but did not flush the operating-system file cache.
Absolute times may change elsewhere; the version and layout contrast are the
signal.

The fixture is intentionally not an Office-Bohemia project and makes no claim
to reproduce every production dependency or memory behavior. It uses a compact
workspace DAG so the bad run completes in about 53 seconds rather than
requiring the more-than-ten-minute Office case.
