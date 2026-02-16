import { $ } from "bun";
import { existsSync as exists } from "node:fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const NVIDIA_REPO = "https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64";
const KEYRING_VERSION = "1.1-1";

function parse(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN))
    throw new Error(`invalid cuda version: ${version} (expected major.minor.patch)`);
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function pathsFor(version: string) {
  const { major, minor } = parse(version);
  return {
    pkg: `cuda-toolkit-${major}-${minor}`,
    cuda: `/usr/local/cuda-${major}.${minor}`,
    bin: `/usr/local/cuda-${major}.${minor}/bin`,
    lib: `/usr/local/cuda-${major}.${minor}/lib64`,
  };
}

async function writeOutput(name: string, value: string) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  await $`echo ${name}=${value} >> ${process.env.GITHUB_OUTPUT}`;
}

async function emitPaths(version: string) {
  const paths = pathsFor(version);

  await $`sudo mkdir -p ${paths.cuda}`;
  await $`sudo chown -R ${process.env.USER}:${process.env.USER} ${paths.cuda}`;

  await writeOutput("path", paths.cuda);
  await writeOutput("bin", paths.bin);
  await writeOutput("lib", paths.lib);
  await writeOutput("pkg", paths.pkg);

  console.log(JSON.stringify(paths));
}

async function normalizeCachePermissions(version: string) {
  const paths = pathsFor(version);
  await $`sudo chown -R ${process.env.USER}:${process.env.USER} ${paths.cuda}`;
}

async function install(version: string) {
  const base = pathsFor(version);

  const paths = {
    deb: `${NVIDIA_REPO}/cuda-keyring_${KEYRING_VERSION}_all.deb`,
    pin: `${NVIDIA_REPO}/cuda-ubuntu2204.pin`,
    pinDest: "/etc/apt/preferences.d/cuda-repository-pin-600",
    pkg: base.pkg,
    cuda: base.cuda,
    bin: base.bin,
    lib: base.lib,
  };

  const nvccPath = `${paths.bin}/nvcc`;
  if (exists(nvccPath)) {
    console.log(`using cached ${paths.pkg} from ${paths.cuda}`);
  } else {
    console.log(`installing ${paths.pkg} from ${NVIDIA_REPO}`);

    // add nvidia apt repo
    await $`wget -q ${paths.deb} -O /tmp/cuda-keyring.deb`;
    await $`sudo dpkg -i /tmp/cuda-keyring.deb`;
    await $`wget -q ${paths.pin} -O /tmp/cuda.pin`;
    await $`sudo mv /tmp/cuda.pin ${paths.pinDest}`;
    await $`sudo apt-get update`;

    // install toolkit (no driver -- CI has no GPU)
    await $`sudo apt-get install -y ${paths.pkg}`;
  }

  // export env for subsequent github actions steps
  if (process.env.GITHUB_ENV && process.env.GITHUB_PATH) {
    await $`echo CUDA_PATH=${paths.cuda} >> ${process.env.GITHUB_ENV}`;
    await $`echo LD_LIBRARY_PATH=${paths.lib}:${process.env.LD_LIBRARY_PATH ?? ""} >> ${process.env.GITHUB_ENV}`;
    await $`echo ${paths.bin} >> ${process.env.GITHUB_PATH}`;
  }

  console.log(`cuda toolkit installed at ${paths.cuda}`);
}

async function main() {
  await yargs(hideBin(process.argv))
    .scriptName("cuda")
    .command(
      "paths <cuda>",
      "Resolve canonical CUDA paths for CI",
      (cmd) =>
        cmd.positional("cuda", {
          type: "string",
          demandOption: true,
          desc: "CUDA version (major.minor.patch)",
        }),
      async (argv) => {
        await emitPaths(argv.cuda);
      },
    )
    .command(
      "normalize-cache-permissions <cuda>",
      "Normalize CUDA cache directory ownership",
      (cmd) =>
        cmd.positional("cuda", {
          type: "string",
          demandOption: true,
          desc: "CUDA version (major.minor.patch)",
        }),
      async (argv) => {
        await normalizeCachePermissions(argv.cuda);
      },
    )
    .command(
      "install <cuda>",
      "Install CUDA toolkit via apt (e.g. install 12.6.3)",
      (cmd) =>
        cmd.positional("cuda", {
          type: "string",
          demandOption: true,
          desc: "CUDA version (major.minor.patch)",
        }),
      async (argv) => {
        await install(argv.cuda);
      },
    )
    .demandCommand(1)
    .strict()
    .help()
    .parseAsync();
}

if (import.meta.main) void main();
