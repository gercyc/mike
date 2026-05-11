// Wave 3: self-signed cert generation for the local HTTPS listener.
//
// Office add-ins require HTTPS, so we run a second listener on port 3002
// using a cert generated at first launch into `~/.mike/cert/`. We shell
// out to `openssl` (present on macOS / most Linux distros) instead of
// taking on a Node-side cert library — keeps deps light, and the cert is
// only ever trusted by the user's own machine.
//
// On Windows where `openssl` may be missing we surface a clear error;
// the user can install Git for Windows (which ships openssl) or the
// LibreSSL/OpenSSL binary and re-launch.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CERT_DIR = path.join(os.homedir(), ".mike", "cert");
const KEY_PATH = path.join(CERT_DIR, "server.key");
const CRT_PATH = path.join(CERT_DIR, "server.crt");

// Microsoft's `office-addin-dev-certs` package installs a CA + leaf cert at
// this fixed location and adds the CA to Word for Mac's sandbox trust store.
// Our own self-signed cert is NOT trusted by Word's sandbox even when added
// to the System keychain, so when these files are present we prefer them —
// Word's task pane (WKWebView) will load the add-in and its API calls
// without the "Load failed" error.
const OFFICE_CERT_DIR = path.join(os.homedir(), ".office-addin-dev-certs");
const OFFICE_KEY_PATH = path.join(OFFICE_CERT_DIR, "localhost.key");
const OFFICE_CRT_PATH = path.join(OFFICE_CERT_DIR, "localhost.crt");

function tryOfficeAddinCert(): CertPair | null {
  try {
    if (fs.existsSync(OFFICE_KEY_PATH) && fs.existsSync(OFFICE_CRT_PATH)) {
      return {
        key: fs.readFileSync(OFFICE_KEY_PATH),
        cert: fs.readFileSync(OFFICE_CRT_PATH),
        keyPath: OFFICE_KEY_PATH,
        certPath: OFFICE_CRT_PATH,
      };
    }
  } catch {
    /* fall through to self-signed */
  }
  return null;
}

export interface CertPair {
  key: Buffer;
  cert: Buffer;
  keyPath: string;
  certPath: string;
}

function ensureDir(): void {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true, mode: 0o700 });
  }
}

function hasFiles(): boolean {
  return fs.existsSync(KEY_PATH) && fs.existsSync(CRT_PATH);
}

function generateWithOpenssl(): void {
  ensureDir();
  // Single-shot command: 2048-bit RSA, valid 10 years, SAN covers
  // localhost + 127.0.0.1 so browsers / Office accept the loopback host.
  const subj = "/C=US/ST=Local/L=Local/O=Mike/OU=Local/CN=localhost";
  const ext =
    "subjectAltName=DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1,IP:::1";
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-nodes",
      "-newkey",
      "rsa:2048",
      "-keyout",
      KEY_PATH,
      "-out",
      CRT_PATH,
      "-days",
      "3650",
      "-subj",
      subj,
      "-addext",
      ext,
    ],
    { stdio: "ignore" },
  );
  fs.chmodSync(KEY_PATH, 0o600);
}

/**
 * Returns the loopback HTTPS cert pair, generating one if missing.
 * Returns `null` if openssl is unavailable — caller should skip the HTTPS
 * listener and log a warning.
 */
export function getOrCreateLoopbackCert(): CertPair | null {
  // Prefer Microsoft's office-addin-dev-certs when present — they're the
  // only cert Word for Mac's sandbox trusts out of the box.
  const officeCert = tryOfficeAddinCert();
  if (officeCert) {
    console.log(
      `[cert] Using office-addin-dev-certs at ${OFFICE_CERT_DIR} (Word-compatible).`,
    );
    return officeCert;
  }
  try {
    if (!hasFiles()) {
      generateWithOpenssl();
    }
    console.log(
      `[cert] Using self-signed cert at ${CERT_DIR}. Note: the Word add-in will fail to load until you install office-addin-dev-certs (run \`cd word-addin && bun run install-certs\`).`,
    );
    return {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CRT_PATH),
      keyPath: KEY_PATH,
      certPath: CRT_PATH,
    };
  } catch (err) {
    console.warn(
      `[cert] Could not provision loopback HTTPS cert (${(err as Error).message}). HTTPS listener will be skipped.`,
    );
    return null;
  }
}
