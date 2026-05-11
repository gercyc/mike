#!/usr/bin/env node
// Generate platform icons from electron/icon.png.
//
// Outputs:
//   build/icon.rounded.png  — squircle-masked source, used at runtime
//                              (app.dock.setIcon) and as the basis for the
//                              .icns / .ico / Linux PNG set.
//   build/icon.icns         — macOS bundle icon
//   build/icon.ico          — Windows icon (basic; replace before shipping Windows)
//   build/icons/*.png       — Linux PNG set used by electron-builder
//
// The squircle mask matches macOS's Big Sur+ icon shape: a rounded square
// with corner radius ≈ 22.37% of the bounding box. Without this mask the
// dock shows a sharp-cornered tile.
//
// Run after dropping a new icon.png:  bun run make-icons

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "icon.png");
const BUILD = path.join(ROOT, "build");
const ROUNDED = path.join(BUILD, "icon.rounded.png");
const ICONSET = path.join(BUILD, "icon.iconset");
const ICONS_DIR = path.join(BUILD, "icons");

if (!fs.existsSync(SRC)) {
  console.error(
    `[icons] ${SRC} not found. Drop a square PNG (>=1024x1024) at electron/icon.png and rerun.`,
  );
  process.exit(1);
}

fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(ICONSET, { recursive: true });
fs.mkdirSync(ICONS_DIR, { recursive: true });

// macOS "squircle" — Apple's icon template inset is ~10% of the canvas on
// every side, with the visual filled region using a corner radius of
// 22.37% of the inner square's edge. We approximate by:
//   - padding the source by 10% (gives a transparent margin)
//   - masking the 80%-inset region with a rounded rectangle
const PAD_RATIO = 0.1; // 10% transparent margin
const RADIUS_RATIO = 0.2237; // squircle corner ratio relative to inner box

async function buildRoundedMaster(size = 1024) {
  const meta = await sharp(SRC).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("icon.png has no usable dimensions");
  }
  // Cover-fit the source into a `size×size` square (centered) so any
  // mismatched aspect ratio still ends up square before masking.
  const fitted = await sharp(SRC)
    .resize(size, size, {
      fit: "cover",
      position: "center",
    })
    .png()
    .toBuffer();

  // Compose the rounded mask: shrink the icon to the inner box and
  // overlay onto a transparent canvas.
  const inner = Math.round(size * (1 - 2 * PAD_RATIO));
  const offset = Math.round((size - inner) / 2);
  const radius = Math.round(inner * RADIUS_RATIO);

  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}">
       <rect x="0" y="0" width="${inner}" height="${inner}"
             rx="${radius}" ry="${radius}" fill="#ffffff"/>
     </svg>`,
  );

  const inset = await sharp(fitted)
    .resize(inner, inner)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const canvas = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: inset, left: offset, top: offset }])
    .png()
    .toBuffer();

  fs.writeFileSync(ROUNDED, canvas);
}

function sipsResize(srcPath, dstPath, size) {
  execFileSync(
    "sips",
    ["-z", String(size), String(size), srcPath, "--out", dstPath],
    { stdio: "ignore" },
  );
}

const iconsetSizes = [
  { name: "icon_16x16.png", size: 16 },
  { name: "icon_16x16@2x.png", size: 32 },
  { name: "icon_32x32.png", size: 32 },
  { name: "icon_32x32@2x.png", size: 64 },
  { name: "icon_128x128.png", size: 128 },
  { name: "icon_128x128@2x.png", size: 256 },
  { name: "icon_256x256.png", size: 256 },
  { name: "icon_256x256@2x.png", size: 512 },
  { name: "icon_512x512.png", size: 512 },
  { name: "icon_512x512@2x.png", size: 1024 },
];

(async () => {
  console.log("[icons] building rounded master via sharp");
  await buildRoundedMaster(1024);

  console.log("[icons] generating macOS .icns");
  for (const { name, size } of iconsetSizes) {
    sipsResize(ROUNDED, path.join(ICONSET, name), size);
  }
  execFileSync(
    "iconutil",
    ["-c", "icns", ICONSET, "-o", path.join(BUILD, "icon.icns")],
    { stdio: "ignore" },
  );
  fs.rmSync(ICONSET, { recursive: true, force: true });

  console.log("[icons] generating Linux PNG set");
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
    sipsResize(ROUNDED, path.join(ICONS_DIR, `${size}x${size}.png`), size);
  }

  // Windows: copy the 256×256 PNG. macOS doesn't ship an ico encoder.
  fs.copyFileSync(
    path.join(ICONS_DIR, "256x256.png"),
    path.join(BUILD, "icon.ico"),
  );

  console.log("[icons] done.");
  console.log("  build/icon.rounded.png  (runtime dock icon — squircle-masked)");
  console.log("  build/icon.icns         (macOS)");
  console.log("  build/icon.ico          (Windows — replace before shipping)");
  console.log("  build/icons/            (Linux PNG set)");
})().catch((err) => {
  console.error("[icons] failed:", err);
  process.exit(1);
});
