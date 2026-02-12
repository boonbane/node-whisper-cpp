import { existsSync } from "node:fs";
import { join } from "node:path";

import { $ } from "bun";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const dir = join(import.meta.dir, "..");
const img = "node-whisper-cpp-ci-linux";

const root = () => process.getuid !== undefined && process.getuid() === 0;
const has = () => existsSync("/usr/bin/sudo");
const sudo = (s: string) => (root() || !has() ? s : `sudo ${s}`);

type PackageConfig = {
  apt: string[];
  curlSh: string[];
  cmd: string[];
};

interface Provider {
  init: () => string | null;
  install: (pkg: string) => string;
  batch: (pkgs: string[]) => string;
}

const cfg: PackageConfig = {
  apt: [
    "build-essential",
    "cmake",
    "ninja-build",
    "pkg-config",
    "git",
    "curl",
    "ca-certificates",
    "gnupg",
    "python3",
    "unzip",
  ],
  curlSh: [
    "https://deb.nodesource.com/setup_20.x",
    "https://bun.sh/install",
  ],
  cmd: [
    sudo("apt-get install -y nodejs"),
  ],
};

const providers: Record<string, Provider> = {
  apt: {
    init: () => sudo("apt-get update"),
    install: (pkg) => sudo(`apt-get install -y ${pkg}`),
    batch: (pkgs) => sudo(`apt-get install -y ${pkgs.join(" ")}`),
  },
  curlSh: {
    init: () => null,
    install: (url) => `curl -fsSL ${url} | ${sudo("bash -")}`,
    batch: (urls) => urls.map((url) => `curl -fsSL ${url} | ${sudo("bash -")}`).join(" && "),
  },
};

async function sync(config: PackageConfig) {
  const run: string[] = [];

  const aptInit = providers.apt.init();
  if (aptInit) run.push(aptInit);
  if (config.apt.length > 0) run.push(providers.apt.batch(config.apt));

  for (const url of config.curlSh) {
    run.push(providers.curlSh.install(url));
  }

  run.push(...config.cmd);

  for (const s of run) {
    console.log(`$ ${s}`);
    await $`bash -lc ${s}`.cwd(dir);
  }
}

async function main() {
  await yargs(hideBin(process.argv))
    .scriptName("ci")
    .command(
      "install",
      "Install Linux CI dependencies locally",
      (command) => command,
      async () => {
        await sync(cfg);
      }
    )
    .command(
      "image",
      "Build local Linux CI Docker image",
      (command) => command.option("tag", { type: "string", default: img, desc: "Docker image tag" }),
      async (argv) => {
        await $`docker build -f tools/docker/linux/Dockerfile -t ${argv.tag} .`.cwd(dir);
      }
    )
    .command(
      "build",
      "Build via GH workflow",
      (command) => command,
      async () => {
        await $`act workflow_dispatch -W .github/workflows/ci-linux.yml -j linux-build-smoke --container-architecture linux/amd64 -P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:full-22.04`.cwd(dir);
      }
    )
    .demandCommand(1)
    .strict()
    .help()
    .parseAsync();
}

if (import.meta.main) void main();
