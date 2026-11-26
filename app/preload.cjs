// Ponte sicuro tra la finestra Impostazioni e l'app: espone solo queste funzioni.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("telemetria", {
  leggi: () => ipcRenderer.invoke("imp:leggi"),
  salva: (modifiche) => ipcRenderer.invoke("imp:salva", modifiche),
  sfoglia: () => ipcRenderer.invoke("imp:sfoglia"),
  apriSchermata: () => ipcRenderer.invoke("schermata:apri"),
  attivaTelemetria: () => ipcRenderer.invoke("telemetria:attiva"),
  controllaAggiornamenti: () => ipcRenderer.invoke("agg:controlla"),
  installaAggiornamento: () => ipcRenderer.invoke("agg:installa"),
});
