// Mike desktop shell.
//
// Spawns the backend and the Next.js frontend, then
// loads http://127.0.0.1:3000 in a BrowserWindow. Keeps stdout/stderr in
// per-process ring buffers exposed via the Mike menu, and tears every child
// down cleanly on quit.

const { app, BrowserWindow, Menu, shell, dialog, clipboard, nativeImage } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");

const REPO_ROOT = path.resolve(__dirname, "..");
// Prefer the squircle-masked variant (transparent rounded corners) when
// `bun run make-icons` has been run — that's what gives the dock icon the
// soft-corner look that matches every other macOS app. Falls back to the
// raw icon.png for first-launch / dev cases.
const ROUNDED_ICON_PATH = path.join(__dirname, "build", "icon.rounded.png");
const RAW_ICON_PATH = path.join(__dirname, "icon.png");
const ICON_PATH = fs.existsSync(ROUNDED_ICON_PATH)
  ? ROUNDED_ICON_PATH
  : RAW_ICON_PATH;
const HAS_ICON = fs.existsSync(ICON_PATH);

// On macOS, override the dock icon so the running app shows the Mike logo
// instead of the default Electron Helper icon. Has to happen after `app`
// loads but before any windows open.
function applyDockIcon() {
  if (process.platform === "darwin" && HAS_ICON && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(ICON_PATH));
    } catch (e) {
      console.warn("[icon] failed to set dock icon:", e.message);
    }
  }
}
const BACKEND_DIR = path.join(REPO_ROOT, "backend");
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");
const MIKE_HOME = path.join(os.homedir(), ".mike");

const IS_DEV = process.env.MIKE_DEV === "1";
const HTTP_PORT = Number(process.env.PORT || 3001);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 3000);
const PROTOCOL = "mike";

// `mike://...` URLs are routed by macOS to Mike via `open-url`, and on
// Windows/Linux they arrive as a string in `process.argv` of the
// second-instance event. `pendingDeepLink` buffers URLs received before the
// BrowserWindow exists so we can navigate to them once boot finishes.
let pendingDeepLink = null;

function mikeUrlToFrontendUrl(rawUrl) {
  try {
    // mike://projects/<id>  →  /projects/<id>
    // mike://tabular-reviews/<id>  →  /tabular-reviews/<id>
    // mike://assistant/chat/<id> → /assistant/chat/<id>
    const u = new URL(rawUrl);
    if (u.protocol !== `${PROTOCOL}:`) return null;
    // For `mike://projects/abc`, `u.hostname === "projects"`, `u.pathname === "/abc"`.
    const head = u.hostname || "";
    const tail = (u.pathname || "").replace(/^\/+/, "");
    const search = u.search || "";
    const route = tail ? `/${head}/${tail}` : `/${head}`;
    return `http://127.0.0.1:${FRONTEND_PORT}${route}${search}`;
  } catch {
    return null;
  }
}

function handleDeepLink(rawUrl) {
  const target = mikeUrlToFrontendUrl(rawUrl);
  if (!target) return;
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    pendingDeepLink = target;
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.loadURL(target);
}

const children = [];
const logs = { backend: [], frontend: [] };
const LOG_LIMIT = 500;

function pushLog(name, line) {
  const bucket = logs[name];
  if (!bucket) return;
  bucket.push(line);
  if (bucket.length > LOG_LIMIT) bucket.shift();
}

function spawnService(name, cmd, args, opts = {}) {
  const proc = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    ...opts,
  });
  proc.stdout?.on("data", (d) => {
    const s = d.toString();
    process.stdout.write(`[${name}] ${s}`);
    s.split(/\r?\n/).forEach((line) => line && pushLog(name, line));
  });
  proc.stderr?.on("data", (d) => {
    const s = d.toString();
    process.stderr.write(`[${name}] ${s}`);
    s.split(/\r?\n/).forEach((line) => line && pushLog(name, line));
  });
  proc.on("exit", (code, signal) => {
    pushLog(name, `[exit] code=${code} signal=${signal}`);
    console.log(`[${name}] exited code=${code} signal=${signal}`);
  });
  proc.on("error", (err) => {
    pushLog(name, `[error] ${err.message}`);
    console.warn(`[${name}] failed to spawn:`, err.message);
  });
  children.push({ name, proc });
  return proc;
}

function resolveBin(dir, name) {
  const base = path.join(dir, "node_modules", ".bin", name);
  // On Windows, bun installs .exe wrappers; on Unix, plain binaries.
  const candidates = [base, `${base}.exe`, `${base}.cmd`];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function startBackend() {
  const tsxBin = resolveBin(BACKEND_DIR, "tsx");
  const cmd = tsxBin || "npx";
  const args = tsxBin ? ["src/index.ts"] : ["tsx", "src/index.ts"];
  return spawnService("backend", cmd, args, {
    cwd: BACKEND_DIR,
    env: { ...process.env, NODE_ENV: IS_DEV ? "development" : "production" },
  });
}

function startFrontend() {
  const nextBin = resolveBin(FRONTEND_DIR, "next");
  const cmd = nextBin || "npx";
  const args = nextBin
    ? IS_DEV
      ? ["dev", "--port", String(FRONTEND_PORT)]
      : ["start", "--port", String(FRONTEND_PORT)]
    : IS_DEV
      ? ["next", "dev", "--port", String(FRONTEND_PORT)]
      : ["next", "start", "--port", String(FRONTEND_PORT)];
  return spawnService("frontend", cmd, args, {
    cwd: FRONTEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: IS_DEV ? "development" : "production",
      NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${HTTP_PORT}`,
    },
  });
}

function fetchOk(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, { timeout: timeoutMs, rejectUnauthorized: false }, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitFor(url, label, totalMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < totalMs) {
    if (await fetchOk(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn(`[boot] ${label} did not respond at ${url} within ${totalMs}ms`);
  return false;
}

function openLogsWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    title: "Mike — Service Logs",
    webPreferences: { contextIsolation: true },
  });
  const html = `
<!doctype html>
<html><head><meta charset="utf-8"><title>Mike Logs</title>
<style>
  body { background:#0b0b0b; color:#d8d8d8; font:12px/1.4 ui-monospace,Menlo,monospace; margin:0; padding:0; }
  nav { display:flex; gap:8px; padding:8px 12px; background:#161616; border-bottom:1px solid #2a2a2a; }
  nav button { background:#1f1f1f; color:#ccc; border:1px solid #333; padding:4px 10px; cursor:pointer; }
  nav button.active { background:#2a3b5a; color:#fff; }
  pre { padding:12px; margin:0; white-space:pre-wrap; word-break:break-all; }
</style></head>
<body>
  <nav>
    <button data-tab="backend" class="active">Backend</button>
    <button data-tab="frontend">Frontend</button>
    <span style="margin-left:auto;color:#888">refreshes every 1s</span>
  </nav>
  <pre id="out"></pre>
  <script>
    const logs = ${JSON.stringify(logs)};
    let active = "backend";
    const out = document.getElementById("out");
    const buttons = document.querySelectorAll("nav button");
    buttons.forEach(b => b.addEventListener("click", () => {
      active = b.dataset.tab;
      buttons.forEach(x => x.classList.toggle("active", x === b));
      render();
    }));
    function render() {
      out.textContent = (logs[active] || []).join("\\n");
      window.scrollTo(0, document.body.scrollHeight);
    }
    setInterval(() => fetch("about:blank").catch(()=>{}), 9999); // keep-alive noop
    setInterval(render, 1000);
    render();
  </script>
</body></html>`;
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  // Reload the data (logs is a snapshot at the time the HTML was generated).
  // Easier: just keep opening a fresh window each time — logs ring buffer is
  // small, so it's cheap.
  setInterval(() => {
    if (win.isDestroyed()) return;
    win.webContents.executeJavaScript(
      `Object.assign(logs, ${JSON.stringify(logs)}); render();`,
    ).catch(() => {});
  }, 1000);
}

async function showPairingCode() {
  // Caller must already be authenticated in the desktop. We don't have the
  // session token here in main, so we proxy through the renderer: the
  // renderer can fetch /auth/pair/create with its localStorage token and
  // pass the code back. Simpler path for now: tell the user to do it via
  // the in-app menu (a future iteration). For Wave 3 the desktop menu
  // surfaces the request to the renderer via a URL the user clicks.
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const t = localStorage.getItem("mike.token");
      if (!t) return { error: "Sign in to Mike first." };
      try {
        const r = await fetch("http://127.0.0.1:${HTTP_PORT}/auth/pair/create", {
          method: "POST",
          headers: { "Authorization": "Bearer " + t, "Content-Type": "application/json" },
        });
        if (!r.ok) return { error: "Pair request failed: " + r.status };
        return await r.json();
      } catch (e) { return { error: String(e) }; }
    })()
  `);
  if (result?.error) {
    dialog.showErrorBox("Pair Word Add-in", result.error);
    return;
  }
  const code = result?.code;
  const ttl = result?.expiresInSeconds ?? 60;
  const choice = await dialog.showMessageBox(win, {
    type: "info",
    title: "Pair Word Add-in",
    message: `Pairing code: ${code}`,
    detail: `Open Mike inside Word and click "I have a pairing code" on the login screen.\n\nThis code expires in ${ttl} seconds.`,
    buttons: ["Copy code", "Close"],
    defaultId: 0,
  });
  if (choice.response === 0) clipboard.writeText(code);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }]
      : []),
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      label: "Mike",
      submenu: [
        {
          label: "Open Storage Folder",
          click: () => shell.openPath(MIKE_HOME),
        },
        { label: "View Service Logs", click: () => openLogsWindow() },
        {
          label: "Pair Word Add-in…",
          click: () => showPairingCode(),
        },
        { type: "separator" },
        {
          label: "Restart Services",
          click: async () => {
            await teardown();
            await boot();
            const w = BrowserWindow.getAllWindows()[0];
            if (w) w.reload();
          },
        },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Mike on GitHub",
          click: () => shell.openExternal("https://github.com/"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function killProc(name, proc, force = false) {
  if (proc.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      // taskkill /F kills the whole process tree (/T) forcefully — required on
      // Windows because SIGTERM/SIGKILL are not reliably delivered to child
      // processes spawned by Node.js.
      require("node:child_process").execSync(
        `taskkill /F /T /PID ${proc.pid}`,
        { stdio: "ignore" },
      );
    } else {
      proc.kill(force ? "SIGKILL" : "SIGTERM");
    }
  } catch (e) {
    console.warn(`[teardown] kill(${force ? "force" : "term"}) ${name}:`, e.message);
  }
}

async function teardown() {
  for (const { name, proc } of children) {
    killProc(name, proc, false);
  }
  // Give them up to 5s to exit cleanly (Unix only — Windows is already forced).
  if (process.platform !== "win32") {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (children.every(({ proc }) => proc.exitCode !== null)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    for (const { name, proc } of children) {
      killProc(name, proc, true);
    }
  }
  children.length = 0;
}

async function boot() {
  fs.mkdirSync(MIKE_HOME, { recursive: true });
  startBackend();
  startFrontend();
  await waitFor(`http://127.0.0.1:${HTTP_PORT}/health`, "backend");
  await waitFor(`http://127.0.0.1:${FRONTEND_PORT}/`, "frontend", 60000);
}

// ---------------------------------------------------------------------------
// SSE subscriber: listens for desktop.navigate events so the Word add-in's
// "Open in desktop" link focuses this window and routes the renderer to
// the requested page. We connect over plain HTTP loopback with the
// `x-mike-loopback: 1` bypass header so we don't need a session token.
// Reconnects on disconnect with a small backoff.
// ---------------------------------------------------------------------------
function startDesktopBridge() {
  let stopped = false;
  let backoffMs = 1000;
  let controller = null;

  const connect = async () => {
    if (stopped) return;
    controller = new AbortController();
    try {
      const res = await fetch(`http://127.0.0.1:${HTTP_PORT}/events`, {
        headers: {
          "x-mike-loopback": "1",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      backoffMs = 1000; // reset on success
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            if (evt?.type === "desktop.navigate" && typeof evt.route === "string") {
              handleDesktopNavigate(evt.route);
            }
          } catch {
            /* ignore non-JSON frames (keepalives) */
          }
        }
      }
    } catch (err) {
      if (!stopped) {
        console.warn(
          `[bridge] /events disconnected: ${err.message ?? err}. retrying in ${backoffMs}ms`,
        );
      }
    } finally {
      controller = null;
    }
    if (!stopped) {
      setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 15000);
    }
  };

  connect();
  return () => {
    stopped = true;
    if (controller) {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    }
  };
}

function handleDesktopNavigate(route) {
  const target = `http://127.0.0.1:${FRONTEND_PORT}${route}`;
  let win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    win = createWindow();
  }
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
  // macOS: pull the whole app to the foreground (above Word).
  if (process.platform === "darwin" && app.dock) {
    try {
      app.focus({ steal: true });
    } catch {
      /* ignore */
    }
  }
  win.loadURL(target);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Mike",
    icon: HAS_ICON ? ICON_PATH : undefined,
    webPreferences: {
      contextIsolation: true,
      // Self-signed cert handler set per-session below.
    },
  });
  // Trust our own self-signed cert for the loopback HTTPS listener so the
  // renderer can make API calls there without a warning. Loopback only.
  win.webContents.session.setCertificateVerifyProc((req, cb) => {
    if (req.hostname === "127.0.0.1" || req.hostname === "localhost") {
      cb(0);
    } else {
      cb(-3); // use Chromium's default verification
    }
  });
  win.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);
  return win;
}

// Register `mike://` as a protocol Mike handles. On macOS this needs to run
// before `app.whenReady()`. In dev mode (running via `electron .`) we have to
// pass argv[1] (the electron entry) so the OS uses *this* electron binary
// to launch the URL. When packaged, the .app's Info.plist owns the binding.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// On Windows/Linux a cold-start launched by `mike://...` puts the URL in argv.
const initialDeepLink =
  process.argv.find((a) => a && a.startsWith(`${PROTOCOL}://`)) || null;
if (initialDeepLink) pendingDeepLink = initialDeepLink;

// macOS deep-link event — fires both at launch (cold) and while running (warm).
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    // Windows/Linux: a second `mike://...` invocation lands here; the URL is
    // in argv. We don't get a window yet on first launch via deep link, but
    // by the time second-instance fires we always have one.
    const url = argv.find((a) => a && a.startsWith(`${PROTOCOL}://`));
    if (url) {
      handleDeepLink(url);
      return;
    }
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    applyDockIcon();
    buildMenu();
    await boot();
    createWindow();
    // If a deep link arrived before the window existed, navigate now.
    if (pendingDeepLink) {
      const target = pendingDeepLink;
      pendingDeepLink = null;
      handleDeepLink(target);
    }
    // Subscribe to the backend's SSE bus so Open-in-desktop jumps from
    // the Word add-in route the renderer correctly.
    startDesktopBridge();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", async (e) => {
    if (children.length === 0) return;
    e.preventDefault();
    await teardown();
    app.exit(0);
  });
}
