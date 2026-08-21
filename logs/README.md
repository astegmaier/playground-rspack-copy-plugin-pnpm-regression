# Investigation log index

This directory preserves both the prior resolver-cache fixture and the evidence
for the current direct CopyRspackPlugin wall-time repro.

| File | Purpose |
| --- | --- |
| [`measurement-record.md`](measurement-record.md) | Exact environment, clean-materialization method, matrix calculations, and output parity. |
| [`raw/`](raw/README.md) | Verbatim `/usr/bin/time -lp` transcripts for every final trial and discarded iteration. |
| [`source-fix/`](source-fix/README.md) | Exact literal-file bypass patch, causal verifier results, Office proof, #236 disproof, and Defender caveat. |
| [`plugin-removal-control.diff`](plugin-removal-control.diff) | Exact configuration-only removal of CopyRspackPlugin used by the causal control. |
| [`bohemia-copy-plugin-ablation.md`](bohemia-copy-plugin-ablation.md) | The supplied Office-Bohemia ablation and trace evidence, clearly marked as external to this checkout. |
| [`rspack-source-investigation.md`](rspack-source-investigation.md) | Public-source investigation of commit `7cf13166ba` and PR #14023. |
| [`iteration-notes.md`](iteration-notes.md) | Candidate designs, rejected shapes, stale-layout correction, and why the final graph is shaped this way. |
| [`prior-resolver-fixture.md`](prior-resolver-fixture.md) | Archived former README for the resolver-cache fixture. It is not the current repro. |
| [`prior-resolver-results.md`](prior-resolver-results.md) | Human-readable summary of the former fixture's useful data and scope. |
| [`prior-resolver-final-matrix.json`](prior-resolver-final-matrix.json) | Exact former final-matrix artifact retained without alteration. |

The root [`README.md`](../README.md) is intentionally the short path to a
provable direct reproduction. Analysis and historical detail live here so the
headline fixture remains legible.
