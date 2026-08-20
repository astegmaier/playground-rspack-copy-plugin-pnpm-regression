const fluentComponentsCommonJs = require("@fixture-fluent-components-cjs");

const contexts = [
  require.context("@fixture-fluent-icons-svg-esm", false, /\.js$/),
  require.context("@fixture-fluent-icons-svg-cjs", false, /\.js$/),
  require.context("@fixture-fluent-react-esm/components", true, /\.js$/),
  require.context("@fixture-date-fns", true, /^\.\/(?!.*\/test\.js$).*\.js$/),
];

module.exports =
  Object.keys(fluentComponentsCommonJs).length +
  contexts.reduce((moduleCount, context) => moduleCount + context.keys().length, 0);
