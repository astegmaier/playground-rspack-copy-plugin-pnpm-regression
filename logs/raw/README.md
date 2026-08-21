# Raw timing transcripts

The root README's direct command remains:

```sh
/usr/bin/time -lp pnpm exec rspack build --config rspack.config.cjs
```

The surrounding setup in these records exists only to make a trial
self-identifying; it is not a checked-in benchmark runner or a requirement for
normal reproduction.

Every file under [`final/`](final/) and [`candidates/`](candidates/) records:

- `pnpm exec rspack --version`;
- the resolved `@rspack/core` version;
- `pnpm config get node-linker`;
- package count, workspace-local `node_modules` count, and symlink count;
- the leaf public-package symlink and realpath, or an explicit hoisted-layout
  absence;
- the resolved core realpath;
- the exact `/usr/bin/time -lp` command and output;
- compiler hash/module output and emitted-asset SHA-256 hashes.

The plugin-removal records additionally embed the exact diff from
[`../plugin-removal-control.diff`](../plugin-removal-control.diff).

| Directory | Contents |
| --- | --- |
| [`final/`](final/) | Final 14-package, fixed-CLI 2.0.4 2x2 matrix plus three plugin-removal controls. These are the only final timing claims. |
| [`candidates/`](candidates/) | Self-identifying 14-, 13-, and 12-package minimization trials. |
| [`archive-pre-review/`](archive-pre-review/) | Superseded raw records from before the reviewer-required CLI control and transcript format. Retained for history only. |

The final matrix values and minimization calculations are transcribed in
[`../measurement-record.md`](../measurement-record.md).
