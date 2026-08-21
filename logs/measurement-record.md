# Direct timing record

## Environment

The final trials were collected on 2026-08-20 with:

| Field | Value |
| --- | --- |
| Operating system | macOS, arm64 |
| Node | v24.16.0 |
| pnpm | 11.22.0 |
| Time command | `/usr/bin/time -lp` |
| Rspack CLI in all final cells | 2.0.4 |
| Canonical checked-in cell | core 2.0.4, CLI 2.0.4, pnpm `nodeLinker: isolated` |

`/usr/bin/time -l` reports `maximum resident set size` in bytes on this host.
The tables convert that value to MiB using `bytes / 1048576`. It also reports
`peak memory footprint`; this record consistently uses the former.

## Materialization and transcript protocol

1. The workspace layout was fully materialized for the selected
   `nodeLinker` before any timings.
2. Switching from isolated to hoisted required removing root and workspace
   `node_modules` directories. A plain `pnpm install` did not remove formerly
   isolated workspace-local directories on this machine.
3. Each trial started a new `pnpm exec rspack` process and removed only
   `apps/artifact-viewer/dist` first.
4. The direct timing command was `/usr/bin/time -lp pnpm exec rspack build
   --config rspack.config.cjs`. No benchmark script, wrapper, compiler API, or
   generated package was used.
5. The operating-system file cache was not flushed.

Every final raw transcript is self-identifying. Before the direct time command
it records:

- `pnpm exec rspack --version`;
- the resolved `@rspack/core` package version and real path;
- `pnpm config get node-linker`;
- the package-manifest count, workspace-local `node_modules` count, and
  symlink count;
- the leaf `@fluentui/react-icons` symlink and realpath, or its intentional
  absence under hoisted pnpm.

The direct time output then supplies the compilation hash, one-module stats,
wall time, memory, and output SHA-256 values. The plugin-removal records also
embed the exact diff retained in
[`plugin-removal-control.diff`](plugin-removal-control.diff).

The clean final isolated layout has 15 workspace-local `node_modules`
directories and 49 workspace symlinks:

```text
artifact-viewer:       6 links
4 fanout packages:    16 links
4 relay packages:     12 links
3 branch packages:     9 links
3 leaf packages:       6 links
```

The clean final hoisted layout has 12 workspace-local `node_modules`
directories and 41 workspace symlinks. The app, fanout, relay, and branch
workspace links remain; leaves no longer carry local
`@fluentui/react-icons` and `react` links.

## Final matrix calculations

| Core | CLI | nodeLinker | Wall-time values (s) | Wall median [range] (s) | Max RSS values (MiB) | RSS median [range] (MiB) |
| --- | --- | --- | --- | --- | --- | --- |
| 2.0.3 | 2.0.4 | hoisted | 0.68, 0.67, 0.72 | 0.68 [0.67, 0.72] | 209.22, 209.33, 215.41 | 209.33 [209.22, 215.41] |
| 2.0.3 | 2.0.4 | isolated | 0.71, 0.96, 0.68 | 0.71 [0.68, 0.96] | 211.58, 213.69, 209.16 | 211.58 [209.16, 213.69] |
| 2.0.4 | 2.0.4 | hoisted | 0.69, 0.68, 0.94 | 0.69 [0.68, 0.94] | 210.00, 211.39, 209.64 | 210.00 [209.64, 211.39] |
| 2.0.4 | 2.0.4 | isolated | 53.10, 52.06, 53.48 | 53.10 [52.06, 53.48] | 214.30, 217.52, 211.75 | 214.30 [211.75, 217.52] |

The focused comparisons are:

```text
core 2.0.4 isolated / core 2.0.3 isolated = 53.10 / 0.71 = 74.8x
core 2.0.4 isolated / core 2.0.4 hoisted  = 53.10 / 0.69 = 77.0x
```

Both calculations hold `@rspack/cli` at 2.0.4.

The causal control removes only `CopyRspackPlugin` from the final
2.0.4/2.0.4 isolated configuration:

| Configuration | Wall-time values (s) | Wall median [range] (s) | Max RSS median [range] (MiB) |
| --- | --- | --- | --- |
| 2.0.4 core / 2.0.4 CLI isolated, plugin removed | 0.68, 0.67, 0.93 | 0.68 [0.67, 0.93] | 209.92 [209.02, 212.00] |

## Empirical graph minimization

Each candidate used three affected 2.0.4/2.0.4 isolated processes, three
core-only 2.0.3/2.0.4 isolated processes, and three 2.0.4/2.0.4 hoisted
processes. The same direct command and self-identifying transcript format were
used for every trial.

| Packages | DAG paths | Affected median [range] | Core-only isolated median | Ratio | Affected hoisted median | Ratio | Result |
| --- | ---: | --- | --- | ---: | --- | ---: | --- |
| 14 | `4 x 4 x 3 x 3 = 144` | 51.99 [50.98, 52.36] s | 0.92 s | 56.5x | 0.95 s | 54.7x | Kept |
| 13 | `3 x 4 x 3 x 3 = 108` | 38.86 [38.39, 39.96] s | 0.90 s | 43.2x | 1.01 s | 38.5x | Fails both gates |
| 12 | `3 x 3 x 3 x 3 = 81` | 30.23 [30.07, 30.31] s | 0.74 s | 40.9x | 0.69 s | 43.8x | Fails both gates |

The 13-package shape is the first attempted reduction below 14 and fails the
50x gate. The requested additional 12-package reduction also fails, so no
smaller shape can replace the retained 14-package graph without losing the
required signal.

## Module and output parity

Every final 2 x 2 transcript lists one compiled source module:

```text
./src/index.js 51 bytes [built] [code generated]
```

The same Rspack compilation hash appears in every copied final cell:

```text
9e2b16be98e9b848
```

Each copied final cell has these output hashes:

```text
46dc534e192706175ec6ff369a7438c22e86fd1e27ce83b3190a77af076905ba  bundle.js
f37dbb8d4d8553e9182a0c4503d239a52caa88c64ff28c53e05ba66b7fbfeca0  index.html
```

The plugin-removal control intentionally has no copied `index.html`; its
`bundle.js` hash remains the same.

## Raw records

The 12 final matrix transcripts are in
[`raw/final/`](raw/README.md):

```text
final-core-2.0.3-cli-2.0.4-hoisted-copy-trial-{1,2,3}.txt
final-core-2.0.3-cli-2.0.4-isolated-copy-trial-{1,2,3}.txt
final-core-2.0.4-cli-2.0.4-hoisted-copy-trial-{1,2,3}.txt
final-core-2.0.4-cli-2.0.4-isolated-copy-trial-{1,2,3}.txt
```

The three plugin-removal records are:

```text
final-core-2.0.4-cli-2.0.4-isolated-copy-removed-trial-{1,2,3}.txt
```

Candidate transcripts are in [`raw/candidates/`](raw/candidates/), and
superseded pre-review records remain in
[`raw/archive-pre-review/`](raw/archive-pre-review/).
