const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const DATA_FILE = path.join(app.getPath("userData"), "gaslog-data.json");

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

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 384,
    height: 620,
    minWidth: 340,
    minHeight: 420,
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

ipcMain.handle("export-pdf", async (_e, html) => {
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  await pdfWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  const pdf = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4",
    margins: { marginType: "custom", top: 0.5, bottom: 0.5, left: 0.55, right: 0.55 },
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
