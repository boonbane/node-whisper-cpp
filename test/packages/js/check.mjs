import { createContext, platform, systemInfo, version } from "@spader/node-whisper-cpp";

const triple = platform.detect();
await import(`@spader/node-whisper-cpp-${triple}`);

if (typeof version() !== "string" || version().length === 0) {
  throw new Error("version() did not return a non-empty string");
}

if (typeof systemInfo() !== "string") {
  throw new Error("systemInfo() did not return a string");
}

const context = createContext({ model: "../../for-tests-ggml-tiny.bin" });
context.free();

console.log("smoke-js-ok");
