import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const tauriConfigPath = path.join(appRoot, "src-tauri", "tauri.conf.json");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = rawLine.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] != null) {
      continue;
    }

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    process.env[key] = value;
  }
}

function resolveAppRelativePath(rawPath) {
  const trimmed = String(rawPath || "").trim();
  if (!trimmed) {
    return "";
  }
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(appRoot, trimmed);
}

function uniqueNonEmptyPaths(paths) {
  return [...new Set(paths.filter(Boolean))];
}

loadEnvFile(path.join(appRoot, ".env"));

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
const bundleRoot = path.join(appRoot, "src-tauri", "target", "release", "bundle");
const macosBundleDir = path.join(bundleRoot, "macos");
const dmgBundleDir = path.join(bundleRoot, "dmg");
const appSourceDir = path.join(appRoot, "app");
const knowledgeBaseSourceDir = path.resolve(appRoot, "..", "knowledge-base");
const bundledPiRuntimeRoots = uniqueNonEmptyPaths([
  resolveAppRelativePath(process.env.GOGO_DESKTOP_PI_RUNTIME_ROOT || ""),
  path.join(appRoot, "pi-runtime"),
  path.resolve(appRoot, "..", "pi-runtime"),
]);
const uvCacheDir = path.resolve(process.env.GOGO_DESKTOP_UV_CACHE_DIR || path.join(appRoot, ".cache", "uv"));
const pyinstallerConfigDir = path.resolve(
  process.env.GOGO_DESKTOP_PYINSTALLER_CONFIG_DIR || path.join(appRoot, ".cache", "pyinstaller"),
);
const generatedTauriConfigPath = path.resolve(
  process.env.GOGO_DESKTOP_TAURI_CONFIG_PATH || path.join(appRoot, ".cache", "tauri.generated.conf.json"),
);
const windowsTargetTriple = process.env.GOGO_DESKTOP_WINDOWS_TARGET_TRIPLE || "x86_64-pc-windows-msvc";
const PI_RUNTIME_INCLUDE = new Set([
  "pi",
  "pi.exe",
  "pi.cmd",
  "package.json",
  "theme",
  "assets",
  "export-html",
  "photon_rs_bg.wasm",
]);

function log(message) {
  console.log(`[gogo-desktop-build] ${message}`);
}

function defaultBundledPiSourceCandidates() {
  const runtimeRoots = bundledPiRuntimeRoots;
  if (process.platform === "darwin") {
    const candidates = [];
    runtimeRoots.forEach((runtimeRoot) => {
      if (process.arch === "arm64") {
        candidates.push(
          path.join(runtimeRoot, "macos-arm64", "pi"),
          path.join(runtimeRoot, "macos-arm64"),
        );
      }
      if (process.arch === "x64") {
        candidates.push(
          path.join(runtimeRoot, "macos-x64", "pi"),
          path.join(runtimeRoot, "macos-x64"),
        );
      }
      candidates.push(
        path.join(runtimeRoot, "macos", "pi"),
        path.join(runtimeRoot, "macos"),
      );
    });
    return candidates;
  }

  if (process.platform === "win32") {
    return runtimeRoots.flatMap((runtimeRoot) => [
      path.join(runtimeRoot, "windows-x64", "pi.exe"),
      path.join(runtimeRoot, "windows-x64"),
      path.join(runtimeRoot, "windows", "pi.exe"),
      path.join(runtimeRoot, "windows"),
    ]);
  }

  return [];
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

async function resolveBundledPiSourcePath() {
  const configuredPath = String(process.env.GOGO_DESKTOP_PI_BINARY || "").trim();
  if (configuredPath) {
    return resolveAppRelativePath(configuredPath);
  }

  const defaultCandidate = await firstExisting(defaultBundledPiSourceCandidates());
  if (defaultCandidate) {
    log(`using default bundled pi runtime from ${defaultCandidate}`);
    return defaultCandidate;
  }

  const expectedPaths = defaultBundledPiSourceCandidates();
  const helpText = expectedPaths.length
    ? `Expected one of: ${expectedPaths.join(", ")}`
    : "Set GOGO_DESKTOP_PI_BINARY to a valid pi runtime launcher or directory.";
  throw new Error(`bundled pi runtime is required for desktop builds. ${helpText}`);
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

  const sourcePath = await resolveBundledPiSourcePath();
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
    if (entry === ".DS_Store" || !PI_RUNTIME_INCLUDE.has(entry)) {
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

async function findBuiltAppBundle() {
  try {
    const entries = await fs.readdir(macosBundleDir, { withFileTypes: true });
    const appEntry = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(".app"));
    return appEntry ? path.join(macosBundleDir, appEntry.name) : null;
  } catch {
    return null;
  }
}

async function findBuiltDmg() {
  try {
    const entries = await fs.readdir(dmgBundleDir, { withFileTypes: true });
    const dmgEntry = entries.find((entry) => entry.isFile() && entry.name.endsWith(".dmg"));
    return dmgEntry ? path.join(dmgBundleDir, dmgEntry.name) : null;
  } catch {
    return null;
  }
}

async function syncDirectoryIfPresent(sourceDir, targetDir) {
  try {
    await fs.access(sourceDir);
  } catch {
    return false;
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
  });
  return true;
}

async function syncBundleRuntimeResources(appBundlePath) {
  const resourcesDir = path.join(appBundlePath, "Contents", "Resources");
  const bundledAppDir = path.join(resourcesDir, "app");
  const bundledBackendDir = path.join(resourcesDir, "backend-runtime");
  const bundledPiDir = path.join(resourcesDir, "pi-runtime");
  const bundledKnowledgeBaseDir = path.join(resourcesDir, "knowledge-base");

  const syncedAppDir = await syncDirectoryIfPresent(appSourceDir, bundledAppDir);
  if (!syncedAppDir) {
    throw new Error(`app resources source directory is missing: ${appSourceDir}`);
  }

  await fs.rm(bundledBackendDir, { recursive: true, force: true });
  await fs.cp(backendDistDir, bundledBackendDir, {
    recursive: true,
    force: true,
  });

  const stagedPiLauncher = await firstExisting(piLauncherCandidates(piDistDir));
  if (stagedPiLauncher) {
    await fs.rm(bundledPiDir, { recursive: true, force: true });
    await fs.cp(piDistDir, bundledPiDir, {
      recursive: true,
      force: true,
    });
  }

  const syncedKnowledgeBaseDir = await syncDirectoryIfPresent(knowledgeBaseSourceDir, bundledKnowledgeBaseDir);
  if (!syncedKnowledgeBaseDir) {
    log(`knowledge-base source directory not found; keeping existing bundle contents at ${bundledKnowledgeBaseDir}`);
  }

  const bundledBackendExecutable = await firstExisting(backendExecutableCandidates(bundledBackendDir));
  if (!bundledBackendExecutable) {
    throw new Error(`bundled app is missing backend executable after sync: ${bundledBackendDir}`);
  }

  const bundledFrontendAssetsDir = path.join(bundledAppDir, "frontend", "assets");
  try {
    await fs.access(bundledFrontendAssetsDir);
  } catch {
    throw new Error(`bundled app is missing frontend assets after sync: ${bundledFrontendAssetsDir}`);
  }

  log(`synced runtime resources into ${appBundlePath}`);
}

async function rebuildDmgFromApp(appBundlePath) {
  const dmgPath = await findBuiltDmg();
  if (!dmgPath) {
    log("no dmg artifact found after tauri build; skipping dmg rebuild");
    return;
  }

  const volumeName = path.basename(appBundlePath, ".app");
  await fs.rm(dmgPath, { force: true });
  await spawnChecked(
    "hdiutil",
    [
      "create",
      "-volname",
      volumeName,
      "-srcfolder",
      appBundlePath,
      "-ov",
      "-format",
      "UDZO",
      dmgPath,
    ],
    {
      env: process.env,
    },
  );

  log(`rebuilt dmg artifact at ${dmgPath}`);
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

    if (process.platform === "darwin") {
      const appBundlePath = await findBuiltAppBundle();
      if (!appBundlePath) {
        throw new Error("tauri build completed but no .app bundle was found");
      }

      await syncBundleRuntimeResources(appBundlePath);
      await rebuildDmgFromApp(appBundlePath);
    }
  } finally {
    await cleanupBundleInputs();
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[gogo-desktop-build] ${detail}`);
  process.exit(1);
});
