import { $ } from "bun";
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

async function install(version: string) {
  const { major, minor } = parse(version);

  const paths = {
    deb: `${NVIDIA_REPO}/cuda-keyring_${KEYRING_VERSION}_all.deb`,
    pin: `${NVIDIA_REPO}/cuda-ubuntu2204.pin`,
    pinDest: "/etc/apt/preferences.d/cuda-repository-pin-600",
    pkg: `cuda-toolkit-${major}-${minor}`,
    cuda: `/usr/local/cuda-${major}.${minor}`,
    bin: `/usr/local/cuda-${major}.${minor}/bin`,
    lib: `/usr/local/cuda-${major}.${minor}/lib64`,
  };

  console.log(`installing ${paths.pkg} from ${NVIDIA_REPO}`);

  // add nvidia apt repo
  await $`wget -q ${paths.deb} -O /tmp/cuda-keyring.deb`;
  await $`sudo dpkg -i /tmp/cuda-keyring.deb`;
  await $`wget -q ${paths.pin} -O /tmp/cuda.pin`;
  await $`sudo mv /tmp/cuda.pin ${paths.pinDest}`;
  await $`sudo apt-get update`;

  // install toolkit (no driver -- CI has no GPU)
  await $`sudo apt-get install -y ${paths.pkg}`;

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
