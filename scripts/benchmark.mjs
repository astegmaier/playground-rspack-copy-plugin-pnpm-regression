import { createRequire } from "node:module";
import path from "node:path";
import { lstat, readFile, realpath, rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { rspack } from "@rspack/core";

import config, { outputDirectory } from "../rspack.config.mjs";
import { parseNodeLinker } from "./layout-utilities.mjs";
import {
  compareReplayPasses,
  countModules,
  formatPeakRss,
  parseBenchmarkOptions,
  summarizeMissingDependencies,
} from "./benchmark-utilities.mjs";

const rootDirectory = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

async function getVerifiedLayout() {
  const workspaceSettings = await readFile(path.join(rootDirectory, "pnpm-workspace.yaml"), "utf8");
  const declaredNodeLinker = parseNodeLinker(workspaceSettings);
  const packageLink = path.join(rootDirectory, "node_modules", "@fluentui", "react-icons");
  const packageLinkMetadata = await lstat(packageLink);
  const packageRealPath = await realpath(packageLink);
  const normalizedPackageRealPath = packageRealPath.split(path.sep).join("/");
  const usesPnpmVirtualStore = normalizedPackageRealPath.includes("/node_modules/.pnpm/");
  const expectsPnpmVirtualStore = declaredNodeLinker === "isolated";

  if (usesPnpmVirtualStore !== expectsPnpmVirtualStore) {
    throw new Error(
      `Declared nodeLinker ${declaredNodeLinker} disagrees with the observed package layout.`,
    );
  }

  return {
    declaredNodeLinker,
    packageLinkIsSymlink: packageLinkMetadata.isSymbolicLink(),
    usesPnpmVirtualStore,
  };
}

function close(compiler) {
  return new Promise((resolve, reject) => {
    compiler.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function createResolverMetrics(compiler, collectBareOccurrences) {
  const bareOccurrences = [];
  const totals = {
    bare: 0,
    relative: 0,
    total: 0,
  };

  compiler.hooks.normalModuleFactory.tap("resolver-regression-metrics", (factory) => {
    factory.hooks.beforeResolve.tap("resolver-regression-metrics", (data) => {
      totals.total += 1;

      if (data.request.startsWith(".") || data.request.startsWith("/")) {
        totals.relative += 1;
      } else {
        totals.bare += 1;

        if (collectBareOccurrences) {
          bareOccurrences.push({
            context: data.context,
            request: data.request,
          });
        }
      }
    });
  });

  return {
    snapshot() {
      return { ...totals };
    },
    bareOccurrences() {
      return [...bareOccurrences];
    },
  };
}

function createBuildMeasurement(stats, elapsedMilliseconds, metrics, previousMetrics) {
  const missingDependencies = Array.from(stats.compilation.missingDependencies).map((dependency) =>
    String(dependency),
  );
  const currentMetrics = metrics.snapshot();
  const missingDependencySummary = summarizeMissingDependencies(missingDependencies, rootDirectory);

  return {
    elapsedMilliseconds,
    moduleCount: countModules(stats.compilation),
    peakRssKibibytes: process.resourceUsage().maxRSS,
    resolverRequests: currentMetrics.total - previousMetrics.total,
    bareResolverRequests: currentMetrics.bare - previousMetrics.bare,
    relativeResolverRequests: currentMetrics.relative - previousMetrics.relative,
    deduplicatedMissingDependencyCount: missingDependencySummary.count,
    deduplicatedMissingDependencyAbsolutePathBytes: missingDependencySummary.absolutePathBytes,
    deduplicatedMissingDependencyRootRelativePathBytes:
      missingDependencySummary.rootRelativePathBytes,
  };
}

function getCompilationError(stats) {
  if (!stats.hasErrors()) {
    return undefined;
  }

  return new Error(
    `Rspack compilation failed:\n${JSON.stringify(
      stats.toJson({
        all: false,
        errors: true,
      }).errors,
    )}`,
  );
}

function runColdBuild(compiler, metrics) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const previousMetrics = metrics.snapshot();

    compiler.run((error, stats) => {
      if (error) {
        reject(error);
        return;
      }

      if (!stats) {
        reject(new Error("Rspack completed without statistics."));
        return;
      }

      const compilationError = getCompilationError(stats);

      if (compilationError) {
        reject(compilationError);
        return;
      }

      resolve(
        createBuildMeasurement(
          stats,
          Math.round(performance.now() - startedAt),
          metrics,
          previousMetrics,
        ),
      );
    });
  });
}

function resolveWithMissingDependencies(resolver, contextPath, request) {
  return new Promise((resolve, reject) => {
    const missingDependencies = new Set();

    resolver.resolve({}, contextPath, request, { missingDependencies }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          result,
          missingDependencies: Array.from(missingDependencies).map((dependency) => String(dependency)),
        });
      }
    });
  });
}

function summarizeResolution(resolution) {
  const summary = summarizeMissingDependencies(resolution.missingDependencies, rootDirectory);

  return {
    missingRecordCount: summary.count,
    missingAbsolutePathBytes: summary.absolutePathBytes,
    missingRootRelativePathBytes: summary.rootRelativePathBytes,
    missingNodeModulesRecordCount: resolution.missingDependencies.filter((dependency) =>
      dependency.endsWith("/node_modules"),
    ).length,
  };
}

async function runOneRequestProbe() {
  const require = createRequire(import.meta.url);
  const contextPath = path.dirname(require.resolve("@fluentui/react-icons"));
  const probeCompiler = rspack(config);
  const resolver = probeCompiler.resolverFactory.get("normal");

  try {
    const cold = await resolveWithMissingDependencies(resolver, contextPath, "react");
    const warm = await resolveWithMissingDependencies(resolver, contextPath, "react");

    return {
      cold: summarizeResolution(cold),
      warm: summarizeResolution(warm),
    };
  } finally {
    await close(probeCompiler);
  }
}

async function replayBareOccurrences(resolver, occurrences) {
  const seenPairs = new Set();
  const totals = {
    missingAbsolutePathBytes: 0,
    missingNodeModulesRecordCount: 0,
    missingRecordCount: 0,
    missingRootRelativePathBytes: 0,
  };
  const startedAt = performance.now();

  for (const occurrence of occurrences) {
    const resolution = await resolveWithMissingDependencies(
      resolver,
      occurrence.context,
      occurrence.request,
    );
    const summary = summarizeResolution(resolution);

    seenPairs.add(`${occurrence.context}\u0000${occurrence.request}`);
    totals.missingRecordCount += summary.missingRecordCount;
    totals.missingAbsolutePathBytes += summary.missingAbsolutePathBytes;
    totals.missingRootRelativePathBytes += summary.missingRootRelativePathBytes;
    totals.missingNodeModulesRecordCount += summary.missingNodeModulesRecordCount;
  }

  return {
    elapsedMilliseconds: Math.round(performance.now() - startedAt),
    occurrenceCount: occurrences.length,
    uniquePairCount: seenPairs.size,
    ...totals,
  };
}

async function runResolverMechanism(compiler, metrics) {
  const coldCompilation = await runColdBuild(compiler, metrics);
  const resolver = compiler.resolverFactory.get("normal");
  const firstScaledWarmReplay = await replayBareOccurrences(resolver, metrics.bareOccurrences());
  const secondScaledWarmReplay = await replayBareOccurrences(resolver, metrics.bareOccurrences());

  return {
    coldCompilation,
    oneRequestProbe: await runOneRequestProbe(),
    scaledWarmReplayPasses: [firstScaledWarmReplay, secondScaledWarmReplay],
    scaledWarmReplayStability: compareReplayPasses(
      firstScaledWarmReplay,
      secondScaledWarmReplay,
    ),
  };
}

function watchBuilds(compiler, buildCount, metrics) {
  return new Promise((resolve, reject) => {
    const builds = [];
    let buildStartedAt = performance.now();
    let previousMetrics = metrics.snapshot();
    let watching;
    let finished = false;

    const finish = (error) => {
      if (finished) {
        return;
      }

      finished = true;
      watching.close((closeError) => {
        if (error) {
          reject(error);
        } else if (closeError) {
          reject(closeError);
        } else {
          resolve(builds);
        }
      });
    };

    watching = compiler.watch({}, (error, stats) => {
      if (error) {
        finish(error);
        return;
      }

      if (!stats) {
        finish(new Error("Rspack completed without statistics."));
        return;
      }

      const compilationError = getCompilationError(stats);

      if (compilationError) {
        finish(compilationError);
        return;
      }

      builds.push(
        createBuildMeasurement(
          stats,
          Math.round(performance.now() - buildStartedAt),
          metrics,
          previousMetrics,
        ),
      );
      previousMetrics = metrics.snapshot();

      if (builds.length === buildCount) {
        finish();
        return;
      }

      buildStartedAt = performance.now();
      watching.invalidate();
    });
  });
}

async function getDeclaredRspackVersion() {
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
  return packageJson.devDependencies["@rspack/core"];
}

async function main() {
  await rm(outputDirectory, { force: true, recursive: true });

  const layout = await getVerifiedLayout();
  const compiler = rspack(config);
  const options = parseBenchmarkOptions(process.argv.slice(2));
  const metrics = createResolverMetrics(compiler, options.mode === "mechanism");
  let builds;
  let mechanism;

  try {
    if (options.mode === "cold") {
      builds = [await runColdBuild(compiler, metrics)];
    } else if (options.mode === "mechanism") {
      mechanism = await runResolverMechanism(compiler, metrics);
    } else {
      builds = await watchBuilds(compiler, options.watchBuildCount, metrics);
    }
  } finally {
    await close(compiler);
    await rm(outputDirectory, { force: true, recursive: true });
  }

  const declaredRspackVersion = await getDeclaredRspackVersion();

  if (options.mode === "mechanism") {
    const result = {
      declaredRspackVersion,
      ...layout,
      mode: options.mode,
      mechanism,
    };

    console.log(`Rspack: ${result.declaredRspackVersion}`);
    console.log("Mode: mechanism");
    console.log(
      `Layout: ${result.declaredNodeLinker} (uses pnpm virtual store: ${result.usesPnpmVirtualStore})`,
    );
    console.log(
      `One-request cold missing records: ${result.mechanism.oneRequestProbe.cold.missingRecordCount} (${result.mechanism.oneRequestProbe.cold.missingRootRelativePathBytes} root-relative bytes)`,
    );
    console.log(
      `One-request warm missing records: ${result.mechanism.oneRequestProbe.warm.missingRecordCount} (${result.mechanism.oneRequestProbe.warm.missingRootRelativePathBytes} root-relative bytes)`,
    );
    console.log(
      `One-request warm missing node_modules records: ${result.mechanism.oneRequestProbe.warm.missingNodeModulesRecordCount}`,
    );
    console.log(
      `Scaled warm replay: ${result.mechanism.scaledWarmReplayPasses[0].missingRecordCount} records across ${result.mechanism.scaledWarmReplayPasses[0].occurrenceCount} occurrences (${result.mechanism.scaledWarmReplayPasses[0].missingRootRelativePathBytes} root-relative bytes)`,
    );
    console.log(
      `Second scaled pass root-relative-byte-identical: ${result.mechanism.scaledWarmReplayStability.byteIdentical}`,
    );
    console.log(JSON.stringify(result));
    return;
  }

  const elapsedMilliseconds = builds.reduce(
    (total, build) => total + build.elapsedMilliseconds,
    0,
  );
  const finalBuild = builds[builds.length - 1];

  const result = {
    declaredRspackVersion,
    ...layout,
    mode: options.mode,
    buildCount: builds.length,
    warmBuildCount: options.mode === "watch" ? options.watchBuildCount - 1 : 0,
    elapsedMilliseconds,
    meanBuildMilliseconds: Math.round(elapsedMilliseconds / builds.length),
    moduleCount: finalBuild.moduleCount,
    peakRssKibibytes: finalBuild.peakRssKibibytes,
    builds,
  };

  console.log(`Rspack: ${result.declaredRspackVersion}`);
  console.log(`Mode: ${result.mode}`);
  console.log(
    `Layout: ${result.declaredNodeLinker} (uses pnpm virtual store: ${result.usesPnpmVirtualStore})`,
  );
  console.log(
    result.mode === "watch"
      ? `Builds: ${result.buildCount} (1 cold + ${result.warmBuildCount} warm invalidations)`
      : "Builds: 1 cold compilation",
  );
  console.log(`Elapsed: ${result.elapsedMilliseconds} ms total (${result.meanBuildMilliseconds} ms/build)`);
  console.log(`Peak RSS: ${formatPeakRss(result.peakRssKibibytes)}`);
  console.log(`Modules: ${result.moduleCount}`);
  console.log(
    `Resolver requests: ${finalBuild.resolverRequests} (${finalBuild.bareResolverRequests} bare)`,
  );
  console.log(
    `Deduplicated missing dependency paths: ${finalBuild.deduplicatedMissingDependencyCount} (${finalBuild.deduplicatedMissingDependencyRootRelativePathBytes} root-relative bytes)`,
  );
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
