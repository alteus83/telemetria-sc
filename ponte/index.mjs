// ============================================================
// Telemetria SC — Ponte
// Gira sul PC dove giochi. Raccoglie:
//   - telemetria del gioco (gRPC locale)
//   - dati del server dal Game.log (IP, shard, regione, sessione)
//   - ping verso il server
// e li manda alla pagina web (schermo secondario) tramite WebSocket.
//
// Avvio normale:  npm run ponte
// Avvio demo:     npm run demo
// ============================================================

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { caricaConfigurazione } from "./config.mjs";
import { avviaLettoreLog } from "./gamelog.mjs";
import { avviaMisuraPing } from "./ping.mjs";
import { avviaTelemetria } from "./telemetria.mjs";
import { avviaDemo } from "./demo.mjs";

const cartella = path.dirname(fileURLToPath(import.meta.url));
const cartellaWeb = path.join(cartella, "..", "dist");
const config = caricaConfigurazione();
const modoDemo = process.argv.includes("--demo");

// ---------------------------------------------------------------------------
// Stato condiviso
// ---------------------------------------------------------------------------
let ultimiDati = { nave: null, armi: null, personaggio: null };
const registro = []; // ultimi eventi, il più recente per primo

function aggiungiEvento(testo) {
  const ora = new Date().toLocaleTimeString("it-IT", { hour12: false });
  registro.unshift({ ora, testo });
  if (registro.length > 30) registro.pop();
  console.log(`[${ora}] ${testo}`);
}

function riceviDati(d) {
  ultimiDati = { nave: d.nave, armi: d.armi, personaggio: d.personaggio };
  for (const e of d.eventi) aggiungiEvento(e);
}

let sorgenti;
if (modoDemo) {
  sorgenti = avviaDemo({ onDati: riceviDati, onEvento: aggiungiEvento });
} else {
  const lettore = avviaLettoreLog(config.gameLog, aggiungiEvento);
  const ping = avviaMisuraPing(() => lettore.server, config.intervalloPing);
  const telemetria = avviaTelemetria({
    host: config.telemetriaHost,
    porte: config.telemetriaPorte,
    portaDalLog: () => lettore.server.portaTelemetria,
    onDati: riceviDati,
    onEvento: aggiungiEvento,
  });
  sorgenti = {
    get server() {
      return lettore.server;
    },
    ping,
    telemetria,
    lettore,
  };
}

function istantanea() {
  const { server, ping, telemetria, lettore } = sorgenti;
  // L'uptime nel log viene scritto di rado: lo facciamo avanzare noi.
  const uptime =
    server.uptimeSecondi != null && server.uptimeLetto
      ? server.uptimeSecondi + Math.floor((Date.now() - server.uptimeLetto) / 1000)
      : null;
  const telemetriaViva = telemetria.connesso;
  return {
    demo: modoDemo,
    ora: Date.now(),
    stato: {
      log: lettore.trovato,
      erroreLog: lettore.errore,
      telemetria: telemetriaViva,
      portaTelemetria: telemetria.porta,
      erroreTelemetria: telemetria.errore,
      pacchettiAlSecondo: telemetria.pacchettiAlSecondo,
    },
    server: {
      ip: server.ip,
      porta: server.porta,
      shard: server.shard,
      regione: server.regione,
      ambiente: server.ambiente,
      sessione: server.sessione,
      uptimeSecondi: uptime,
      connessoDaSecondi: server.connessoDa ? Math.floor((Date.now() - server.connessoDa) / 1000) : null,
      build: [server.branch, server.changelist].filter(Boolean).join(" · ") || null,
    },
    ping: {
      ms: ping.ms,
      metodo: ping.metodo,
      storico: ping.storico,
      perdite: ping.perdite,
      tentativi: ping.tentativi,
    },
    // Se la telemetria è ferma non mostriamo dati vecchi come se fossero veri.
    nave: telemetriaViva ? ultimiDati.nave : null,
    armi: telemetriaViva ? ultimiDati.armi : null,
    personaggio: telemetriaViva ? ultimiDati.personaggio : null,
    eventi: registro,
  };
}

// ---------------------------------------------------------------------------
// Server web: pagina + flusso dati
// ---------------------------------------------------------------------------
const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const serverWeb = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/stato") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(istantanea()));
    return;
  }
  if (!fs.existsSync(cartellaWeb)) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("La pagina non è ancora stata preparata.\nChiudi il ponte ed esegui prima:  npm run build");
    return;
  }
  // Evitiamo che si possa uscire dalla cartella dist con "../"
  const richiesto = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  let file = path.join(cartellaWeb, richiesto);
  if (!file.startsWith(cartellaWeb) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(cartellaWeb, "index.html");
  }
  res.writeHead(200, { "Content-Type": TIPI[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const ws = new WebSocketServer({ server: serverWeb, path: "/ws" });
ws.on("connection", (client) => {
  client.send(JSON.stringify(istantanea()));
});

setInterval(() => {
  if (ws.clients.size === 0) return;
  const messaggio = JSON.stringify(istantanea());
  for (const client of ws.clients) {
    if (client.readyState === 1) client.send(messaggio);
  }
}, Math.round(1000 / config.aggiornamentiAlSecondo));

const host = config.apriInRete ? "0.0.0.0" : "127.0.0.1";
serverWeb.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\nLa porta ${config.portaWeb} è già occupata: forse il ponte è già aperto in un'altra finestra.`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
serverWeb.listen(config.portaWeb, host, () => {
  console.log("============================================");
  console.log(" TELEMETRIA SC — Ponte" + (modoDemo ? " (DEMO)" : ""));
  console.log("============================================");
  console.log(` Apri sullo schermo secondario:  http://localhost:${config.portaWeb}`);
  if (!modoDemo) {
    console.log(` Game.log:  ${config.gameLog}`);
    console.log(` Telemetria: ${config.telemetriaHost}, porte ${config.telemetriaPorte.join(", ")}`);
  }
  console.log(" Per chiudere: CTRL + C");
  console.log("============================================\n");
});

process.on("SIGINT", () => {
  console.log("\nPonte chiuso.");
  process.exit(0);
});
