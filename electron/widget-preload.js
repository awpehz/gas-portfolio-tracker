const { contextBridge, ipcRenderer } = require("electron");

// Display-only widget: it just receives status to paint.
contextBridge.exposeInMainWorld("wapi", {
  onData: (cb) => ipcRenderer.on("widget:data", (_e, s) => cb(s)),
  platform: process.platform,
});
