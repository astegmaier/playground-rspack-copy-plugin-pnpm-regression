# Archived former resolver-cache fixture

> **Historical document.** This is the former root README moved into `logs/`
> after the direct CopyRspackPlugin wall-time fixture replaced it. It describes
> a separate resolver warm-cache hypothesis and custom benchmark harness, not
> the current headline reproduction. The source scripts and tests it names are
> intentionally absent from the repository root; their original committed form
> remains available in Git history at `362556d`.
>
> **Causal correction.** The original resolver #236 discussion below is
> historical bookkeeping analysis, not the wall-time root cause. An A/B patch
> removing #236 leaves the slow path present and increases Boot time from
> 653.228 to 753.984 seconds with identical missing dependencies. The proven
> cause is the CopyRspackPlugin literal-file recursive walk; see
> [`source-fix/`](source-fix/README.md).

## Original document

# Rspack pnpm warm-resolver regression fixture

This is a minimal, public-package-only Rspack fixture for the pnpm
warm-resolver regression. It keeps the build graph near the Boot compiler's
shape while proving the exact resolver behavior through Rspack's public
`ResolverFactory` API.

The canonical state is pnpm `11.22.0`, `nodeLinker: isolated`, and
`@rspack/core@2.1.9`. `pnpm-lock.yaml` matches that state.

## Graph

The root package has no workspace packages or workspace diamond. A temporary
peer-diamond was removed because it changed the isolated module graph and made
the linker comparison invalid.

`src/public-graph.cjs` uses only published package distributions:

| Graph source | Purpose |
| --- | --- |
| `@fluentui/react-icons@2.0.332` ESM and CommonJS SVG atoms | Large public fan-out without generated imports. |
| `@fluentui/react@8.125.7` ESM components | Bare Fluent and React requests from component modules. |
| `@fluentui/react-components@9.74.4` ESM and CommonJS roots | Largest bare-package request fan-out. |
| `date-fns@4.1.0` | Public recursive utility graph; its published `_lib/test.js` helper is excluded because it imports test-only code. |

The aliases in `rspack.config.mjs` derive package distribution directories with
`require.resolve()`, so they follow the active linker instead of embedding a
pnpm virtual-store path. No source, package, or import list is generated.

Every final resource trial had the same graph:

| Metric | Value |
| --- | ---: |
| Modules | 12,365 |
| Factorization requests | 31,157 |
| Bare package requests | 5,675 |

`lucide-react` and `@sinclair/typebox` were evaluated and removed because they
added mostly relative-request modules without strengthening the affected
`node_modules` traversal.

## Running

```sh
pnpm install --frozen-lockfile
pnpm layout
pnpm test
pnpm benchmark
```

Every benchmark result contains `declaredNodeLinker` and
`usesPnpmVirtualStore`. It fails before compiling if the declared linker and
observed layout disagree.

| Command | Operation |
| --- | --- |
| `pnpm benchmark:cold` | One fresh `compiler.run()` compilation. |
| `pnpm benchmark:mechanism` | One real cold compilation, graph-scale warm resolver replay, and a one-request cold/warm probe. |
| `pnpm benchmark:watch` | One `compiler.watch()` cold build plus four `watching.invalidate()` warm builds. |

`pnpm layout` verifies the package path:

- `isolated` must report a symlink whose real path contains
  `node_modules/.pnpm/.../node_modules/@fluentui/react-icons`.
- `hoisted` must report a non-symlinked package directly under `node_modules`.

Generated output is confined to `.rspack-benchmark-output` and removed before
each benchmark process exits.

## Reproducing the other cells

Keep `src/`, `scripts/`, and `rspack.config.mjs` unchanged. To select a cell:

1. Edit `pnpm-workspace.yaml` to set `nodeLinker: isolated` or
   `nodeLinker: hoisted`.
2. Select an exact Rspack version:

   ```sh
   pnpm add --save-dev --save-exact @rspack/core@2.0.4
   pnpm add --save-dev --save-exact @rspack/core@2.0.5
   pnpm add --save-dev --save-exact @rspack/core@2.0.6
   pnpm add --save-dev --save-exact @rspack/core@2.1.9
   ```

3. Materialize and measure the selected cell:

   ```sh
   rm -rf node_modules
   pnpm install --frozen-lockfile
   pnpm layout
   pnpm benchmark
   ```

Every benchmark fails before compiling when `nodeLinker` and the observed
virtual-store layout disagree. Restore the canonical state with
`nodeLinker: isolated`, `@rspack/core@2.1.9`, then a clean frozen install.

## Root-relative byte metrics

All headline path-byte values are calculated from
`path.relative(<fixture-root>, dependencyPath)`, so moving the clone does not
change a ratio. Raw absolute-path bytes remain in
[`results/final-matrix.json`](results/final-matrix.json) only for diagnostics.

The exposed `compilation.missingDependencies` value is a globally deduplicated
set. It is deliberately reported as a **layout-only** metric, not as evidence
of #236 replay:

| Layout | Deduplicated paths | Root-relative bytes |
| --- | ---: | ---: |
| hoisted | 3,473 | 236,612 |
| isolated | 4,737 | 889,578 |

Those values are identical across 2.0.4 and 2.1.9 for a given layout. They
quantify the longer isolated path shape, but cannot show repeated warm records.

## Exact warm-cache mechanism

`benchmark:mechanism` collects the actual bare `(context, request)` occurrences
from `NormalModuleFactory` during a real cold compile. It then replays every
occurrence through the compilation shared normal-resolver cache and sums
missing records and root-relative bytes **per occurrence**. Resolver option
sets vary by dependency category, so this measures warm-record volume for the
same real request set rather than exactly re-running compilation resolution.
It models the per-dependency `FactorizeInfo` retention surface before a global
set can deduplicate it.

The simple one-request probe resolves `react` twice from the installed Fluent
icon distribution:

| Linker / Rspack | Cold missing records / root-relative bytes | Warm missing records / root-relative bytes | Warm missing `node_modules` records |
| --- | --- | --- | ---: |
| hoisted / 2.0.4 | 5 / 217 | 1 / 55 | 0 |
| isolated / 2.0.4 | 5 / 527 | 1 / 117 | 0 |
| hoisted / 2.1.9 | 5 / 217 | 5 / 217 | 4 |
| isolated / 2.1.9 | 5 / 527 | 5 / 527 | 4 |

The graph-scale replay is the primary measurement:

| Linker / Rspack | Occurrences | Unique pairs | First-pass missing records / root-relative bytes | Second-pass result |
| --- | ---: | ---: | --- | --- |
| hoisted / 2.0.4 | 5,675 | 3,811 | 21,104 / 1,377,952 | 20,007 / 1,299,821; not identical |
| isolated / 2.0.4 | 5,675 | 3,811 | 21,406 / 4,297,854 | 20,153 / 4,051,212; not identical |
| hoisted / 2.1.9 | 5,675 | 3,811 | 52,723 / 2,966,386 | byte-identical |
| isolated / 2.1.9 | 5,675 | 3,811 | 52,867 / 10,176,479 | byte-identical |

Thus the same 5,675 real bare occurrences retain about 2.5x as many warm
records after #236, while isolated's root-relative replay bytes are 3.43x
hoisted's on 2.1.9.

The 2.0.4 first pass still emits about 1.1k-1.3k missing `node_modules`
records from normal resolution paths outside `cached_node_modules`; its second
pass sheds those records as more paths become cached. The approximately 30x
jump to 32.7k records on 2.1.9 is the #236 replay, and its second pass remains
byte-identical.

The boundary is self-contained on the canonical isolated layout:

| Rspack | One-request warm missing records / root-relative bytes | Warm missing `node_modules` records | First / second graph-scale warm missing records / root-relative bytes |
| --- | --- | ---: | --- |
| 2.0.4 | 1 / 117 | 0 | 21,406 / 4,297,854; 20,153 / 4,051,212 |
| 2.0.5 | 1 / 117 | 0 | 21,406 / 4,297,854; 20,153 / 4,051,212 |
| 2.0.6 | 5 / 527 | 4 | 52,867 / 10,176,479; byte-identical |
| 2.1.9 | 5 / 527 | 4 | 52,867 / 10,176,479; byte-identical |

## Resource trials

Two clean trials were run for every resource cell. `watchPeakRss` is the
maximum process RSS over all five builds, not a per-build allocation. The
first/final build values and their process-peak difference are retained in the
result artifact with explicit names.

| Linker / Rspack | Cold elapsed / peak RSS, T1 | Cold elapsed / peak RSS, T2 | Five-build elapsed / watch peak RSS, T1 | Five-build elapsed / watch peak RSS, T2 |
| --- | --- | --- | --- | --- |
| hoisted / 2.0.4 | 2,613 ms / 1,189.2 MiB | 2,657 ms / 1,184.9 MiB | 13,377 ms / 1,795.2 MiB | 13,399 ms / 1,817.4 MiB |
| isolated / 2.0.4 | 2,867 ms / 1,221.7 MiB | 2,754 ms / 1,224.0 MiB | 14,364 ms / 1,889.6 MiB | 14,693 ms / 1,881.6 MiB |
| hoisted / 2.1.9 | 776 ms / 1,131.7 MiB | 787 ms / 1,141.0 MiB | 4,187 ms / 1,979.9 MiB | 4,043 ms / 1,980.7 MiB |
| isolated / 2.1.9 | 790 ms / 1,175.5 MiB | 754 ms / 1,173.3 MiB | 4,025 ms / 1,990.5 MiB | 4,484 ms / 2,044.0 MiB |

Using the correctly labeled `watchFinalMinusFirstPeakRss` field, 2.0.4 grows
about **619-629 MiB** hoisted and **638-639 MiB** isolated. Rspack 2.1.9 grows
about **849-854 MiB** hoisted and **810-861 MiB** isolated. Cold RSS moves in
the opposite direction across versions. Absolute n=2 watch peaks do not cleanly
separate layouts, so deterministic graph-scale replay is the regression signal.

## Root cause and scope

| `@rspack/core` | Resolver state |
| --- | --- |
| `2.0.4` | Last known good; uses `rspack_resolver` `0.8.0`. |
| `2.0.6+` | Includes [`11e45f5`](https://github.com/rstackjs/rspack-resolver/commit/11e45f5e8dfcbcd994d80723a48226a6f2c24ae3), [PR #236](https://github.com/rstackjs/rspack-resolver/pull/236). |
| `2.1.9` | Retains the affected warm-cache behavior. |

[`11e45f5`](https://github.com/rstackjs/rspack-resolver/blob/11e45f5e8dfcbcd994d80723a48226a6f2c24ae3/src/cache.rs#L278-L290)
replays a missing `<ancestor>/node_modules` dependency when a cached
`node_modules` lookup is absent. [`b138142`](https://github.com/rstackjs/rspack-resolver/commit/b138142a23ae223bba97901381b040ebc11532fa),
[PR #232](https://github.com/rstackjs/rspack-resolver/pull/232), changed
resolver context values to `ResolverPath`; the replay branch passes a fresh
`self.path.join("node_modules")`.

The relevant retained surface is per-dependency
[`FactorizeInfo`](https://github.com/web-infra-dev/rspack/blob/v2.1.9/crates/rspack_core/src/dependency/factorize_info.rs)
missing-dependency sets.

This fixture deliberately excludes the separate tsconfig project-references
issue in [rspack-resolver #200](https://github.com/rstackjs/rspack-resolver/issues/200)
and [#213](https://github.com/rstackjs/rspack-resolver/issues/213): there is no
`tsconfig.json`, project references, TypeScript source, or `resolve.tsConfig`.

## Limitations

Rspack 2.1.9 includes unrelated performance improvements and is faster overall
than 2.0.4 here, so cross-version elapsed time is not a generic CPU benchmark.
Process RSS is also allocator-sensitive. The version boundary and the
layout-sensitive replay volume are established by the deterministic raw
resolver measurement, while the resource trials provide the visible
build-level signal.
