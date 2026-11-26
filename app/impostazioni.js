// Logica della finestra Impostazioni. Ogni modifica viene salvata subito.
const api = window.telemetria;
const $ = (id) => document.getElementById(id);
let timerSalvato;

function mostraSalvato() {
  $("salvato").classList.add("visibile");
  clearTimeout(timerSalvato);
  timerSalvato = setTimeout(() => $("salvato").classList.remove("visibile"), 1200);
}

function segno(el, valore, testoSi, testoNo, testoNull = "—") {
  el.textContent = valore === true ? testoSi : valore === false ? testoNo : testoNull;
  el.className = valore === true ? "ok" : valore === false ? "no" : "neutro";
}

const FASI_AGG = {
  "non-disponibile": "non disponibile in questa versione di prova",
  inattivo: "in attesa del primo controllo",
  controllo: "controllo in corso…",
  aggiornato: "✓ è l'ultima versione",
  errore: "✗ controllo non riuscito",
};

function mostraStato(d) {
  const { imp } = d;
  const t = d.telemetriaGioco ?? {};
  segno($("tVariabile"), t.variabile, "✓ impostata", "✗ non impostata", "—");
  segno($("tUserCfg"), t.userCfg, "✓ pronto", "✗ da preparare");
  segno($("tLog"), t.portaNelLog != null ? true : null, `✓ attiva (porta ${t.portaNelLog})`, "", "non attiva o gioco non avviato");
  segno($("tRicevuta"), t.ricevuta, "✓ sì", "no");

  const a = d.aggiornamento ?? {};
  $("aVersione").textContent = d.versioneApp;
  const st = $("aStato");
  if (a.fase === "scaricamento") st.textContent = `scarico la ${a.versione}… ${a.percento ?? 0}%`;
  else if (a.fase === "pronto") st.textContent = `✓ versione ${a.versione} pronta da installare`;
  else st.textContent = (FASI_AGG[a.fase] ?? a.fase ?? "—") + (a.fase === "errore" && a.errore ? ` (${a.errore})` : "");
  st.className = a.fase === "pronto" || a.fase === "aggiornato" ? "ok" : a.fase === "errore" ? "no" : "neutro";
  $("installaAgg").hidden = a.fase !== "pronto";
  $("controllaAgg").disabled = a.fase === "non-disponibile" || a.fase === "controllo" || a.fase === "scaricamento";

  const log = $("statoLog");
  if (!imp.cartellaGioco) {
    log.className = "stato no";
    log.textContent = "Scegli la cartella di Star Citizen (quella che contiene LIVE e PTU).";
  } else if (d.gameLog.trovato) {
    log.className = "stato ok";
    log.textContent = `✓ Game.log trovato (${imp.versione})`;
  } else {
    log.className = "stato no";
    log.textContent = `✗ Game.log non trovato in ${imp.versione}. Avvia il gioco almeno una volta o controlla la cartella.`;
  }
  const g = $("statoGioco");
  g.textContent = d.gioco === true ? "Star Citizen aperto" : d.gioco === false ? "Star Citizen chiuso" : "stato del gioco sconosciuto";
  g.className = d.gioco === true ? "ok" : "neutro";
}

function mostra(d) {
  const { imp } = d;
  mostraStato(d);
  $("avvioConPC").checked = !!imp.avvioConPC;
  $("aperturaAutomatica").checked = !!imp.aperturaAutomatica;
  $("schermoIntero").checked = !!imp.schermoIntero;
  for (const r of document.querySelectorAll('input[name="versione"]')) r.checked = r.value === imp.versione;

  $("cartellaGioco").textContent = imp.cartellaGioco || "Cartella non trovata: premi Sfoglia…";

  const sel = $("monitor");
  sel.innerHTML = "";
  for (const m of d.monitor) {
    const o = document.createElement("option");
    o.value = String(m.id);
    o.textContent = m.nome;
    o.selected = m.id === d.monitorAttuale;
    sel.appendChild(o);
  }

  $("piede").textContent = `Versione ${d.versioneApp} · Registro: ${d.fileRegistro}`;
}

async function salva(modifiche) {
  mostra(await api.salva(modifiche));
  mostraSalvato();
}

$("avvioConPC").addEventListener("change", (e) => salva({ avvioConPC: e.target.checked }));
$("aperturaAutomatica").addEventListener("change", (e) => salva({ aperturaAutomatica: e.target.checked }));
$("schermoIntero").addEventListener("change", (e) => salva({ schermoIntero: e.target.checked }));
for (const r of document.querySelectorAll('input[name="versione"]')) {
  r.addEventListener("change", (e) => salva({ versione: e.target.value }));
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
