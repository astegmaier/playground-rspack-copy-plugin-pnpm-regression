import * as fluentComponents from "@fluentui/react-components";

import publicModuleCount from "./public-graph.cjs";

console.log(publicModuleCount + Object.keys(fluentComponents).length);
