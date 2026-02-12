import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const repoRoot = join(import.meta.dir, "..");

  const paths = [
    ".cache/build",
    ".cache/store",
    ".cache/source",
    "dist",
    "artifacts",
    "packages/platform/linux-x64-cpu/bins",
    "packages/platform/linux-x64-cpu/dist",
    "packages/platform/mac-arm64-metal/bins",
    "packages/platform/mac-arm64-metal/dist",
  ];

  for (const relPath of paths) {
    const absPath = join(repoRoot, relPath);
    if (existsSync(absPath)) {
      rmSync(absPath, { recursive: true, force: true });
    }
  }

  console.log("repo-clean-ok");
}

main();
