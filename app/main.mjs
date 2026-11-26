// ============================================================
// Telemetria SC — App per Windows (Electron)
// - Resta come icona vicino all'orologio
// - Si avvia con Windows solo se l'utente lo sceglie nelle Impostazioni
// - Quando parte Star Citizen apre la schermata sul monitor scelto,
//   quando il gioco si chiude la chiude
// ============================================================

import { app, BrowserWindow, Tray, Menu, screen, ipcMain, dialog, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { avviaPonte } from "../ponte/server.mjs";
import { avviaControlloGioco } from "../ponte/processo.mjs";
import { creaArchivio, percorsoGameLog, normalizzaCartella, canaleDaLogRecente } from "./impostazioni.mjs";
import { creaAggiornamenti } from "./aggiornamenti.mjs";
import { statoTelemetriaGioco, attivaTelemetriaGioco } from "./telemetria-gioco.mjs";
import { testi, linguaEffettiva } from "./testi.mjs";

const cartella = path.dirname(fileURLToPath(import.meta.url));
const ICONA = path.join(cartella, "icone", "icona.png");
const ICONA_TRAY = path.join(cartella, "icone", "tray.png");
const ARG_NASCOSTA = "--nascosta"; // usato quando parte con Windows

// ---------------------------------------------------------------------------
// Una sola copia dell'app alla volta
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => apriImpostazioni());
  app.whenReady().then(avvio).catch((e) => {
    dialog.showErrorBox("Telemetria SC", testi(linguaEffettiva("AUTO", app.getLocale())).erroreAvvio(e?.stack ?? e));
    app.exit(1);
  });
}

app.setAppUserModelId("it.telemetriasc.app");
// Teniamo l'app viva anche senza finestre aperte (resta nell'icona).
app.on("window-all-closed", () => {});

let archivio;
let imp;
let ponte;
let gioco = { aperto: null };
let tray = null;
let finestraSchermata = null;
let finestraImpostazioni = null;
let fileRegistro;
let aggiornamenti = { stato: { fase: "non-disponibile" }, controlla: async () => {}, installa: () => {} };

// Registro su file, utile per capire i problemi: %APPDATA%\Telemetria SC\registro.txt
function scrivi(testo) {
  const riga = `[${new Date().toLocaleString("it-IT")}] ${testo}\n`;
  process.stdout.write(riga);
  try {
    fs.appendFileSync(fileRegistro, riga);
  } catch {
    /* nessun problema se non si riesce a scrivere */
  }
}

// Lingua in uso: quella scelta nelle Impostazioni o, con AUTO, quella di Windows.
const lingua = () => linguaEffettiva(imp?.lingua, app.getLocale());
const T = () => testi(lingua());

function configPonte() {
  return {
    lingua: lingua(),
    portaWeb: imp.portaWeb,
    apriInRete: false,
    gameLog: percorsoGameLog(imp),
    versione: imp.versione,
    telemetriaHost: "127.0.0.1",
    telemetriaPorte: imp.versione === "LIVE" ? [2942, 29420, 50051] : [29420, 2942, 50051],
    intervalloPing: 2000,
    aggiornamentiAlSecondo: 10,
  };
}

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------
async function avvio() {
  Menu.setApplicationMenu(null);
  const cartellaDati = app.getPath("userData");
  fs.mkdirSync(cartellaDati, { recursive: true });
  fileRegistro = path.join(cartellaDati, "registro.txt");
  try {
    // Ricomincia a ogni avvio. Il segno iniziale (BOM) fa leggere bene gli accenti anche a PowerShell 5.
    fs.writeFileSync(fileRegistro, "\uFEFF");
  } catch {
    /* ignora */
  }

  archivio = creaArchivio(cartellaDati);
  imp = archivio.leggi();
  scrivi(`Avvio. Cartella gioco: ${imp.cartellaGioco ?? "non trovata"} (${imp.versione})`);

  try {
    ponte = await avviaPonte({ config: configPonte(), giocoAperto: () => gioco.aperto, porteGioco: () => gioco.porte ?? [], scrivi });
  } catch (e) {
    if (e.code !== "EADDRINUSE") throw e;
    // Porta occupata (es. il ponte da terminale è aperto): ne usiamo una libera.
    scrivi(`Porta ${imp.portaWeb} occupata, ne scelgo un'altra`);
    ponte = await avviaPonte({ config: { ...configPonte(), portaWeb: 0 }, giocoAperto: () => gioco.aperto, porteGioco: () => gioco.porte ?? [], scrivi });
  }
  scrivi(`Motore avviato sulla porta ${ponte.porta}`);

  creaTray();
  applicaAvvioConPC();

  aggiornamenti = creaAggiornamenti({
    scrivi: (t) => scrivi(`[aggiornamenti] ${t}`),
    onCambio: () => aggiornaTray(),
    primaDiInstallare: () => ponte?.chiudi(),
    testi: T,
  });

  gioco = avviaControlloGioco(3000, (aperto, info) => {
    scrivi(aperto ? "Star Citizen aperto" : aperto === false ? "Star Citizen chiuso" : "Stato del gioco sconosciuto");
    if (aperto && info) {
      scrivi(`Avviato dalla cartella ${info.cartellaCanale} (canale ${info.canale})`);
      applicaCanaleRilevato(info);
    } else if (aperto) {
      scrivi("Percorso del gioco non leggibile: riconosco LIVE/PTU dal Game.log appena creato");
      cercaCanaleDalLog();
    }
    aggiornaTray();
    if (!imp.aperturaAutomatica) return;
    if (aperto) apriSchermata();
    else if (aperto === false) chiudiSchermata();
  }, (porte) => scrivi(`Porte in ascolto del gioco: ${porte.join(", ") || "nessuna"}`));

  // Aperta a mano (non all'accensione del PC): mostriamo le impostazioni.
  if (!process.argv.includes(ARG_NASCOSTA)) apriImpostazioni();
}

// Riserva: per circa 2 minuti dall'avvio del gioco guarda quale Game.log viene aggiornato.
let timerCanale = null;
function cercaCanaleDalLog() {
  clearInterval(timerCanale);
  let tentativi = 0;
  timerCanale = setInterval(() => {
    tentativi += 1;
    const info = canaleDaLogRecente(imp.cartellaGioco, 90000);
    if (info || tentativi > 24 || gioco.aperto === false) {
      clearInterval(timerCanale);
      if (info) {
        gioco.info = info;
        scrivi(`Canale riconosciuto dal Game.log: ${info.canale}`);
        applicaCanaleRilevato(info);
      } else if (gioco.aperto) {
        scrivi("Non sono riuscito a riconoscere LIVE/PTU: uso l'ultima versione usata");
      }
    }
  }, 5000);
}

// Scelta automatica: usa il canale (LIVE/PTU/...) da cui è partito il gioco.
function applicaCanaleRilevato(info) {
  if (imp.canale !== "AUTO") return;
  if (imp.versione === info.canale && imp.cartellaGioco === info.cartellaGioco) return;
  imp = { ...imp, versione: info.canale, cartellaGioco: info.cartellaGioco };
  archivio.salva(imp);
  scrivi(`Passo automaticamente a ${info.canale}: ${percorsoGameLog(imp)}`);
  ponte.aggiornaConfig(configPonte());
}

// ---------------------------------------------------------------------------
// Icona vicino all'orologio
// ---------------------------------------------------------------------------
function creaTray() {
  const icona = nativeImage.createFromPath(ICONA_TRAY);
  tray = new Tray(icona);
  tray.setToolTip("Telemetria SC");
  tray.on("click", () => apriSchermata());
  aggiornaTray();
}

function aggiornaTray() {
  if (!tray) return;
  const t = T();
  const statoGioco = gioco.aperto === true ? t.giocoAperto : gioco.aperto === false ? t.giocoChiuso : t.giocoSconosciuto;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Telemetria SC", enabled: false },
      { label: statoGioco, enabled: false },
      { type: "separator" },
      { label: t.apriSchermata, click: () => apriSchermata() },
      { label: t.impostazioni, click: () => apriImpostazioni() },
      ...(aggiornamenti.stato.fase === "pronto"
        ? [{ label: t.installaAgg(aggiornamenti.stato.versione), click: () => aggiornamenti.installa() }]
        : []),
      { type: "separator" },
      {
        label: t.esci,
        click: () => {
          ponte?.chiudi();
          // app.quit (non app.exit) permette di installare un aggiornamento già scaricato
          app.quit();
        },
      },
    ])
  );
}

// ---------------------------------------------------------------------------
// Avvio con Windows (solo se scelto)
// ---------------------------------------------------------------------------
function applicaAvvioConPC() {
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  app.setLoginItemSettings({ openAtLogin: !!imp.avvioConPC, args: [ARG_NASCOSTA] });
}

// ---------------------------------------------------------------------------
// Monitor
// ---------------------------------------------------------------------------
function elencoMonitor() {
  const principale = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => {
    const larg = Math.round(d.size.width * d.scaleFactor);
    const alt = Math.round(d.size.height * d.scaleFactor);
    return {
      id: d.id,
      nome: `Monitor ${i + 1}${d.label ? ` (${d.label})` : ""} — ${larg}×${alt}${d.id === principale ? (lingua() === "it" ? " · principale" : " · primary") : ""}`,
      principale: d.id === principale,
    };
  });
}

function monitorScelto() {
  const tutti = screen.getAllDisplays();
  const scelto = tutti.find((d) => d.id === imp.monitorId);
  if (scelto) return scelto;
  // Nessuna scelta: il primo monitor che non è il principale, altrimenti il principale.
  const principale = screen.getPrimaryDisplay();
  return tutti.find((d) => d.id !== principale.id) ?? principale;
}

function posizionaSchermata() {
  if (!finestraSchermata) return;
  const d = monitorScelto();
  if (finestraSchermata.isFullScreen()) finestraSchermata.setFullScreen(false);
  finestraSchermata.setBounds(d.bounds);
  if (imp.schermoIntero) finestraSchermata.setFullScreen(true);
}

// ---------------------------------------------------------------------------
// Finestra della schermata
// ---------------------------------------------------------------------------
function apriSchermata() {
  if (finestraSchermata) {
    finestraSchermata.show();
    finestraSchermata.focus();
    return;
  }
  const d = monitorScelto();
  finestraSchermata = new BrowserWindow({
    ...d.bounds,
    title: "Telemetria SC",
    icon: ICONA,
    backgroundColor: "#06111f",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(cartella, "preload-schermata.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  finestraSchermata.loadURL(`http://127.0.0.1:${ponte.porta}/`);
  finestraSchermata.once("ready-to-show", () => {
    posizionaSchermata();
    // Non rubiamo il focus al gioco: la mostriamo senza attivarla.
    finestraSchermata.showInactive();
  });
  // F11 = schermo intero sì/no, Esc = esci dallo schermo intero (F2 = Impostazioni è gestito dalla pagina)
  finestraSchermata.webContents.on("before-input-event", (evento, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      finestraSchermata.setFullScreen(!finestraSchermata.isFullScreen());
      evento.preventDefault();
    } else if (input.key === "Escape" && finestraSchermata.isFullScreen()) {
      finestraSchermata.setFullScreen(false);
      evento.preventDefault();
    }
  });
  // Link esterni: mai dentro l'app
  finestraSchermata.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  finestraSchermata.on("closed", () => {
    finestraSchermata = null;
  });
}

function chiudiSchermata() {
  finestraSchermata?.close();
}

// ---------------------------------------------------------------------------
// Finestra delle impostazioni
// ---------------------------------------------------------------------------
function apriImpostazioni() {
  if (finestraImpostazioni) {
    if (finestraImpostazioni.isMinimized()) finestraImpostazioni.restore();
    finestraImpostazioni.focus();
    return;
  }
  finestraImpostazioni = new BrowserWindow({
    width: 580,
    height: 860,
    resizable: true,
    minWidth: 420,
    title: T().titoloImpostazioni,
    icon: ICONA,
    backgroundColor: "#06111f",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(cartella, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  finestraImpostazioni.loadFile(path.join(cartella, "impostazioni.html"));
  finestraImpostazioni.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  finestraImpostazioni.on("closed", () => {
    finestraImpostazioni = null;
  });
}

async function datiPerImpostazioni() {
  const gameLog = percorsoGameLog(imp);
  const server = ponte?.sorgenti()?.server ?? {};
  return {
    imp,
    telemetriaGioco: {
      ...(await statoTelemetriaGioco(imp)),
      // Il Game.log dell'ultimo avvio dice se il gioco ha aperto la porta della telemetria
      portaNelLog: server.portaTelemetria ?? null,
      ricevuta: !!ponte?.sorgenti()?.telemetria?.connesso,
    },
    aggiornamento: { ...aggiornamenti.stato },
    monitor: elencoMonitor(),
    monitorAttuale: monitorScelto().id,
    gameLog: { percorso: gameLog, trovato: !!gameLog && fs.existsSync(gameLog) },
    gioco: gioco.aperto,
    canaleRilevato: gioco.info?.canale ?? null,
    linguaInUso: lingua(),
    versioneApp: app.getVersion(),
    fileImpostazioni: archivio.file,
    fileRegistro,
  };
}

ipcMain.handle("imp:leggi", () => datiPerImpostazioni());

ipcMain.handle("imp:salva", (_e, modifiche) => {
  const prima = imp;
  const ammesse = Object.fromEntries(
    Object.entries(modifiche ?? {}).filter(([k]) =>
      ["avvioConPC", "aperturaAutomatica", "schermoIntero", "canale", "cartellaGioco", "monitorId", "lingua"].includes(k)
    )
  );
  if ("cartellaGioco" in ammesse) ammesse.cartellaGioco = normalizzaCartella(ammesse.cartellaGioco);
  if ("canale" in ammesse && !["AUTO", "LIVE", "PTU"].includes(ammesse.canale)) delete ammesse.canale;
  if ("lingua" in ammesse && !["AUTO", "it", "en"].includes(ammesse.lingua)) delete ammesse.lingua;
  imp = { ...imp, ...ammesse };
  // Canale scelto a mano: lo usiamo subito. Automatico: quello del gioco aperto, se c'è.
  if (imp.canale !== "AUTO") imp.versione = imp.canale;
  else if (gioco.info) imp = { ...imp, versione: gioco.info.canale, cartellaGioco: gioco.info.cartellaGioco };
  archivio.salva(imp);
  scrivi(`Impostazioni salvate: ${JSON.stringify(ammesse)}`);

  if (prima.avvioConPC !== imp.avvioConPC) applicaAvvioConPC();
  if (prima.lingua !== imp.lingua) {
    aggiornaTray();
    finestraImpostazioni?.setTitle(T().titoloImpostazioni);
  }
  if (prima.cartellaGioco !== imp.cartellaGioco || prima.versione !== imp.versione || prima.lingua !== imp.lingua) {
    ponte.aggiornaConfig(configPonte());
  }
  if (prima.monitorId !== imp.monitorId || prima.schermoIntero !== imp.schermoIntero) posizionaSchermata();
  return datiPerImpostazioni();
});

ipcMain.handle("imp:sfoglia", async () => {
  const risultato = await dialog.showOpenDialog(finestraImpostazioni ?? undefined, {
    title: T().sfoglia,
    defaultPath: imp.cartellaGioco ?? undefined,
    properties: ["openDirectory"],
  });
  if (risultato.canceled || !risultato.filePaths[0]) return null;
  return normalizzaCartella(risultato.filePaths[0]);
});

ipcMain.handle("telemetria:attiva", async () => {
  const r = await attivaTelemetriaGioco(imp, lingua());
  scrivi(`Attivazione telemetria: ${r.messaggi.join(" | ")}`);
  return { messaggi: r.messaggi, dati: await datiPerImpostazioni() };
});

ipcMain.handle("agg:controlla", async () => {
  await aggiornamenti.controlla();
  return datiPerImpostazioni();
});

ipcMain.handle("agg:installa", () => {
  aggiornamenti.installa();
  return true;
});

ipcMain.handle("impostazioni:apri", () => {
  apriImpostazioni();
  return true;
});

ipcMain.handle("schermata:apri", () => {
  apriSchermata();
  return true;
});
