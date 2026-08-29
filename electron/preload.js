const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getData: () => ipcRenderer.invoke("get-data"),
  setData: (d) => ipcRenderer.invoke("set-data", d),
  isPinned: () => ipcRenderer.invoke("is-pinned"),
  win: (cmd) => ipcRenderer.send("win", cmd),
  onDataChanged: (cb) => ipcRenderer.on("data-changed", (_e, d) => cb(d)),
  exportPdf: (html) => ipcRenderer.invoke("export-pdf", html),
  checkUpdate: () => ipcRenderer.invoke("check-update"),
  appVersion: () => ipcRenderer.invoke("app-version"),
  openUrl: (u) => ipcRenderer.send("open-url", u),
  widget: (on) => ipcRenderer.send("widget-mode", on),
  widgetState: () => ipcRenderer.invoke("widget-state"),
  onWidgetMode: (cb) => ipcRenderer.on("widget-mode", (_e, on) => cb(on)),
});
