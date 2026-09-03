const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, shell, dialog, Notification, powerMonitor } = require("electron");
const path = require("path");
const fs = require("fs");

const DATA_FILE = path.join(app.getPath("userData"), "gaslog-data.json");
const GasLogic = require(path.join(__dirname, "..", "src", "logic.js"));
const updater = require(path.join(__dirname, "updater.js"));

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
  return { width: 1120, height: 860 };
}

const STATE_FILE = path.join(app.getPath("userData"), "ui-state.json");
function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) || {}; } catch { return {}; } }
function saveState(s) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch {} }

// ---------- desktop widget: a translucent card that lives on the desktop ----------
// On macOS `type: "desktop"` sits it on the wallpaper — behind every window, on
// every Space, never taking focus or a click. All interaction is via the menu-bar
// (tray) icon. The main process keeps it fed with computed status over IPC.
let widgetWin = null;
const WIDGET_MARGIN = 22;
const WIDGET_SIZES = { small: 240, medium: 300, large: 372 };
function widgetSize() {
  const k = loadState().widgetSize;
  return WIDGET_SIZES[k] || WIDGET_SIZES.medium;
}

function widgetStatus() {
  try { return GasLogic.computeStatus(loadData()); } catch { return null; }
}
function pushWidget() {
  if (widgetWin && !widgetWin.isDestroyed()) {
    const s = widgetStatus();
    if (s) widgetWin.webContents.send("widget:data", s);
  }
  refreshTray();
}

function widgetXY(corner) {
  const wa = screen.getPrimaryDisplay().workArea;
  const c = corner || "tr";
  const left = c[1] === "l";
  const top = c[0] === "t";
  const sz = widgetSize();
  return {
    x: Math.round(left ? wa.x + WIDGET_MARGIN : wa.x + wa.width - sz - WIDGET_MARGIN),
    y: Math.round(top ? wa.y + WIDGET_MARGIN : wa.y + wa.height - sz - WIDGET_MARGIN),
  };
}
function positionWidget() {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  const { x, y } = widgetXY(loadState().widgetCorner);
  const sz = widgetSize();
  widgetWin.setBounds({ x, y, width: sz, height: sz });
}

function createWidgetWindow() {
  const mac = process.platform === "darwin";
  const { x, y } = widgetXY(loadState().widgetCorner);
  const sz = widgetSize();
  widgetWin = new BrowserWindow({
    width: sz,
    height: sz,
    x, y,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    roundedCorners: true,
    ...(mac ? { type: "desktop" } : {}),
    ...(process.platform === "win32" ? { backgroundMaterial: "acrylic" } : {}),
    webPreferences: {
      preload: path.join(__dirname, "widget-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  widgetWin.loadFile(path.join(__dirname, "..", "src", "widget.html"));
  if (mac) widgetWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  else widgetWin.setAlwaysOnTop(false);

  widgetWin.webContents.once("did-finish-load", () => {
    pushWidget();
    widgetWin.showInactive();
    positionWidget();
  });
  widgetWin.on("closed", () => { widgetWin = null; refreshTray(); });
}

function showWidget(on) {
  on = !!on;
  if (on) {
    if (!widgetWin || widgetWin.isDestroyed()) createWidgetWindow();
    else { widgetWin.showInactive(); pushWidget(); }
  } else if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.close();
  }
  saveState({ ...loadState(), widget: on });
  if (app.isPackaged) {
    try { app.setLoginItemSettings({ openAtLogin: on, openAsHidden: true }); } catch {}
  }
  const mi = Menu.getApplicationMenu() && Menu.getApplicationMenu().getMenuItemById("widgetToggle");
  if (mi) mi.checked = on;
  if (win && !win.isDestroyed()) win.webContents.send("widget-mode", on);
  refreshTray();
}

// ---------- menu-bar (tray) — the 24/7 control surface ----------
let tray = null;
let isQuitting = false;

function fmtH(n) {
  const r = Math.round((Number(n) || 0) * 10) / 10;
  return (Number.isInteger(r) ? r : r.toFixed(1)) + " h";
}

function quickLog(h) {
  h = Number(h);
  if (!h || h <= 0) return;
  const d = loadData();
  if (!Array.isArray(d.hours)) d.hours = [];
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  d.hours.push({ date: iso, h, note: "" });
  saveData(d);
  if (win && !win.isDestroyed()) win.webContents.send("data-changed", d);
  pushWidget();
}

function showMainWindow() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  if (process.platform === "darwin") app.dock.show();
  win.show();
  win.focus();
}

function refreshTray() {
  if (!tray) return;
  const s = widgetStatus();
  const widgetOn = !!(widgetWin && !widgetWin.isDestroyed());
  const corner = loadState().widgetCorner || "tr";
  if (s) {
    if (process.platform === "darwin") tray.setTitle("  " + fmtH(s.total));
    tray.setToolTip(`Gas Portfolio — ${fmtH(s.total)} of ${s.goal} h logged`);
  }
  const cItem = (id, label) => ({
    label, type: "radio", checked: corner === id,
    click: () => { saveState({ ...loadState(), widgetCorner: id }); positionWidget(); refreshTray(); },
  });
  const curSize = loadState().widgetSize || "medium";
  const sItem = (id, label) => ({
    label, type: "radio", checked: curSize === id,
    click: () => { saveState({ ...loadState(), widgetSize: id }); positionWidget(); refreshTray(); },
  });
  const tpl = [
    ...(s ? [
      { label: `${fmtH(s.total)} of ${s.goal} h logged`, enabled: false },
      { label: s.past275 ? "Past the 275 h pass mark" : `${fmtH(s.toRequired)} to the pass mark`, enabled: false },
      { label: `${fmtH(s.perDayGoal).replace(" h", " h")}/day · ${s.availDays} working days left`, enabled: false },
      { type: "separator" },
    ] : []),
    { label: "Open Gas Portfolio Tracker", click: showMainWindow },
    { label: "Log +2 h now", click: () => quickLog(2) },
    { type: "separator" },
    { label: "Show desktop widget", type: "checkbox", checked: widgetOn, click: (it) => showWidget(it.checked) },
    { label: "Widget position", submenu: [cItem("tl", "Top left"), cItem("tr", "Top right"), cItem("bl", "Bottom left"), cItem("br", "Bottom right")] },
    { label: "Widget size", submenu: [sItem("small", "Small"), sItem("medium", "Medium"), sItem("large", "Large")] },
    { label: "Refresh now", click: () => pushWidget() },
    { type: "separator" },
    {
      label: "Start at login", type: "checkbox",
      checked: (() => { try { return app.getLoginItemSettings().openAtLogin; } catch { return false; } })(),
      click: (it) => { try { app.setLoginItemSettings({ openAtLogin: it.checked, openAsHidden: true }); } catch {} },
    },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(tpl));
}

function createTray() {
  if (tray) return;
  const img = nativeImage.createFromPath(path.join(__dirname, "assets", "trayTemplate.png"));
  img.setTemplateImage(true);
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip("Gas Portfolio Tracker");
  if (process.platform !== "darwin") tray.on("click", () => showMainWindow());
  refreshTray();
}

// ---------- daily "log your jobs" reminder ----------
let reminderTimer = null;

// A recurring calendar event (weekdays 17:30, floating local time) with an alarm.
// Adding it to an iCloud calendar means the alert also fires on the user's phone.
function reminderICS() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(17, 30, 0, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1);
  const p2 = (n) => String(n).padStart(2, "0");
  const local = (dt) => `${dt.getFullYear()}${p2(dt.getMonth() + 1)}${p2(dt.getDate())}T${p2(dt.getHours())}${p2(dt.getMinutes())}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const uid = `gpt-${Date.now()}-${Math.random().toString(36).slice(2)}@gas-portfolio-tracker`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gas Portfolio Tracker//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(new Date(start.getTime() + 15 * 60000))}`,
    "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "SUMMARY:Log gas portfolio jobs & hours",
    "DESCRIPTION:Open Gas Portfolio Tracker and log today's work before you forget.",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Log gas portfolio jobs & hours",
    "TRIGGER:PT0S",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function todayISOm() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function loggedToday() {
  try {
    const d = loadData(), t = todayISOm();
    return (d.hours || []).some((r) => r.date === t) || (d.jobs || []).some((r) => r.date === t);
  } catch { return false; }
}
function scheduleReminder() {
  clearTimeout(reminderTimer);
  reminderTimer = null;
  if (!loadState().remind) return;
  const now = new Date();
  const next = new Date(now);
  next.setHours(17, 30, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1); // weekdays only
  reminderTimer = setTimeout(() => {
    if (loadState().remind && !loggedToday() && Notification.isSupported()) {
      const n = new Notification({
        title: "Gas Portfolio Tracker",
        body: "Log today's jobs and hours before you knock off.",
        silent: false,
      });
      n.on("click", () => showMainWindow());
      n.show();
    }
    scheduleReminder();
  }, Math.max(1000, next - now));
}

let win;
function createWindow(opts = {}) {
  const b = loadBounds();
  win = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
    minWidth: 680,
    minHeight: 600,
    resizable: true,
    show: opts.show !== false,
    frame: false,
    transparent: process.platform === "darwin",
    backgroundColor: process.platform === "darwin" ? "#00000000" : "#0e0f13",
    roundedCorners: true,
    hasShadow: true,
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
  // "Closing" the app just tucks it away — the tray and desktop widget keep running.
  win.on("close", (e) => {
    if (isQuitting) return;
    e.preventDefault();
    win.hide();
    if (process.platform === "darwin") app.dock.hide();
  });

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
        {
          id: "widgetToggle",
          label: "Desktop Widget",
          type: "checkbox",
          accelerator: "CmdOrCtrl+Shift+W",
          click: (item) => showWidget(item.checked),
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
            pushWidget();
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
  pushWidget();
  return true;
});
ipcMain.on("win", (_e, cmd) => {
  if (!win) return;
  if (cmd === "close") win.close();
  if (cmd === "min") win.minimize();
  if (cmd === "pin") win.setAlwaysOnTop(!win.isAlwaysOnTop());
});
ipcMain.handle("is-pinned", () => (win ? win.isAlwaysOnTop() : false));
ipcMain.on("widget-mode", (_e, on) => showWidget(!!on));
ipcMain.handle("widget-state", () => !!(widgetWin && !widgetWin.isDestroyed()));

ipcMain.on("set-reminder", (_e, on) => {
  saveState({ ...loadState(), remind: !!on });
  scheduleReminder();
});
ipcMain.handle("reminder-state", () => !!loadState().remind);
ipcMain.handle("add-calendar-reminder", async () => {
  try {
    const file = path.join(app.getPath("temp"), "gas-portfolio-reminder.ics");
    fs.writeFileSync(file, reminderICS());
    const err = await shell.openPath(file);
    return err ? { ok: false, error: err } : { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});
ipcMain.handle("check-update", () => updater.checkUpdate());
ipcMain.handle("update-download", (e) =>
  updater.downloadUpdate((p) => { try { e.sender.send("update-progress", p); } catch {} }));
ipcMain.handle("update-install", () => updater.installUpdate());
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

// only one copy of the app at a time — otherwise you get a second tray icon and
// a second desktop widget stacked on the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());
}

app.whenReady().then(() => {
  createTray();
  const openedHidden = (() => { try { return app.getLoginItemSettings().wasOpenedAsHidden; } catch { return false; } })();
  createWindow({ show: !openedHidden });
  if (openedHidden && process.platform === "darwin") app.dock.hide();
  if (loadState().widget) showWidget(true);
  setInterval(pushWidget, 30 * 60 * 1000);   // keep the widget + tray current day-to-day
  scheduleReminder();
  powerMonitor.on("resume", scheduleReminder); // re-time after the machine sleeps
});
// Keep running with just the tray + desktop widget when the window is closed.
app.on("window-all-closed", () => {});
app.on("before-quit", () => { isQuitting = true; });
app.on("activate", () => showMainWindow());
