import path from "node:path";

export function compareReplayPasses(firstPass, secondPass) {
  const keys = [
    "missingAbsolutePathBytes",
    "missingNodeModulesRecordCount",
    "missingRecordCount",
    "missingRootRelativePathBytes",
    "occurrenceCount",
    "uniquePairCount",
  ];

  return {
    byteIdentical:
      firstPass.missingRootRelativePathBytes === secondPass.missingRootRelativePathBytes,
    metricsIdentical: keys.every((key) => firstPass[key] === secondPass[key]),
  };
}

export function countModules(compilation) {
  return compilation.modules.size;
}

export function formatPeakRss(kibibytes) {
  return `${(kibibytes / 1024).toFixed(1)} MiB`;
}

export function parseBenchmarkOptions(argumentsList) {
  let mode = "cold";
  let watchBuildCount = 5;

  for (const argument of argumentsList) {
    if (argument.startsWith("--mode=")) {
      mode = argument.slice("--mode=".length);
    } else if (argument.startsWith("--watch-builds=")) {
      watchBuildCount = Number(argument.slice("--watch-builds=".length));
    } else {
      throw new Error(`Unknown benchmark option: ${argument}`);
    }
  }

  if (mode !== "cold" && mode !== "mechanism" && mode !== "watch") {
    throw new Error("--mode must be cold, mechanism, or watch.");
  }

  if (!Number.isInteger(watchBuildCount) || watchBuildCount < 2) {
    throw new Error("--watch-builds must be an integer of at least 2.");
  }

  return { mode, watchBuildCount };
}

export function summarizeMissingDependencies(dependencies, rootDirectory) {
  const rootPath = path.resolve(rootDirectory);

  return dependencies.reduce(
    (summary, dependency) => {
      const rootRelativePath = path.relative(rootPath, dependency) || ".";

      return {
        count: summary.count + 1,
        absolutePathBytes: summary.absolutePathBytes + Buffer.byteLength(dependency),
        rootRelativePathBytes:
          summary.rootRelativePathBytes + Buffer.byteLength(rootRelativePath),
      };
    },
    {
      count: 0,
      absolutePathBytes: 0,
      rootRelativePathBytes: 0,
    },
  );
}
