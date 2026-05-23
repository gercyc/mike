// Post-pack fixups for bun's symlink-heavy layout:
//
// Bun installs packages as symlinks inside each package's node_modules that
// point to a shared .bun cache at the monorepo root. electron-builder copies
// the symlinks but NOT the .bun cache, so all require() calls fail at runtime.
//
// This script resolves every symlink in the copied resources by replacing it
// with a real directory copy of its target. It then:
//   - Copies .next/static into standalone so JS/CSS chunks are served.
//   - Copies frontend/public into standalone for static assets.
const fs = require("node:fs");
const path = require("node:path");

// Recursively copy src → dest, resolving symlinks on the way.
function copyResolved(src, dest) {
  const real = fs.realpathSync(src);
  const stat = fs.statSync(real);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(real)) {
      copyResolved(path.join(real, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(real, dest);
  }
}

// Walk a directory tree and resolve any symlinks found.
// Non-symlink entries are left untouched.
function resolveSymlinksInPlace(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      let target;
      try {
        target = fs.realpathSync(fullPath);
      } catch {
        // Dead symlink — remove it so it doesn't cause errors at runtime.
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`[afterPack] removed dead symlink ${fullPath}`);
        continue;
      }
      fs.rmSync(fullPath, { recursive: true, force: true });
      try {
        copyResolved(target, fullPath);
        console.log(`[afterPack] resolved symlink ${entry.name}`);
      } catch (e) {
        console.warn(`[afterPack] could not resolve ${entry.name}: ${e.message}`);
      }
    } else if (entry.isDirectory()) {
      resolveSymlinksInPlace(fullPath);
    }
  }
}

module.exports = async function afterPack({ appOutDir }) {
  const resourcesDir = path.join(appOutDir, "resources");
  const backendDir = path.join(resourcesDir, "backend");
  const frontendDir = path.join(resourcesDir, "frontend");
  const nextDir = path.join(frontendDir, ".next");
  const standaloneDir = path.join(nextDir, "standalone");
  const standaloneFrontend = path.join(standaloneDir, "frontend");

  // ── Backend: resolve bun symlinks in node_modules ─────────────────────────
  const backendModules = path.join(backendDir, "node_modules");
  if (fs.existsSync(backendModules)) {
    console.log("[afterPack] resolving backend node_modules symlinks...");
    resolveSymlinksInPlace(backendModules);
  }

  // ── Frontend standalone: resolve symlinks in both node_modules trees ───────
  // There are two: standalone/node_modules and standalone/frontend/node_modules
  const standaloneModules = path.join(standaloneDir, "node_modules");
  if (fs.existsSync(standaloneModules)) {
    console.log("[afterPack] resolving standalone/node_modules symlinks...");
    resolveSymlinksInPlace(standaloneModules);
  }

  const standaloneFrontendModules = path.join(standaloneFrontend, "node_modules");
  if (fs.existsSync(standaloneFrontendModules)) {
    console.log("[afterPack] resolving standalone/frontend/node_modules symlinks...");
    resolveSymlinksInPlace(standaloneFrontendModules);
  }

  // ── Remove leftover .bun dirs (now empty/unneeded) ────────────────────────
  for (const bunDir of [
    path.join(standaloneDir, "node_modules", ".bun"),
    path.join(standaloneFrontendModules, ".bun"),
  ]) {
    if (fs.existsSync(bunDir)) {
      fs.rmSync(bunDir, { recursive: true, force: true });
      console.log(`[afterPack] removed ${bunDir}`);
    }
  }

  // ── Copy .next/static → standalone/frontend/.next/static ─────────────────
  const staticSrc = path.join(nextDir, "static");
  const staticDest = path.join(standaloneFrontend, ".next", "static");
  if (fs.existsSync(staticSrc) && !fs.existsSync(staticDest)) {
    copyResolved(staticSrc, staticDest);
    console.log(`[afterPack] copied .next/static → ${staticDest}`);
  }

  // ── Copy public/ → standalone/frontend/public ─────────────────────────────
  const publicSrc = path.join(frontendDir, "public");
  const publicDest = path.join(standaloneFrontend, "public");
  if (fs.existsSync(publicSrc) && !fs.existsSync(publicDest)) {
    copyResolved(publicSrc, publicDest);
    console.log(`[afterPack] copied public → ${publicDest}`);
  }

  console.log("[afterPack] done.");
};
