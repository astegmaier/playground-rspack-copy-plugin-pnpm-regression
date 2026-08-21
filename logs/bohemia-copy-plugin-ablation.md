# Office-Bohemia CopyRspackPlugin ablation evidence

## Evidence status

**Observed externally and supplied to this fixture.** The measurements below
were not rerun from this small public reproduction. They are retained because
they motivated replacing the prior resolver-cache fixture with a direct
wall-time repro.

## Reported identical-config ablation

| Operation | With stock Rspack 2.1.9 + pnpm isolated | Removing only CopyRspackPlugin |
| --- | --- | --- |
| Artifact Viewer Host | Stalled for more than 10 minutes | 0.334 s internal; 0.40 s `/usr/bin/time` |
| Boot | Not the stated stalled operation | 4.127 s internal; 4.45 s `/usr/bin/time` |

The shared configuration adds this literal pattern:

```js
new CopyRspackPlugin({
  patterns: [{ from: "./index.html", to: "./" }],
})
```

The comparison keeps the rest of the configuration identical. That makes
CopyRspackPlugin a high-confidence causal ablation in the Office-Bohemia
environment.

## Layout and trace observations

- Yarn has no package-local `artifact-viewer/node_modules` directory.
- pnpm isolated has 44 relevant links in that package-local graph.
- The stall occurs after the reported 172-resolution phase.
- Supplied filesystem samples show `stat`, `opendir`, and `readdir` activity
  during that post-resolution stall.

## Relationship to this fixture

The fixture does not claim the same package count, exact dependency graph, or
more-than-ten-minute duration. It creates a small transparent workspace DAG
that turns the same literal-copy and isolated-layout conditions into a
53.10-second median run. The direct plugin-removal control and the core 2.0.3
versus 2.0.4 boundary, with CLI 2.0.4 fixed, are both measured locally here.

## Causal update

The source patch is now proven. Patch D changes only the CopyRspackPlugin
literal-file branch to return the `metadata()`-confirmed file directly rather
than recursively walking its parent through `find_files_by_glob`. It collapses
the stock v2.0.4 Office Host result from 673.44 seconds to a 0.18-second
patched median while the plugin remains enabled and `index.html` remains
emitted. The exact patch, raw records, resolver #236 disproof, and caveat are
in [`source-fix/`](source-fix/README.md).

## What this evidence does and does not establish

**Established by the supplied ablation:** removing CopyRspackPlugin is
sufficient to collapse the Office-Bohemia slow path.

**Consistent with the fixture:** a literal copy pattern combined with a pnpm
isolated symlink graph can dominate wall time while the compiler module graph
and emitted output remain trivial.

**Still environment-dependent:** the exact count of filesystem calls and the
absolute timing of every Office-Bohemia package. Endpoint-protection scanning
can perturb absolute local-binding timings. The literal-file source path itself
is now established separately by the source-patch proof.
