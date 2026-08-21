const path = require("node:path");
const { CopyRspackPlugin } = require("@rspack/core");

module.exports = {
  mode: "production",
  context: __dirname,
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    clean: true,
  },
  optimization: {
    minimize: false,
  },
  plugins: [
    new CopyRspackPlugin({
      patterns: [{ from: "./index.html", to: "./" }],
    }),
  ],
  stats: {
    all: false,
    assets: true,
    hash: true,
    modules: true,
    timings: true,
  },
};
