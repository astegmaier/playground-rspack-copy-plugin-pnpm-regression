# Rspack CopyRspackPlugin regression with pnpm isolated layout

Tracked upstream in [web-infra-dev/rspack#15289](https://github.com/web-infra-dev/rspack/issues/15289).

## Summary

`CopyRspackPlugin` has a severe performance regression in complex pnpm monorepos that use the isolated, symlink-based `node_modules` layout. It is present in `@rspack/core@2.1.10`, the current `latest` release, and appears to have been introduced in `@rspack/core@2.0.4`.

This reproduction is a simplified version of a real-world Microsoft monorepo that exhibits the same regression (although at a larger scale). The time to complete a single-file build increases from 7 milliseconds to 41.52 seconds. The regression is not present when pnpm installs dependencies with the `hoisted` layout (i.e. no [symlinked node_modules](https://pnpm.io/symlinked-node-modules-structure)).

## Repro Steps (Regression)

The checked-in state uses the affected combination:

- `@rspack/core@2.1.10`
- `@rspack/cli@2.1.10`
- pnpm `nodeLinker: isolated`

From a fresh checkout:

```sh
pnpm install
pnpm --filter test-app build
```

Result:

```sh
Rspack compiled in 41.52 s (56b81aa0f47ae0b5)
```

You can also gather memory statistics with these commands:

- macOS: `/usr/bin/time -lp pnpm --filter test-app build`
- Linux: `/usr/bin/time -v pnpm --filter test-app build`

Memory remains approximately 210–214 MiB across the tested cells. The affected runs spend most of their wall time in system calls, consistent with filesystem traversal rather than module compilation.

## Repro Steps (Baseline)

### @rspack/core 2.0.3 with isolated pnpm

Keep `nodeLinker: isolated` and keep `@rspack/cli` at 2.1.10, then change only `@rspack/core`:

```sh
pnpm --filter test-app add @rspack/core@2.0.3
pnpm install # Important: without this, the install tree might be incomplete and the regression is not triggered.
pnpm --filter test-app build
```

Result:

```
Rspack compiled in 7 ms (9e2b16be98e9b848)
```

### @rspack/core 2.1.10 with hoisted pnpm

Keep both Rspack packages at 2.1.10 and change only `pnpm-workspace.yaml`:

```yaml
nodeLinker: hoisted
```

Then materialize the hoisted layout and run the same build:

```sh
git clean -fdX # IMPORTANT: remove the isolated node_modules layout artifacts
pnpm install
pnpm --filter test-app build
```

Result:

```
Rspack compiled in 15 ms (56b81aa0f47ae0b5)
```

## Results Summary

Measurements were collected on macOS arm64 with Node 24.16.0 and pnpm 11.22.0. Each cell contains three fresh Rspack processes measured in one window after a complete install. All cells compile one module and emit the copied asset; output hashes are identical within a given `@rspack/core` version.

| Core | CLI | pnpm layout | Wall time | Max RSS median |
| --- | --- | --- | ---: | ---: |
| 2.0.3 | 2.1.10 | isolated | 7 ms | 211.3 MiB |
| 2.0.3 | 2.0.4 | hoisted | 6 ms | 214.0 MiB |
| 2.0.3 | 2.0.4 | isolated | 11 ms | 211.3 MiB |
| 2.0.4 | 2.0.4 | hoisted | 15 ms | 209.6 MiB |
| 2.0.4 | 2.0.4 | isolated | **41.99 s** | 212.1 MiB |
| 2.1.10 | 2.1.10 | hoisted | 15 ms | 211.1 MiB |
| 2.1.10 | 2.1.10 | isolated | **41.52 s** | 211.3 MiB |
| 2.2.0-rc.0 | 2.2.0-rc.0 | hoisted | 15 ms | 211.47 MiB |
| 2.2.0-rc.0 | 2.2.0-rc.0 | isolated | **38.55 s** | 211.48 MiB |

The 2.0.4 rows show where the regression began. The 2.1.10 rows show its current state: isolated 2.1.10 is within 1.1% of isolated 2.0.4.

The 2.2.0-rc.0 prerelease also remains affected: its isolated build is approximately **2,570x slower** than its hoisted build.

With `@rspack/cli` held at 2.1.10 and the isolated layout, core 2.1.10 is approximately **5,931x slower** than core 2.0.3. With core and CLI fixed at 2.1.10, the isolated layout is approximately **2,768x slower** than the hoisted layout.

The fixture models a complex monorepo with a small workspace dependency DAG. The entry contains one JavaScript module; the workspace packages exist only to create repeated symlink paths to a large public dependency. This isolates the filesystem traversal from module compilation.

## Root cause analysis

The regression begins with Rspack commit [`7cf13166ba`](https://github.com/web-infra-dev/rspack/commit/7cf13166ba23eae192aac0fb25877415b3c8e8d4), merged in [PR #14023](https://github.com/web-infra-dev/rspack/pull/14023), first released in `@rspack/core@2.0.4`, and still present in 2.1.10 and 2.2.0-rc.0. The change routes `CopyRspackPlugin` file matching through a custom recursive `find_files_by_glob` implementation.

For a literal pattern such as `from: "./index.html"`, Rspack first confirms that the source is a file, but then recursively walks the file's entire parent directory to find that one known path. The walker follows pnpm's workspace and package symlinks and does not deduplicate previously visited targets. A complex isolated-layout monorepo therefore exposes the same large dependency trees through many lexical paths.

A one-file Rspack patch tested against 2.0.4 returns the already-identified literal file directly, while leaving real glob and directory patterns unchanged, and reduces this public fixture from 39.23 seconds to 0.68 seconds with identical output. The same patch reduced the equivalent build in a large Microsoft monorepo from 673.44 seconds to a 0.18-second median while keeping `CopyRspackPlugin` enabled and preserving the copied asset. Independently removing only `CopyRspackPlugin` on 2.1.10 reduces the current-release fixture from 46.716 seconds to 3 milliseconds, confirming that the same plugin path remains responsible.
