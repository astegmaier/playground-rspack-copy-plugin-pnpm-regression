import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const fluentIconEntry = require.resolve("@fluentui/react-icons");
const fluentIconEsmDirectory = path.join(path.dirname(fluentIconEntry), "../lib");
const fluentReactEntry = require.resolve("@fluentui/react");
const fluentReactCommonJsDirectory = path.dirname(fluentReactEntry);
const fluentReactEsmDirectory = path.join(fluentReactCommonJsDirectory, "../lib");
const fluentComponentsCommonJsEntry = require.resolve("@fluentui/react-components");
const dateFnsEntry = require.resolve("date-fns");
const dateFnsDirectory = path.dirname(dateFnsEntry);

export const outputDirectory = path.join(rootDirectory, ".rspack-benchmark-output");

export default {
  mode: "production",
  context: rootDirectory,
  entry: "./src/index.js",
  output: {
    path: outputDirectory,
    filename: "bundle.js",
  },
  devtool: false,
  resolve: {
    alias: {
      "@fixture-date-fns": dateFnsDirectory,
      "@fixture-fluent-icons-svg-cjs": path.join(path.dirname(fluentIconEntry), "atoms/svg"),
      "@fixture-fluent-icons-svg-esm": path.join(fluentIconEsmDirectory, "atoms/svg"),
      "@fixture-fluent-components-cjs": fluentComponentsCommonJsEntry,
      "@fixture-fluent-react-esm": fluentReactEsmDirectory,
    },
  },
  optimization: {
    minimize: false,
  },
  stats: "none",
};
