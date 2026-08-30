// Self-updater. Downloads the latest GitHub release and swaps the app bundle in
// place, so the user never re-installs and their data (which lives in userData,
// separate from the .app) is never touched.
//
//   macOS  — download .dmg, mount, copy the .app out, then on quit a detached
//            script waits for us to exit, replaces the bundle, relaunches.
//   Windows — download the NSIS .exe and run it; it upgrades in place.

const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const REPO = "awpehz/gas-portfolio-tracker";
const IS_MAC = process.platform === "darwin";
const IS_WIN = process.platform === "win32";

function verParts(v) { return String(v).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0); }
function isNewer(remote, local) {
  const a = verParts(remote), b = verParts(local);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

async function checkUpdate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "gas-portfolio-tracker", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { newer: false };
    const j = await res.json();
    if (!j || !j.tag_name) return { newer: false };
    const wantExt = IS_MAC ? ".dmg" : IS_WIN ? ".exe" : null;
    const asset = wantExt && (j.assets || []).find((a) => a.name.toLowerCase().endsWith(wantExt));
    return {
      newer: isNewer(j.tag_name, app.getVersion()),
      tag: j.tag_name,
      url: j.html_url,
      notes: (j.body || "").slice(0, 4000),
      asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null,
      canSelfUpdate: !!(asset && app.isPackaged),
    };
  } catch {
    return { newer: false };
  }
}

let staged = null; // { dir, path, kind: "app" | "exe" }

async function downloadUpdate(onProgress) {
  const info = await checkUpdate();
  if (!info.asset) return { ok: false, error: "No installer for this platform in the latest release." };
  if (!app.isPackaged) return { ok: false, error: "Self-update only works in the installed app." };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpt-update-"));
  const dlPath = path.join(dir, info.asset.name);

  try {
    const res = await fetch(info.asset.url, { headers: { "User-Agent": "gas-portfolio-tracker" } });
    if (!res.ok || !res.body) return { ok: false, error: `Download failed (${res.status}).` };
    const total = Number(res.headers.get("content-length")) || info.asset.size || 0;
    let got = 0;
    const out = fs.createWriteStream(dlPath);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.write(Buffer.from(value));
      got += value.length;
      if (total && onProgress) onProgress(got / total);
    }
    out.end();
    await new Promise((r, j) => { out.on("close", r); out.on("error", j); });

    if (IS_MAC) {
      const mount = await sh("hdiutil", ["attach", dlPath, "-nobrowse", "-noautoopen"]);
      const m = mount.match(/\/Volumes\/[^\r\n]+/);
      if (!m) return { ok: false, error: "Could not mount the update image." };
      const vol = m[0].trim();
      try {
        const appName = fs.readdirSync(vol).find((n) => n.endsWith(".app"));
        if (!appName) return { ok: false, error: "No app found in the update image." };
        const stagedApp = path.join(dir, appName);
        await sh("cp", ["-R", path.join(vol, appName), stagedApp]);
        staged = { dir, path: stagedApp, kind: "app" };
      } finally {
        await sh("hdiutil", ["detach", vol, "-quiet"]).catch(() => {});
      }
    } else {
      staged = { dir, path: dlPath, kind: "exe" };
    }
    return { ok: true, tag: info.tag };
  } catch (e) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    return { ok: false, error: String(e && e.message || e) };
  }
}

function installUpdate() {
  if (!staged) return { ok: false, error: "Nothing downloaded yet." };

  if (staged.kind === "app") {
    const bundle = path.resolve(process.execPath, "..", "..", ".."); // .../X.app/Contents/MacOS/exe -> .../X.app
    const script = path.join(staged.dir, "swap.sh");
    // Copy the new bundle in beside the old one FIRST (the step that can fail),
    // then a fast same-volume mv does the actual swap — the running app is never
    // left deleted if the copy fails.
    fs.writeFileSync(script, [
      "#!/bin/bash",
      `DEST=${q(bundle)}`,
      `NEW=${q(staged.path)}`,
      'STAGE="${DEST}.update-$$"',
      `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.4; done`,
      "sleep 0.5",
      'rm -rf "$STAGE"',
      'cp -R "$NEW" "$STAGE" || exit 1',
      'rm -rf "$DEST"',
      'mv "$STAGE" "$DEST" || cp -R "$NEW" "$DEST"',
      'xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true',
      'open "$DEST"',
      `rm -rf ${q(staged.dir)}`,
      "",
    ].join("\n"));
    fs.chmodSync(script, 0o755);
    spawn("/bin/bash", [script], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn(staged.path, [], { detached: true, stdio: "ignore" }).unref(); // NSIS upgrades in place
  }
  setTimeout(() => app.quit(), 200);
  return { ok: true };
}

function q(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function sh(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || `${cmd} exited ${code}`))));
  });
}

module.exports = { checkUpdate, downloadUpdate, installUpdate };
