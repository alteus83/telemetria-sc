// Ponte sicuro tra la schermata e l'app: espone solo l'apertura delle Impostazioni.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("telemetriaApp", {
  apriImpostazioni: () => ipcRenderer.invoke("impostazioni:apri"),
});
