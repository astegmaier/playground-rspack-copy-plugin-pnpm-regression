# Archived resolver-cache fixture results

## Status

This is historical evidence from the former root fixture, not evidence for the
current CopyRspackPlugin wall-time reproduction. The exact original README is
[`prior-resolver-fixture.md`](prior-resolver-fixture.md), and the unmodified
data artifact is [`prior-resolver-final-matrix.json`](prior-resolver-final-matrix.json).

**Causal correction:** resolver #236 and its missing-dependency replay are
definitively not the wall-time cause. The verifier's A/B patch removing #236
kept 19,744 missing dependencies and changed the slow 2.1.9 Boot run from
653.228 to 753.984 seconds. The CopyRspackPlugin literal-file bypass is the
source-patch-proven cause; see [`source-fix/`](source-fix/README.md).

The former fixture used `@rspack/core@2.1.9`, public Fluent and date-fns import
fanout, a custom compiler API benchmark harness, resolver probes, and watch
measurements. Those source files and tests were deleted from the repository
root because they obscured the direct CopyRspackPlugin evidence.

## Useful preserved findings

| Historical metric | Value |
| --- | --- |
| Bundled modules | 12,365 |
| Factorization requests | 31,157 |
| Bare package requests | 5,675 |
| Historical canonical layout | pnpm isolated |
| Historical canonical Rspack version | 2.1.9 |

The former two-trial cold-build values were:

| Linker / Rspack | Cold T1 | Cold T2 |
| --- | --- | --- |
| hoisted / 2.0.4 | 2,613 ms / 1,189.2 MiB | 2,657 ms / 1,184.9 MiB |
| isolated / 2.0.4 | 2,867 ms / 1,221.7 MiB | 2,754 ms / 1,224.0 MiB |
| hoisted / 2.1.9 | 776 ms / 1,131.7 MiB | 787 ms / 1,141.0 MiB |
| isolated / 2.1.9 | 790 ms / 1,175.5 MiB | 754 ms / 1,173.3 MiB |

Its graph-scale resolver replay measurement reported 5,675 real bare-request
occurrences. On 2.1.9, the isolated layout had 52,867 retained missing records
and 10,176,479 root-relative path bytes, versus 52,723 and 2,966,386 for
hoisted. That remains useful evidence of resolver-cache bookkeeping behavior,
but it is not causal evidence for the CopyRspackPlugin wall-time regression.

## Why it is a different mechanism

The old fixture focused on a resolver implementation and per-dependency
`FactorizeInfo` missing-dependency retention. The current fixture imports no
large public module graph, has one compiled source module, and produces its
slow path in CopyRspackPlugin processing with a literal file source.

The former data remains useful historical context, but it must not be used to
attribute this wall-time regression to resolver #236. The causal proof is in
[`source-fix/`](source-fix/README.md).
