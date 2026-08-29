const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const DATA_FILE = path.join(app.getPath("userData"), "gaslog-data.json");
const REPO = "awpehz/gas-portfolio-tracker";

function verParts(v) { return String(v).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0); }
function isNewer(remote, local) {
  const a = verParts(remote), b = verParts(local);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}
async function checkForUpdate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "gas-portfolio-tracker", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { newer: false };
    const j = await res.json();
    if (j && j.tag_name && isNewer(j.tag_name, app.getVersion())) {
      return { newer: true, tag: j.tag_name, url: j.html_url };
    }
  } catch {}
  return { newer: false };
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveData(d) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
}

const BOUNDS_FILE = path.join(app.getPath("userData"), "window-bounds.json");
function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(BOUNDS_FILE, "utf8"));
    if (b && b.width > 300 && b.height > 380) return b;
  } catch {}
  return { width: 520, height: 880 };
}

let win;
function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
    minWidth: 400,
    minHeight: 560,
    resizable: true,
    frame: false,
    transparent: process.platform === "darwin",
    backgroundColor: process.platform === "darwin" ? "#00000000" : "#0e0f13",
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "src", "index.html"));

  const saveBounds = () => {
    try { fs.writeFileSync(BOUNDS_FILE, JSON.stringify(win.getBounds())); } catch {}
  };
  win.on("resize", saveBounds);
  win.on("move", saveBounds);

  const menu = Menu.buildFromTemplate([
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      label: "View",
      submenu: [
        {
          label: "Always on Top",
          type: "checkbox",
          accelerator: "CmdOrCtrl+T",
          click: (item) => win.setAlwaysOnTop(item.checked),
        },
        { role: "reload" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Data",
      submenu: [
        {
          label: "Reveal data file",
          click: () => shell.showItemInFolder(DATA_FILE),
        },
        {
          label: "Reset all data",
          click: () => {
            saveData({});
            win.webContents.send("data-changed", {});
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle("get-data", () => loadData());
ipcMain.handle("set-data", (_e, d) => {
  saveData(d);
  return true;
});
ipcMain.on("win", (_e, cmd) => {
  if (!win) return;
  if (cmd === "close") win.close();
  if (cmd === "min") win.minimize();
  if (cmd === "pin") win.setAlwaysOnTop(!win.isAlwaysOnTop());
});
ipcMain.handle("is-pinned", () => (win ? win.isAlwaysOnTop() : false));
ipcMain.handle("check-update", () => checkForUpdate());
ipcMain.handle("app-version", () => app.getVersion());
ipcMain.on("open-url", (_e, url) => {
  if (/^https:\/\/github\.com\/awpehz\/gas-portfolio-tracker/.test(url)) shell.openExternal(url);
});

ipcMain.handle("export-pdf", async (_e, html) => {
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  await pdfWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  const pdf = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4",
    margins: { marginType: "none" },   // the report's own CSS controls spacing / full-bleed header
  });
  pdfWin.destroy();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Save portfolio report",
    defaultPath: "Gas Portfolio Progress.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, pdf);
  shell.openPath(filePath);
  return { ok: true, filePath };
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
