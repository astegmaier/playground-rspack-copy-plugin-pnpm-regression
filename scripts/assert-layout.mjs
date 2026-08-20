import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseNodeLinker } from "./layout-utilities.mjs";

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageLink = path.join(rootDirectory, "node_modules", "@fluentui", "react-icons");
const workspaceSettings = await readFile(path.join(rootDirectory, "pnpm-workspace.yaml"), "utf8");
const nodeLinker = parseNodeLinker(workspaceSettings);
const linkMetadata = await lstat(packageLink);
const packageRealPath = await realpath(packageLink);
const normalizedRealPath = packageRealPath.split(path.sep).join("/");
const usesPnpmVirtualStore = normalizedRealPath.includes("/node_modules/.pnpm/");

const layout = {
  nodeLinker,
  packageLink: path.relative(rootDirectory, packageLink),
  packageLinkIsSymlink: linkMetadata.isSymbolicLink(),
  packageRealPath: path.relative(rootDirectory, packageRealPath),
  usesPnpmVirtualStore,
};

console.log(JSON.stringify(layout, null, 2));

if (nodeLinker === "isolated" && !usesPnpmVirtualStore) {
  throw new Error("The isolated layout did not resolve @fluentui/react-icons through pnpm's virtual store.");
}

if (nodeLinker === "hoisted" && usesPnpmVirtualStore) {
  throw new Error("The hoisted layout still resolves @fluentui/react-icons through pnpm's virtual store.");
}
