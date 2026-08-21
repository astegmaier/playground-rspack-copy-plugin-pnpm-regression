# Rspack CopyRspackPlugin regression with pnpm isolated layout

## Summary

Rspack 2.0.4 introduces a severe `CopyRspackPlugin` performance regression in complex pnpm monorepos that use the isolated, symlink-based `node_modules` layout. In this public reproduction, changing only `@rspack/core` from 2.0.3 to 2.0.4 increases Rspack's median build time from 6 milliseconds to 41.47 seconds; changing only pnpm from `isolated` to `hoisted` reduces the 2.0.4 median to 16 milliseconds. The regression does not reproduce with the latest release, 2.1.10.

## Repro Steps (Regression)

The checked-in state uses the affected combination:

- `@rspack/core@2.0.4`
- `@rspack/cli@2.0.4`
- pnpm `nodeLinker: isolated`

From a fresh checkout:

```sh
pnpm install
pnpm --filter test-app build
```

Result:

```sh
Rspack compiled in 35.84 s (9e2b16be98e9b848)
```

You can also gather memory statistics with these commands:

- macOS: `/usr/bin/time -lp pnpm --filter test-app build`
- Linux: `/usr/bin/time -v pnpm --filter test-app build`

## Repro Steps (Baseline)

### @rspack/core 2.0.3 with isolated pnpm

Keep `nodeLinker: isolated` in `pnpm-workspace.yaml`, then change only `@rspack/core`:

```sh
pnpm --filter test-app add @rspack/core@2.0.3
pnpm --filter test-app build
```

Result:

```
Rspack compiled in 15 ms (9e2b16be98e9b848)
```

### @rspack/core 2.0.4 with hoisted pnpm

Keep both Rspack packages at 2.0.4 and change only `pnpm-workspace.yaml`:

```yaml
nodeLinker: hoisted
```

Then materialize the hoisted layout and run the same build:

```sh
pnpm clean # IMPORTANT: remove the isolated node_modules layout artifacts
pnpm install
pnpm --filter test-app build
```

Result:

```
Rspack compiled in 17 ms (9e2b16be98e9b848)
```

## Results Summary

Measurements were collected on macOS arm64 with Node 24.16.0 and pnpm 11.22.0. Each cell contains three fresh Rspack processes. All cells compile one module and emit identical output hashes.

| Core | CLI | pnpm layout | Wall time | Max RSS median |
| --- | --- | --- | ---: | ---: |
| 2.0.3 | 2.0.4 | hoisted | 8 ms | 209.33 MiB |
| 2.0.3 | 2.0.4 | isolated | 6 ms | 211.58 MiB |
| 2.0.4 | 2.0.4 | hoisted | 16 ms | 210.00 MiB |
| 2.0.4 | 2.0.4 | isolated | **41.47 s** | 214.30 MiB |
| 2.1.10 | 2.1.10 | hoisted | 8 ms | 211.63 MiB |
| 2.1.10 | 2.1.10 | isolated | 10 ms | 211.75 MiB |

With the isolated layout and CLI fixed, core 2.0.4 is approximately **6,912x slower** than 2.0.3. With core and CLI fixed at 2.0.4, the isolated layout is approximately **2,592x slower** than the hoisted layout.

The latest 2.1.10 release completes in milliseconds under both layouts, confirming that this regression has been fixed in a later release.

The fixture models a complex monorepo with a small workspace dependency DAG. The entry contains one JavaScript module; the workspace packages exist only to create repeated symlink paths to a large public dependency. This isolates the filesystem traversal from module compilation.

## Root cause analysis

The regression begins with Rspack commit [`7cf13166ba`](https://github.com/web-infra-dev/rspack/commit/7cf13166ba23eae192aac0fb25877415b3c8e8d4), merged in [PR #14023](https://github.com/web-infra-dev/rspack/pull/14023) and first released in `@rspack/core@2.0.4`. The change routes `CopyRspackPlugin` file matching through a custom recursive `find_files_by_glob` implementation.

For a literal pattern such as `from: "./index.html"`, Rspack first confirms that the source is a file, but then recursively walks the file's entire parent directory to find that one known path. The walker follows pnpm's workspace and package symlinks and does not deduplicate previously visited targets. A complex isolated-layout monorepo therefore exposes the same large dependency trees through many lexical paths.

A one-file Rspack patch that returns the already-identified literal file directly, while leaving real glob and directory patterns unchanged, reduces this public fixture from 39.23 seconds to 0.68 seconds with identical output. The same patch reduced the equivalent build in a large Microsoft monorepo from 673.44 seconds to a 0.18-second median while keeping `CopyRspackPlugin` enabled and preserving the copied asset.
