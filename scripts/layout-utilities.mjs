export function parseNodeLinker(workspaceSettings) {
  const nodeLinker = workspaceSettings.match(/^nodeLinker:\s*(.+)$/m)?.[1];

  if (nodeLinker !== "isolated" && nodeLinker !== "hoisted") {
    throw new Error("pnpm-workspace.yaml must set nodeLinker to isolated or hoisted.");
  }

  return nodeLinker;
}
