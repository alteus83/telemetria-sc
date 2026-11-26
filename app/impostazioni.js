// Logica della finestra Impostazioni. Ogni modifica viene salvata subito.
const api = window.telemetria;
const $ = (id) => document.getElementById(id);
let timerSalvato;

const TESTI = {
  it: {
    impostazioni: "Impostazioni", avvio: "AVVIO",
    avvioConPC: "Avvia all'accensione del PC",
    avvioConPCInfo: "L'app parte da sola con Windows e resta come icona vicino all'orologio.",
    apertura: "Apri la schermata quando parte il gioco",
    aperturaInfo: "Si apre quando avvii Star Citizen e si chiude quando lo chiudi.",
    gioco: "GIOCO", versioneGioco: "Versione del gioco", automatica: "AUTOMATICA", sfoglia: "Sfoglia…",
    telemetria: "TELEMETRIA DEL GIOCO", variabile: "Variabile di Windows", fileCfg: "File user.cfg",
    ultimoAvvio: "Ultimo avvio del gioco", ricevuti: "Dati ricevuti ora", attiva: "ATTIVA TELEMETRIA NEL GIOCO",
    schermata: "SCHERMATA", monitor: "Monitor della schermata", schermoIntero: "Schermo intero",
    schermoInteroInfo: "Nella schermata: F11 attiva o disattiva, Esc esce dallo schermo intero.",
    lingua: "LINGUA",
    aggiornamenti: "AGGIORNAMENTI", versioneInstallata: "Versione installata", stato: "Stato",
    cerca: "CERCA AGGIORNAMENTI", installa: "INSTALLA E RIAVVIA", apri: "APRI SCHERMATA ORA", salvato: "Salvato",
    fasi: {
      "non-disponibile": "non disponibile in questa versione di prova",
      inattivo: "in attesa del primo controllo",
      controllo: "controllo in corso…",
      aggiornato: "✓ è l'ultima versione",
      errore: "✗ controllo non riuscito",
    },
    scarico: (v, p) => `scarico la ${v}… ${p}%`,
    pronta: (v) => `✓ versione ${v} pronta da installare`,
    impostata: "✓ impostata", nonImpostata: "✗ non impostata",
    pronto: "✓ pronto", daPreparare: "✗ da preparare",
    attivaPorta: (p) => `✓ attiva (porta ${p})`, nonAttiva: "non attiva o gioco non avviato",
    si: "✓ sì", no: "no",
    scegliCartella: "Scegli la cartella di Star Citizen (quella che contiene LIVE e PTU).",
    logTrovato: (v) => `✓ Game.log trovato (${v})`,
    logNonTrovato: (v) => `✗ Game.log non trovato in ${v}. Avvia il gioco almeno una volta o controlla la cartella.`,
    riconosciuta: (c) => `Riconosciuta dal gioco aperto: ${c}`,
    sceglieDaSola: (v) => `Si sceglie da sola quando avvii il gioco (ultima usata: ${v})`,
    forzata: (c) => `Forzata su ${c}`,
    giocoAperto: "Star Citizen aperto", giocoChiuso: "Star Citizen chiuso", giocoSconosciuto: "stato del gioco sconosciuto",
    cartellaNonTrovata: "Cartella non trovata: premi Sfoglia…",
    piede: (v, f) => `Versione ${v} · Registro: ${f}`,
  },
  en: {
    impostazioni: "Settings", avvio: "STARTUP",
    avvioConPC: "Start with Windows",
    avvioConPCInfo: "The app starts by itself with Windows and stays as an icon next to the clock.",
    apertura: "Open the display when the game starts",
    aperturaInfo: "It opens when you start Star Citizen and closes when you quit it.",
    gioco: "GAME", versioneGioco: "Game version", automatica: "AUTOMATIC", sfoglia: "Browse…",
    telemetria: "GAME TELEMETRY", variabile: "Windows variable", fileCfg: "user.cfg file",
    ultimoAvvio: "Last game start", ricevuti: "Data received now", attiva: "ENABLE TELEMETRY IN GAME",
    schermata: "DISPLAY", monitor: "Display monitor", schermoIntero: "Full screen",
    schermoInteroInfo: "On the display: F11 toggles full screen, Esc exits full screen.",
    lingua: "LANGUAGE",
    aggiornamenti: "UPDATES", versioneInstallata: "Installed version", stato: "Status",
    cerca: "CHECK FOR UPDATES", installa: "INSTALL AND RESTART", apri: "OPEN DISPLAY NOW", salvato: "Saved",
    fasi: {
      "non-disponibile": "not available in this test build",
      inattivo: "waiting for the first check",
      controllo: "checking…",
      aggiornato: "✓ up to date",
      errore: "✗ check failed",
    },
    scarico: (v, p) => `downloading ${v}… ${p}%`,
    pronta: (v) => `✓ version ${v} ready to install`,
    impostata: "✓ set", nonImpostata: "✗ not set",
    pronto: "✓ ready", daPreparare: "✗ to be prepared",
    attivaPorta: (p) => `✓ active (port ${p})`, nonAttiva: "not active or game not started",
    si: "✓ yes", no: "no",
    scegliCartella: "Choose the Star Citizen folder (the one containing LIVE and PTU).",
    logTrovato: (v) => `✓ Game.log found (${v})`,
    logNonTrovato: (v) => `✗ Game.log not found in ${v}. Start the game at least once or check the folder.`,
    riconosciuta: (c) => `Detected from the running game: ${c}`,
    sceglieDaSola: (v) => `Chosen automatically when you start the game (last used: ${v})`,
    forzata: (c) => `Forced to ${c}`,
    giocoAperto: "Star Citizen running", giocoChiuso: "Star Citizen closed", giocoSconosciuto: "game status unknown",
    cartellaNonTrovata: "Folder not found: press Browse…",
    piede: (v, f) => `Version ${v} · Log: ${f}`,
  },
};
let T = TESTI.it;

function traduciPagina() {
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = T[el.dataset.t];
  for (const el of document.querySelectorAll("[data-t-aria]")) el.setAttribute("aria-label", T[el.dataset.tAria]);
  document.documentElement.lang = T === TESTI.en ? "en" : "it";
}

function mostraSalvato() {
  $("salvato").classList.add("visibile");
  clearTimeout(timerSalvato);
  timerSalvato = setTimeout(() => $("salvato").classList.remove("visibile"), 1200);
}

function segno(el, valore, testoSi, testoNo, testoNull = "—") {
  el.textContent = valore === true ? testoSi : valore === false ? testoNo : testoNull;
  el.className = valore === true ? "ok" : valore === false ? "no" : "neutro";
}

function scegliLingua(d) {
  const nuova = TESTI[d.linguaInUso] ?? TESTI.it;
  if (nuova !== T) {
    T = nuova;
    traduciPagina();
    return true;
  }
  return false;
}

function mostraStato(d) {
  scegliLingua(d);
  const { imp } = d;
  const t = d.telemetriaGioco ?? {};
  segno($("tVariabile"), t.variabile, T.impostata, T.nonImpostata, "—");
  segno($("tUserCfg"), t.userCfg, T.pronto, T.daPreparare);
  segno($("tLog"), t.portaNelLog != null ? true : null, T.attivaPorta(t.portaNelLog), "", T.nonAttiva);
  segno($("tRicevuta"), t.ricevuta, T.si, T.no);

  const a = d.aggiornamento ?? {};
  $("aVersione").textContent = d.versioneApp;
  const st = $("aStato");
  if (a.fase === "scaricamento") st.textContent = T.scarico(a.versione, a.percento ?? 0);
  else if (a.fase === "pronto") st.textContent = T.pronta(a.versione);
  else st.textContent = (T.fasi[a.fase] ?? a.fase ?? "—") + (a.fase === "errore" && a.errore ? ` (${a.errore})` : "");
  st.className = a.fase === "pronto" || a.fase === "aggiornato" ? "ok" : a.fase === "errore" ? "no" : "neutro";
  $("installaAgg").hidden = a.fase !== "pronto";
  $("controllaAgg").disabled = a.fase === "non-disponibile" || a.fase === "controllo" || a.fase === "scaricamento";

  const log = $("statoLog");
  if (!imp.cartellaGioco) {
    log.className = "stato no";
    log.textContent = T.scegliCartella;
  } else if (d.gameLog.trovato) {
    log.className = "stato ok";
    log.textContent = T.logTrovato(imp.versione);
  } else {
    log.className = "stato no";
    log.textContent = T.logNonTrovato(imp.versione);
  }
  const cu = $("canaleInUso");
  if (imp.canale === "AUTO") cu.textContent = d.canaleRilevato ? T.riconosciuta(d.canaleRilevato) : T.sceglieDaSola(imp.versione);
  else cu.textContent = T.forzata(imp.canale);

  const g = $("statoGioco");
  g.textContent = d.gioco === true ? T.giocoAperto : d.gioco === false ? T.giocoChiuso : T.giocoSconosciuto;
  g.className = d.gioco === true ? "ok" : "neutro";
  $("cartellaGioco").textContent = imp.cartellaGioco || T.cartellaNonTrovata;
  $("piede").textContent = T.piede(d.versioneApp, d.fileRegistro);
}

function mostra(d) {
  const { imp } = d;
  mostraStato(d);
  $("avvioConPC").checked = !!imp.avvioConPC;
  $("aperturaAutomatica").checked = !!imp.aperturaAutomatica;
  $("schermoIntero").checked = !!imp.schermoIntero;
  for (const r of document.querySelectorAll('input[name="canale"]')) r.checked = r.value === imp.canale;
  for (const r of document.querySelectorAll('input[name="lingua"]')) r.checked = r.value === (imp.lingua ?? "AUTO");

  const sel = $("monitor");
  sel.innerHTML = "";
  for (const m of d.monitor) {
    const o = document.createElement("option");
    o.value = String(m.id);
    o.textContent = m.nome;
    o.selected = m.id === d.monitorAttuale;
    sel.appendChild(o);
  }
}

async function salva(modifiche) {
  mostra(await api.salva(modifiche));
  mostraSalvato();
}

$("avvioConPC").addEventListener("change", (e) => salva({ avvioConPC: e.target.checked }));
$("aperturaAutomatica").addEventListener("change", (e) => salva({ aperturaAutomatica: e.target.checked }));
$("schermoIntero").addEventListener("change", (e) => salva({ schermoIntero: e.target.checked }));
for (const r of document.querySelectorAll('input[name="canale"]')) {
  r.addEventListener("change", (e) => salva({ canale: e.target.value }));
}
for (const r of document.querySelectorAll('input[name="lingua"]')) {
  r.addEventListener("change", (e) => salva({ lingua: e.target.value }));
}
$("monitor").addEventListener("change", (e) => salva({ monitorId: Number(e.target.value) }));
$("sfoglia").addEventListener("click", async () => {
  const scelta = await api.sfoglia();
  if (scelta) salva({ cartellaGioco: scelta });
});
$("apri").addEventListener("click", () => api.apriSchermata());
$("attivaTelemetria").addEventListener("click", async (e) => {
  e.target.disabled = true;
  try {
    const r = await api.attivaTelemetria();
    $("esitoTelemetria").textContent = r.messaggi.join("\n");
    mostraStato(r.dati);
  } finally {
    e.target.disabled = false;
  }
});
$("controllaAgg").addEventListener("click", async () => mostraStato(await api.controllaAggiornamenti()));
$("installaAgg").addEventListener("click", () => api.installaAggiornamento());

api.leggi().then(mostra);
// Aggiorna ogni tanto lo stato (gioco aperto/chiuso, Game.log creato).
setInterval(() => api.leggi().then(mostraStato), 4000);
