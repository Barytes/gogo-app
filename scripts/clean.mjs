import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const artifactPaths = [
  ".cache",
  "dist",
  "dist-electron",
  path.join("src-tauri", "desktop-runtime"),
  path.join("src-tauri", "desktop-runtime-staging"),
  path.join("src-tauri", "gen"),
  path.join("src-tauri", "target"),
];

async function removeArtifact(relativePath) {
  const absolutePath = path.join(appRoot, relativePath);
  await fs.rm(absolutePath, { recursive: true, force: true });
  console.log(`[gogo-clean] removed ${relativePath}`);
}

async function run() {
  await Promise.all(artifactPaths.map(removeArtifact));
  console.log("[gogo-clean] cleanup complete");
}

run().catch((error) => {
  console.error(`[gogo-clean] cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
