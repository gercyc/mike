// Prepare source directories for electron-builder packaging.
//
// Bun installs packages as symlinks pointing to a shared .bun cache.
// This script replaces every symlink in node_modules with a real copy,
// recursively, so electron-builder can include the files without needing
// the .bun cache at the destination.
//
// Run BEFORE `npm run dist`:
//   node scripts/prepare-dist.js
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const NEXT_DIR = path.join(FRONTEND_DIR, ".next");
const STANDALONE_FRONTEND = path.join(NEXT_DIR, "standalone", "frontend");
const STANDALONE_MODULES = path.join(STANDALONE_FRONTEND, "node_modules");

// ─── helpers ────────────────────────────────────────────────────────────────

// Deep-copy src (resolving its real path) into dest.
function copyReal(src, dest) {
  let real;
  try {
    real = fs.realpathSync(src);
  } catch {
    return; // dead symlink — skip
  }
  const stat = fs.statSync(real);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(real)) {
      copyReal(path.join(real, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(real, dest);
  }
}

// Walk dir. For every symlink, replace it with the real content.
// Then recurse into subdirectories (to catch nested node_modules).
function resolveSymlinks(dir) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      let real;
      try { real = fs.realpathSync(full); } catch {
        try { fs.rmSync(full, { recursive: true, force: true }); } catch {}
        continue;
      }
      try { fs.rmSync(full, { recursive: true, force: true }); } catch {}
      try {
        copyReal(real, full);
      } catch (e) {
        process.stderr.write(`  [warn] ${entry.name}: ${e.message}\n`);
      }
      // Recurse into the newly materialised directory
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        resolveSymlinks(full);
      }
    } else if (entry.isDirectory() && entry.name !== ".cache" && entry.name !== ".bun") {
      resolveSymlinks(full);
    }
  }
}

// Copy packages from the monorepo root node_modules into dest that are not
// already present. Bun hoists transitive deps to the root, so the backend
// can resolve them at dev time but not after packaging.
function hoistRootDepsInto(dest) {
  const rootNm = path.join(ROOT, "node_modules");
  if (!fs.existsSync(rootNm)) return;
  const bunDir = path.join(rootNm, ".bun");
  let copied = 0;
  for (const entry of fs.readdirSync(rootNm, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue; // skip .bun, .cache, etc.
    const src = path.join(rootNm, entry.name);
    const dst = path.join(dest, entry.name);
    if (fs.existsSync(dst)) continue; // already present — skip
    try {
      copyReal(src, dst);
      copied++;
    } catch (e) {
      process.stderr.write(`  [warn] hoist ${entry.name}: ${e.message}\n`);
    }
  }
  if (copied > 0) console.log(`  hoisted ${copied} transitive packages from monorepo root`);
}

// ─── step 1: backend node_modules ───────────────────────────────────────────
function prepareBackend() {
  console.log("[1/4] backend/node_modules — resolving symlinks + hoisting transitives...");
  const nm = path.join(BACKEND_DIR, "node_modules");
  if (!fs.existsSync(nm)) {
    console.log("  [skip] node_modules not found — run bun install first");
    return;
  }
  resolveSymlinks(nm);
  hoistRootDepsInto(nm);

  // @mike/shared is a workspace symlink; replace it with the built dist copy
  const sharedLink = path.join(nm, "@mike", "shared");
  const sharedSrc = path.join(ROOT, "packages", "shared");
  const sharedIsLink = fs.existsSync(sharedLink) && fs.lstatSync(sharedLink).isSymbolicLink();
  if (sharedIsLink || !fs.existsSync(sharedLink)) {
    try { fs.rmSync(sharedLink, { recursive: true, force: true }); } catch {}
    if (fs.existsSync(sharedSrc)) {
      copyReal(sharedSrc, sharedLink);
      console.log("  copied @mike/shared");
    }
  }
  console.log("  backend done.");
}

// ─── step 1b: rebuild native modules for Electron ────────────────────────────
async function rebuildNativeModules() {
  console.log("[1b] rebuilding native modules for Electron...");
  const electronDir = path.join(__dirname, "..");
  const electronPkg = JSON.parse(fs.readFileSync(path.join(electronDir, "package.json"), "utf8"));
  const electronVersion = (electronPkg.devDependencies?.electron || "").replace(/[^\d.]/g, "");
  if (!electronVersion) {
    console.warn("  [warn] could not determine Electron version — skipping rebuild");
    return;
  }

  const rebuildLib = path.join(electronDir, "node_modules", "@electron", "rebuild", "lib", "rebuild.js");
  if (!fs.existsSync(rebuildLib)) {
    console.warn("  [warn] @electron/rebuild not found — skipping");
    return;
  }

  try {
    const { rebuild } = require(rebuildLib);
    await rebuild({
      buildPath: BACKEND_DIR,
      electronVersion,
      arch: "x64",
    });
    console.log("  native modules rebuilt.");
  } catch (e) {
    console.warn(`  [warn] rebuild failed: ${e.message}`);
  }
}

// ─── step 2: frontend standalone node_modules ───────────────────────────────
function prepareStandalone() {
  console.log("[2/4] frontend standalone/node_modules — resolving symlinks...");
  if (!fs.existsSync(STANDALONE_MODULES)) {
    console.log("  [skip] not found — run next build first");
    return;
  }
  resolveSymlinks(STANDALONE_MODULES);

  // @mike/shared workspace link
  const sharedLink = path.join(STANDALONE_MODULES, "@mike", "shared");
  const sharedSrc = path.join(ROOT, "packages", "shared");
  if (fs.existsSync(sharedLink) && fs.lstatSync(sharedLink).isSymbolicLink()) {
    try { fs.rmSync(sharedLink, { recursive: true, force: true }); } catch {}
    if (fs.existsSync(sharedSrc)) copyReal(sharedSrc, sharedLink);
  }

  // @swc/helpers — required by next but often missing from standalone tree
  const swcDest = path.join(STANDALONE_MODULES, "@swc", "helpers");
  if (!fs.existsSync(swcDest)) {
    const bunRoot = path.join(ROOT, "node_modules", ".bun");
    const swcEntry = fs.existsSync(bunRoot)
      ? fs.readdirSync(bunRoot).find((n) => n.startsWith("@swc+helpers@"))
      : null;
    if (swcEntry) {
      const swcSrc = path.join(bunRoot, swcEntry, "node_modules", "@swc", "helpers");
      fs.mkdirSync(path.dirname(swcDest), { recursive: true });
      copyReal(swcSrc, swcDest);
      console.log(`  copied @swc/helpers from ${swcEntry}`);
    } else {
      console.warn("  [warn] @swc/helpers not found in bun cache");
    }
  }
  console.log("  standalone done.");
}

// ─── step 3: static assets ──────────────────────────────────────────────────
function copyStaticAssets() {
  console.log("[3/4] copying static assets...");

  const staticSrc = path.join(NEXT_DIR, "static");
  const staticDest = path.join(STANDALONE_FRONTEND, ".next", "static");
  if (fs.existsSync(staticSrc) && !fs.existsSync(staticDest)) {
    copyReal(staticSrc, staticDest);
    console.log("  copied .next/static");
  }

  const publicSrc = path.join(FRONTEND_DIR, "public");
  const publicDest = path.join(STANDALONE_FRONTEND, "public");
  if (fs.existsSync(publicSrc) && !fs.existsSync(publicDest)) {
    copyReal(publicSrc, publicDest);
    console.log("  copied public/");
  }
}

// ─── step 4: verify ─────────────────────────────────────────────────────────
function verify() {
  console.log("[4/4] verifying...");
  const checks = [
    path.join(BACKEND_DIR, "node_modules", "dotenv"),
    path.join(BACKEND_DIR, "node_modules", "express"),
    path.join(BACKEND_DIR, "node_modules", "body-parser"),
    path.join(STANDALONE_MODULES, "next"),
  ];
  let ok = true;
  for (const p of checks) {
    const exists = fs.existsSync(p);
    const isLink = exists && fs.lstatSync(p).isSymbolicLink();
    const mark = !exists ? "MISSING" : isLink ? "SYMLINK" : "ok";
    console.log(`  [${mark}] ${path.relative(ROOT, p)}`);
    if (!exists || isLink) ok = false;
  }
  if (!ok) {
    console.error("\nSome modules are missing or still symlinks — fix before packaging.");
    process.exit(1);
  }
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== prepare-dist ===\n");
  prepareBackend();
  await rebuildNativeModules();
  prepareStandalone();
  copyStaticAssets();
  verify();
  console.log("\n=== done — now run: npm run dist ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
