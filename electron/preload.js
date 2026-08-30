const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getData: () => ipcRenderer.invoke("get-data"),
  setData: (d) => ipcRenderer.invoke("set-data", d),
  isPinned: () => ipcRenderer.invoke("is-pinned"),
  win: (cmd) => ipcRenderer.send("win", cmd),
  onDataChanged: (cb) => ipcRenderer.on("data-changed", (_e, d) => cb(d)),
  exportPdf: (html) => ipcRenderer.invoke("export-pdf", html),
  setReminder: (on) => ipcRenderer.send("set-reminder", on),
  reminderState: () => ipcRenderer.invoke("reminder-state"),
  checkUpdate: () => ipcRenderer.invoke("check-update"),
  updateDownload: () => ipcRenderer.invoke("update-download"),
  updateInstall: () => ipcRenderer.invoke("update-install"),
  onUpdateProgress: (cb) => ipcRenderer.on("update-progress", (_e, p) => cb(p)),
  appVersion: () => ipcRenderer.invoke("app-version"),
  openUrl: (u) => ipcRenderer.send("open-url", u),
  widget: (on) => ipcRenderer.send("widget-mode", on),
  widgetState: () => ipcRenderer.invoke("widget-state"),
  onWidgetMode: (cb) => ipcRenderer.on("widget-mode", (_e, on) => cb(on)),
});
