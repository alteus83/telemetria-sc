// Aggiornamenti automatici: l'app controlla la pagina Releases di GitHub,
// scarica da sola la nuova versione e la installa con un clic (o alla chiusura).

import { app, Notification } from "electron";
import updater from "electron-updater";

const { autoUpdater } = updater;
const OGNI_QUANTO = 4 * 60 * 60 * 1000; // ogni 4 ore

export function creaAggiornamenti({ scrivi, onCambio, primaDiInstallare, testi }) {
  const stato = {
    fase: app.isPackaged ? "inattivo" : "non-disponibile", // in sviluppo non si aggiorna
    versione: null, // versione nuova trovata
    percento: null,
    errore: null,
    ultimoControllo: null,
  };

  const cambia = (modifiche) => {
    Object.assign(stato, modifiche);
    onCambio?.(stato);
  };

  if (!app.isPackaged) {
    return { stato, controlla: async () => stato, installa: () => {} };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // se non clicchi, si installa quando chiudi l'app
  autoUpdater.logger = { info: scrivi, warn: scrivi, error: scrivi, debug: () => {} };

  autoUpdater.on("checking-for-update", () => cambia({ fase: "controllo", errore: null }));
  autoUpdater.on("update-not-available", () => cambia({ fase: "aggiornato", ultimoControllo: Date.now() }));
  autoUpdater.on("update-available", (info) =>
    cambia({ fase: "scaricamento", versione: info.version, percento: 0, ultimoControllo: Date.now() })
  );
  autoUpdater.on("download-progress", (p) => cambia({ fase: "scaricamento", percento: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (info) => {
    cambia({ fase: "pronto", versione: info.version, percento: 100 });
    if (Notification.isSupported()) {
      const T = testi();
      const n = new Notification({ title: T.aggProntoTitolo, body: T.aggProntoTesto(info.version) });
      n.on("click", () => installa());
      n.show();
    }
  });
  autoUpdater.on("error", (e) => cambia({ fase: "errore", errore: String(e?.message ?? e).split("\n")[0] }));

  async function controlla() {
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      cambia({ fase: "errore", errore: String(e?.message ?? e).split("\n")[0] });
    }
    return stato;
  }

  function installa() {
    if (stato.fase !== "pronto") return;
    scrivi(`Installo l'aggiornamento ${stato.versione}`);
    primaDiInstallare?.();
    // true, true = installazione silenziosa e riavvio dell'app alla fine
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  }

  setTimeout(controlla, 15_000); // primo controllo poco dopo l'avvio
  setInterval(controlla, OGNI_QUANTO);

  return { stato, controlla, installa };
}
