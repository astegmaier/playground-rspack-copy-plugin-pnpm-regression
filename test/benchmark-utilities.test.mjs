import test from "node:test";
import assert from "node:assert/strict";

import {
  compareReplayPasses,
  countModules,
  formatPeakRss,
  parseBenchmarkOptions,
  summarizeMissingDependencies,
} from "../scripts/benchmark-utilities.mjs";
import { parseNodeLinker } from "../scripts/layout-utilities.mjs";

test("counts every module in an Rspack compilation", () => {
  assert.equal(countModules({ modules: new Set([{}, {}, {}]) }), 3);
});

test("formats peak RSS from kibibytes as mebibytes", () => {
  assert.equal(formatPeakRss(102400), "100.0 MiB");
});

test("uses five watch builds when the benchmark has no options", () => {
  assert.deepEqual(parseBenchmarkOptions([]), { mode: "cold", watchBuildCount: 5 });
});

test("uses watch mode with the requested build count", () => {
  assert.deepEqual(parseBenchmarkOptions(["--mode=watch", "--watch-builds=4"]), {
    mode: "watch",
    watchBuildCount: 4,
  });
});

test("uses resolver mechanism mode", () => {
  assert.deepEqual(parseBenchmarkOptions(["--mode=mechanism"]), {
    mode: "mechanism",
    watchBuildCount: 5,
  });
});

test("separates absolute and root-relative missing dependency path bytes", () => {
  assert.deepEqual(summarizeMissingDependencies(["/fixture/a", "/fixture/bc"], "/fixture"), {
    count: 2,
    absolutePathBytes: 21,
    rootRelativePathBytes: 3,
  });
});

test("marks equivalent scaled replay passes as byte-identical", () => {
  assert.deepEqual(
    compareReplayPasses(
      {
        missingAbsolutePathBytes: 21,
        missingNodeModulesRecordCount: 3,
        missingRecordCount: 5,
        missingRootRelativePathBytes: 13,
        occurrenceCount: 4,
        uniquePairCount: 2,
      },
      {
        missingAbsolutePathBytes: 21,
        missingNodeModulesRecordCount: 3,
        missingRecordCount: 5,
        missingRootRelativePathBytes: 13,
        occurrenceCount: 4,
        uniquePairCount: 2,
      },
    ),
    {
      byteIdentical: true,
      metricsIdentical: true,
    },
  );
});

test("reads isolated nodeLinker settings", () => {
  assert.equal(parseNodeLinker("nodeLinker: isolated\n"), "isolated");
});

test("reads hoisted nodeLinker settings", () => {
  assert.equal(parseNodeLinker("nodeLinker: hoisted\n"), "hoisted");
});
