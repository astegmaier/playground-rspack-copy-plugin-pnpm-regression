# Iteration notes and discarded candidates

## Why the original fixture was removed from the headline

The former repository root measured a different mechanism: resolver
warm-cache missing-dependency replay. It had a large public import graph,
custom compiler API benchmarking, resolver probes, watch runs, and tests. Its
data remains under `logs/`, but it did not demonstrate the decisive
CopyRspackPlugin wall-time ablation.

The current root therefore has only the literal copy configuration, one trivial
entry module, package manifests that form the filesystem DAG, a canonical lock
file, and documentation.

## Historical candidate history

| Iteration | Shape and result | Decision |
| --- | --- | --- |
| Existing rich root graph plus CopyRspackPlugin | Rspack 2.1.9/isolated completed in 9.67 s. | Confirmed that the copy plugin could dominate, but retained the old resolver graph and was not a clean repro. |
| Nested app with direct public dependencies only | Rspack 2.0.4/isolated took 2.06 s with the app directory as context. | Too small; public package symlinks alone did not expose nested workspace `node_modules` paths. |
| Workspace-root copy context | 2.0.4/isolated took 11.90 s; 2.0.3 took 1.25 s. The hoisted 2.0.4 run exceeded 360 s and was stopped. | Rejected because the root `node_modules` scan made the layout contrast less direct and the bad run impractical. |
| 4 fanout x 4 branch x 3 leaf workspace DAG | 48 leaf paths; 2.0.4/isolated took 17.62 s. | Proved the local-workspace-link approach but did not meet the preferred 50x target. |
| Initial 4 x 4 x 4 x 3 DAG | Intended 192 paths. An in-place materialization retained obsolete links, producing 240 paths and 85.92 to 87.87 s. | Preserved in `raw/archive-pre-review/`; excluded from all current claims. |

## Reviewer-requested minimization

The initial 15-package graph was reduced with the CLI fixed at 2.0.4 in every
version-toggle cell. Every candidate has three affected isolated trials, three
core-only isolated controls, and three affected hoisted controls. Raw evidence
is in [`raw/candidates/`](raw/candidates/).

| Packages | Graph | Affected isolated median [range] | Core 2.0.3 isolated median | Ratio | Core 2.0.4 hoisted median | Ratio | Decision |
| --- | --- | --- | --- | ---: | --- | ---: | --- |
| 14 | `4 x 4 x 3 x 3 = 144` | 51.99 [50.98, 52.36] s | 0.92 s | 56.5x | 0.95 s | 54.7x | Retained |
| 13 | `3 x 4 x 3 x 3 = 108` | 38.86 [38.39, 39.96] s | 0.90 s | 43.2x | 1.01 s | 38.5x | Rejected |
| 12 | `3 x 3 x 3 x 3 = 81` | 30.23 [30.07, 30.31] s | 0.74 s | 40.9x | 0.69 s | 43.8x | Rejected |

The 13-package reduction fails both 50x gates. The requested additional
12-package reduction also fails both gates, so the retained 14-package shape
is the smallest empirically demonstrated shape that meets the requirement.

## Final graph and clean-materialization correction

The final checked-in graph has exactly:

```text
4 app -> fanout edges
16 fanout -> relay edges
12 relay -> branch edges
9 branch -> leaf edges
6 leaf -> public-package edges
49 total isolated workspace/package-local links
```

The clean isolated materialization has 15 workspace-local `node_modules`
directories. The clean hoisted materialization has 12 directories and 41
workspace links because leaf public-package links are no longer local.

Earlier iterations showed that deleting only root `node_modules` did not
remove pre-existing isolated package-local `node_modules` directories. Every
current candidate and final layout was materialized after explicitly removing
root and workspace-local directories. The older contaminated raw records are
retained only under `raw/archive-pre-review/`.

## Design tradeoffs retained in the final fixture

- `@fluentui/react-icons@2.0.332` is a real public package with a large,
  transparent published file tree. No source file is generated to inflate the
  scan.
- Fourteen tiny workspace package manifests are more legible than hundreds of
  dummy files. Each edge exists only to create an explicit repeated symlink
  path.
- The entry does not import the workspace packages. This keeps the Rspack
  module count at one and isolates filesystem traversal from bundle graph work.
- The literal `from: "./index.html"` pattern is unchanged across all cells.
- `@rspack/cli` is fixed at 2.0.4 in all current final and candidate version
  controls; only `@rspack/core` changes from 2.0.3 to 2.0.4.

## Incomplete paths deliberately not pursued

The workspace-root candidate was closer to a broad monorepo scan but made
hoisted slower than isolated and did not complete within the practical limit.
Adding generated files, a benchmark harness, synthetic loaders, or source
imports could have made the number larger, but would weaken the direct
CopyRspackPlugin claim. They were intentionally excluded.
