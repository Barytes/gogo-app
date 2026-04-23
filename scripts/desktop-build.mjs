import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const tauriConfigPath = path.join(appRoot, "src-tauri", "tauri.conf.json");
const distRoot = path.resolve(
  process.env.GOGO_DESKTOP_DIST_ROOT || path.join(appRoot, "src-tauri", "desktop-runtime-staging"),
);
const backendDistDir = path.join(distRoot, "backend");
const piDistDir = path.join(distRoot, "pi");
const pyinstallerBuildRoot = path.resolve(
  process.env.GOGO_DESKTOP_PYINSTALLER_ROOT || path.join(appRoot, "src-tauri", "target", "pyinstaller-staging"),
);
const specRoot = path.join(pyinstallerBuildRoot, "spec");
const workRoot = path.join(pyinstallerBuildRoot, "work");
const uvCacheDir = path.resolve(process.env.GOGO_DESKTOP_UV_CACHE_DIR || path.join(appRoot, ".cache", "uv"));
const pyinstallerConfigDir = path.resolve(
  process.env.GOGO_DESKTOP_PYINSTALLER_CONFIG_DIR || path.join(appRoot, ".cache", "pyinstaller"),
);
const generatedTauriConfigPath = path.resolve(
  process.env.GOGO_DESKTOP_TAURI_CONFIG_PATH || path.join(appRoot, ".cache", "tauri.generated.conf.json"),
);
const windowsTargetTriple = process.env.GOGO_DESKTOP_WINDOWS_TARGET_TRIPLE || "x86_64-pc-windows-msvc";

function log(message) {
  console.log(`[gogo-desktop-build] ${message}`);
}

function tauriCommand() {
  const localBinary = path.join(
    appRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tauri.cmd" : "tauri",
  );
  return existsSync(localBinary) ? localBinary : process.platform === "win32" ? "tauri.cmd" : "tauri";
}

function backendExecutableCandidates(directory) {
  return [
    path.join(directory, "gogo-backend"),
    path.join(directory, "gogo-backend.exe"),
  ];
}

function piLauncherCandidates(directory) {
  return [
    path.join(directory, "pi"),
    path.join(directory, "pi.exe"),
    path.join(directory, "pi.cmd"),
  ];
}

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

async function clearDirectory(directory, { keep = [] } = {}) {
  await ensureDir(directory);
  for (const entry of await fs.readdir(directory)) {
    if (keep.includes(entry)) {
      continue;
    }
    await fs.rm(path.join(directory, entry), { recursive: true, force: true });
  }
}

async function cleanupBundleInputs() {
  await fs.rm(distRoot, { recursive: true, force: true });
}

async function listFilesRecursive(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name === ".gitkeep") {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(entryPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function addDirectoryResources(resourceMap, sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    return;
  }
  const files = await listFilesRecursive(sourceDir);
  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath);
    let targetPath = path.posix.join(targetDir, relativePath.split(path.sep).join("/"));
    if (targetPath === "backend-runtime/gogo-backend.exe") {
      targetPath = "backend-runtime/gogo-backend.bin";
    }
    resourceMap[filePath] = targetPath;
  }
}

async function addFileResource(resourceMap, sourceFile, targetFile) {
  if (!existsSync(sourceFile)) {
    return;
  }
  resourceMap[sourceFile] = targetFile;
}

async function buildBundleResources() {
  const resourceMap = {};
  const knowledgeBaseRoot = path.resolve(appRoot, "..", "knowledge-base");

  await addDirectoryResources(resourceMap, path.join(appRoot, "app"), "app");
  await addDirectoryResources(resourceMap, backendDistDir, "backend-runtime");
  await addDirectoryResources(resourceMap, piDistDir, "pi-runtime");
  await addFileResource(resourceMap, path.join(knowledgeBaseRoot, "AGENTS.md"), "knowledge-base/AGENTS.md");
  await addFileResource(resourceMap, path.join(knowledgeBaseRoot, "README.md"), "knowledge-base/README.md");
  await addDirectoryResources(resourceMap, path.join(knowledgeBaseRoot, "inbox"), "knowledge-base/inbox");
  await addDirectoryResources(resourceMap, path.join(knowledgeBaseRoot, "raw"), "knowledge-base/raw");
  await addDirectoryResources(resourceMap, path.join(knowledgeBaseRoot, "wiki"), "knowledge-base/wiki");
  await addDirectoryResources(resourceMap, path.join(knowledgeBaseRoot, "schemas"), "knowledge-base/schemas");
  await addDirectoryResources(resourceMap, path.join(knowledgeBaseRoot, "skills"), "knowledge-base/skills");

  return resourceMap;
}

async function writeGeneratedTauriConfig() {
  const config = JSON.parse(await fs.readFile(tauriConfigPath, "utf8"));
  config.bundle = config.bundle || {};
  config.bundle.resources = await buildBundleResources();
  if (process.platform === "win32") {
    config.bundle.externalBin = ["./desktop-runtime-staging/gogo-backend"];
  }
  await ensureDir(path.dirname(generatedTauriConfigPath));
  await fs.writeFile(generatedTauriConfigPath, `${JSON.stringify(config, null, 2)}\n`);
  return generatedTauriConfigPath;
}

function spawnChecked(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const isWindowsBatch =
      process.platform === "win32"
      && /\.(cmd|bat)$/i.test(String(command));
    const child = isWindowsBatch
      ? spawn("cmd.exe", ["/d", "/s", "/c", `"${command}"`, ...args], {
          cwd: appRoot,
          stdio: "inherit",
          windowsVerbatimArguments: true,
          ...options,
        })
      : spawn(command, args, {
          cwd: appRoot,
          stdio: "inherit",
          ...options,
        });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`command terminated by signal ${signal}: ${command}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`command exited with code ${code}: ${command}`));
        return;
      }
      resolve();
    });
  });
}

async function buildBackendRuntime() {
  await Promise.all([
    ensureDir(distRoot),
    ensureDir(specRoot),
    ensureDir(workRoot),
    ensureDir(uvCacheDir),
    ensureDir(pyinstallerConfigDir),
  ]);

  await fs.rm(backendDistDir, { recursive: true, force: true });
  await fs.rm(path.join(distRoot, "gogo-backend"), { recursive: true, force: true });

  log("building standalone backend runtime");

  await spawnChecked(
    "uv",
    [
      "run",
      "--with",
      "pyinstaller",
      "pyinstaller",
      "--noconfirm",
      "--clean",
      "--onedir",
      "--name",
      "gogo-backend",
      "--distpath",
      distRoot,
      "--workpath",
      workRoot,
      "--specpath",
      specRoot,
      "app/backend/desktop_entry.py",
    ],
    {
      env: {
        ...process.env,
        UV_CACHE_DIR: uvCacheDir,
        PYINSTALLER_CONFIG_DIR: pyinstallerConfigDir,
      },
    },
  );

  const pyinstallerDistDir = path.join(distRoot, "gogo-backend");
  await fs.rename(pyinstallerDistDir, backendDistDir);

  const executable = await firstExisting(backendExecutableCandidates(backendDistDir));
  if (!executable) {
    throw new Error("standalone backend executable missing");
  }

  if (process.platform === "win32" && executable.toLowerCase().endsWith(".exe")) {
    const packagedExecutable = path.join(backendDistDir, "gogo-backend.bin");
    const sidecarExecutable = path.join(distRoot, `gogo-backend-${windowsTargetTriple}.exe`);
    await fs.rm(packagedExecutable, { force: true });
    await fs.rm(sidecarExecutable, { force: true });
    await fs.rename(executable, packagedExecutable);
    await fs.copyFile(packagedExecutable, sidecarExecutable);
  }

  log(`standalone backend runtime ready at ${backendDistDir}`);
}

async function stageBundledPiRuntime() {
  await clearDirectory(piDistDir, { keep: [".gitkeep"] });

  const configuredPath = String(process.env.GOGO_DESKTOP_PI_BINARY || "").trim();
  if (!configuredPath) {
    log("no bundled pi runtime configured; fallback install path remains enabled");
    return;
  }

  const sourcePath = path.resolve(configuredPath);
  let sourceStat;
  try {
    sourceStat = await fs.stat(sourcePath);
  } catch {
    throw new Error(`bundled pi path not found: ${sourcePath}`);
  }

  const sourceDir = sourceStat.isDirectory() ? sourcePath : path.dirname(sourcePath);
  const launcher = await firstExisting(piLauncherCandidates(sourceDir));
  if (!launcher) {
    throw new Error(`bundled pi runtime is missing launcher: ${sourceDir}`);
  }

  for (const entry of await fs.readdir(sourceDir)) {
    if (entry === ".DS_Store") {
      continue;
    }
    await fs.cp(path.join(sourceDir, entry), path.join(piDistDir, entry), {
      recursive: true,
      force: true,
    });
  }

  try {
    await fs.chmod(path.join(piDistDir, path.basename(launcher)), 0o755);
  } catch {}

  log(`bundled pi runtime staged from ${sourceDir} to ${piDistDir}`);
}

async function runTauriBuild(extraArgs) {
  const generatedConfig = await writeGeneratedTauriConfig();
  try {
    await spawnChecked(tauriCommand(), ["build", "--config", generatedConfig, ...extraArgs], {
      env: process.env,
    });
  } finally {
    await fs.rm(generatedConfig, { force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const requestedCommand = args[0];
  const knownCommands = new Set(["build", "build-backend", "stage-pi"]);
  const command = knownCommands.has(requestedCommand) ? requestedCommand : "build";
  const tailArgs = command === "build" ? (requestedCommand === "build" ? args.slice(1) : args) : args.slice(1);

  if (command === "build-backend") {
    await buildBackendRuntime();
    return;
  }

  if (command === "stage-pi") {
    await stageBundledPiRuntime();
    return;
  }

  await buildBackendRuntime();
  await stageBundledPiRuntime();
  try {
    await runTauriBuild(tailArgs);
  } finally {
    await cleanupBundleInputs();
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[gogo-desktop-build] ${detail}`);
  process.exit(1);
});
