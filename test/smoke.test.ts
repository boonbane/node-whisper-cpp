import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { spinner, intro, outro } from "@clack/prompts";
import { describe, expect, it } from "bun:test";

import { Build } from "#tools/build";
import { detect, resolveTarget, resolve } from "../packages/node-whisper-cpp/src/platform";
import { current } from "../tools/version";

const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");

const repoRoot = join(import.meta.dir, "..");
const jsPackageDir = join(import.meta.dir, "packages", "js");
const tsPackageDir = join(import.meta.dir, "packages", "ts");
const npmDir = join(repoRoot, ".cache", "store", "npm");

const version = current();
const triple = detect();
const platformPackage = `@spader/node-whisper-cpp-${triple}`;

const jsTarball = join(npmDir, `spader-node-whisper-cpp-${version}.tgz`);
const addonTarball = join(npmDir, `spader-node-whisper-cpp-${triple}-${version}.tgz`);

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `cwd: ${cwd}`,
        `exit: ${result.status ?? -1}`,
        result.stdout,
        result.stderr,
      ].join("\n")
    );
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function resetPackageDir(packageDir: string) {
  rmSync(join(packageDir, "node_modules"), { recursive: true, force: true });
  rmSync(join(packageDir, "package-lock.json"), { force: true });
  rmSync(join(packageDir, "dist"), { recursive: true, force: true });
}

function patchFixturePackageJson(packageDir: string, jsTarball: string, addonTarball: string) {
  const pkgPath = join(packageDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.dependencies = {
    "@spader/node-whisper-cpp": `file:${jsTarball}`,
  };
  pkg.optionalDependencies = {
    [platformPackage]: `file:${addonTarball}`,
  };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function restoreFixturePackageJson(packageDir: string) {
  run("git", ["checkout", "package.json"], packageDir);
}

function assertInstalledPlatformPackage(packageDir: string) {
  const packageJsonPath = join(packageDir, "node_modules", ...platformPackage.split("/"), "package.json");
  expect(existsSync(packageJsonPath)).toBe(true);
}

describe("smoke", () => {
  it(
    "builds canonical tarballs and loads package in JS + TS consumers",
    async () => {
      const target = resolveTarget()

      intro(resolve())
      const progress = spinner();
      const runPhase = async <T>(label: string, fn: () => Promise<T> | T): Promise<T> => {
        progress.start(label);
        try {
          const result = await fn();
          progress.stop(label);
          return result;
        } catch (error) {
          progress.stop(`${label} failed`);
          throw error;
        }
      };

      await runPhase("Ensuring tarballs", () => {
        for (const path of [jsTarball, addonTarball]) {
          if (!existsSync(path)) {
            outro(`Missing ${path}. Build first.`);
            process.exit(1);
          }
        }
      });

      resetPackageDir(jsPackageDir);
      patchFixturePackageJson(jsPackageDir, jsTarball, addonTarball);
      try {
        await runPhase("Installing JS fixture", () => {
          run("npm", ["install"], jsPackageDir);
        });
        await runPhase("Running JS smoke", () => {
          assertInstalledPlatformPackage(jsPackageDir);
          const jsRun = run("node", ["./check.mjs"], jsPackageDir);
          expect(jsRun.stdout).toContain("smoke-js-ok");
        });
      } finally {
        resetPackageDir(jsPackageDir);
        restoreFixturePackageJson(jsPackageDir);
      }

      resetPackageDir(tsPackageDir);
      patchFixturePackageJson(tsPackageDir, jsTarball, addonTarball);
      try {
        await runPhase("Installing TS fixture", () => {
          run("npm", ["install"], tsPackageDir);
        });
        await runPhase("Compiling TS fixture", () => {
          assertInstalledPlatformPackage(tsPackageDir);
          run("node", [tsc, "--project", "tsconfig.json"], tsPackageDir);
        });
        await runPhase("Running TS smoke", () => {
          const tsRun = run("node", ["./dist/check.js"], tsPackageDir);
          expect(tsRun.stdout).toContain("smoke-ts-ok");
        });
      } finally {
        resetPackageDir(tsPackageDir);
        restoreFixturePackageJson(tsPackageDir);
      }
    },
    1200000
  );
});
