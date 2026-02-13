import { existsSync } from "node:fs";
import { join } from "node:path";

import { $ } from "bun";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { bump } from "./version";
import { install } from "./install";

const dir = join(import.meta.dir, "..");
const img = "node-whisper-cpp-ci-linux";


async function main() {
  await yargs(hideBin(process.argv))
    .scriptName("ci")
    .command(
      "install",
      "Install Linux CI dependencies locally",
      (command) => command,
      async () => await install(),
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
        await $`act workflow_dispatch -W .github/workflows/build.yml -j build --container-architecture linux/amd64 -P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:full-22.04`.cwd(dir);
      }
    )
    .command(
      "version <bump>",
      "Bump version across all package.json files",
      (command) =>
        command.positional("bump", {
          type: "string",
          desc: "major, minor, patch, or an explicit version string",
          demandOption: true,
        }),
      async (argv) => {
        const version = await bump(argv.bump as string);
        console.log(`version: ${version}`);
        if (process.env.GITHUB_OUTPUT) {
          await Bun.file(process.env.GITHUB_OUTPUT).writer().write(`version=${version}\n`);
        }
      }
    )
    .demandCommand(1)
    .strict()
    .help()
    .parseAsync();
}

if (import.meta.main) void main();
