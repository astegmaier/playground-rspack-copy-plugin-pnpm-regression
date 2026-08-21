# Rspack CopyRspackPlugin regression with pnpm isolated layout

## Summary

Rspack 2.0.4 introduces a severe `CopyRspackPlugin` performance regression in complex pnpm monorepos that use the isolated, symlink-based `node_modules` layout. In this public reproduction, changing only `@rspack/core` from 2.0.3 to 2.0.4 increases build time from 0.71 seconds to 53.10 seconds; changing only pnpm from `isolated` to `hoisted` reduces the 2.0.4 build to 0.69 seconds.

## Repro Steps (Regression)

The checked-in state uses the affected combination:

- `@rspack/core@2.0.4`
- `@rspack/cli@2.0.4`
- pnpm `nodeLinker: isolated`

From a fresh checkout:

```sh
pnpm install --frozen-lockfile
cd apps/repro-app
rm -rf dist
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

On macOS, `/usr/bin/time -lp` reports wall time and maximum resident set size. On Linux, use `/usr/bin/time -v`; portable `time` is sufficient when only wall time is needed.

## Repro Steps (Baseline)

Use a fresh checkout for each baseline so the lockfile and materialized `node_modules` layout cannot leak between cases.

### Rspack 2.0.3 with isolated pnpm

Keep `nodeLinker: isolated` in `pnpm-workspace.yaml`, then change only `@rspack/core`:

```sh
pnpm --filter @copy-repro/repro-app add --save-dev --save-exact @rspack/core@2.0.3
cd apps/repro-app
rm -rf dist
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

`@rspack/cli` remains fixed at 2.0.4.

### Rspack 2.0.4 with hoisted pnpm

Keep both Rspack packages at 2.0.4 and change only `pnpm-workspace.yaml`:

```yaml
nodeLinker: hoisted
```

Then materialize the hoisted layout and run the same build:

```sh
git clean -fdX
pnpm install --frozen-lockfile
cd apps/repro-app
rm -rf dist
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

`git clean -fdX` removes ignored install and build artifacts, so use it only in a disposable checkout.

## Results

Measurements were collected on macOS arm64 with Node 24.16.0 and pnpm 11.22.0. Each cell contains three fresh Rspack processes. All cells compile one module and emit identical output hashes.

| Core | CLI | pnpm layout | Wall time median [range] | Max RSS median [range] |
| --- | --- | --- | ---: | ---: |
| 2.0.3 | 2.0.4 | hoisted | 0.68 s [0.67, 0.72] | 209.33 MiB [209.22, 215.41] |
| 2.0.3 | 2.0.4 | isolated | 0.71 s [0.68, 0.96] | 211.58 MiB [209.16, 213.69] |
| 2.0.4 | 2.0.4 | hoisted | 0.69 s [0.68, 0.94] | 210.00 MiB [209.64, 211.39] |
| 2.0.4 | 2.0.4 | isolated | **53.10 s [52.06, 53.48]** | 214.30 MiB [211.75, 217.52] |

With the isolated layout and CLI fixed, core 2.0.4 is **74.8x slower** than 2.0.3. With core and CLI fixed at 2.0.4, the isolated layout is **77.0x slower** than the hoisted layout.

The fixture models a complex monorepo with a small workspace dependency DAG. The entry contains one JavaScript module; the workspace packages exist only to create repeated symlink paths to a large public dependency. This isolates the filesystem traversal from module compilation.

## Root cause analysis

The regression begins with Rspack commit [`7cf13166ba`](https://github.com/web-infra-dev/rspack/commit/7cf13166ba23eae192aac0fb25877415b3c8e8d4), merged in [PR #14023](https://github.com/web-infra-dev/rspack/pull/14023) and first released in `@rspack/core@2.0.4`. The change routes `CopyRspackPlugin` file matching through a custom recursive `find_files_by_glob` implementation.

For a literal pattern such as `from: "./index.html"`, Rspack first confirms that the source is a file, but then recursively walks the file's entire parent directory to find that one known path. The walker follows pnpm's workspace and package symlinks and does not deduplicate previously visited targets. A complex isolated-layout monorepo therefore exposes the same large dependency trees through many lexical paths.

A one-file Rspack patch that returns the already-identified literal file directly, while leaving real glob and directory patterns unchanged, reduces this public fixture from 39.23 seconds to 0.68 seconds with identical output. The same patch reduced the equivalent build in a large Microsoft monorepo from 673.44 seconds to a 0.18-second median while keeping `CopyRspackPlugin` enabled and preserving the copied asset.
