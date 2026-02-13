import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NativeAddon } from "./types.js";
import { detect } from "./platform.js";

const require = createRequire(import.meta.url);
const currentDir = dirname(fileURLToPath(import.meta.url));

function resolvePlatformPackageDir(name: string): string {
  try {
    const entry = require.resolve(name);
    return join(dirname(entry), "..");
  } catch {
    const prefix = "@spader/node-whisper-cpp-";
    return join(currentDir, "..", "packages", "platform", name.slice(prefix.length));
  }
}

interface Store {
  addon: NativeAddon | null
}

let store: Store = {
  addon: null
}


export function loadAddon(): NativeAddon {
  if (store.addon != null) return store.addon;

  const triple = detect()
  const name = `@spader/node-whisper-cpp-${triple}`
  const dir = resolvePlatformPackageDir(name);
  const addonPath = join(dir, "bins", "whisper-addon.node");

  store.addon = require(addonPath) as NativeAddon;
  return store.addon;
}
