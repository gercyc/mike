// Removes the .bun symlink directory that bun creates inside Next.js standalone.
// These symlinks are broken on Windows and cause 7za to fail with exit code 1.
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack({ appOutDir }) {
  const bunDir = path.join(
    appOutDir,
    "resources",
    "frontend",
    ".next",
    "standalone",
    "node_modules",
    ".bun"
  );
  if (fs.existsSync(bunDir)) {
    fs.rmSync(bunDir, { recursive: true, force: true });
    console.log(`[afterPack] removed ${bunDir}`);
  }
};
