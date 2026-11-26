// ============================================================
// Telemetria SC — Motore del ponte
// Usato sia dall'app per Windows (app/main.mjs) sia dall'avvio da
// terminale (ponte/index.mjs). Raccoglie:
//   - telemetria del gioco (gRPC locale)
//   - dati del server dal Game.log (IP, shard, regione, sessione)
//   - ping verso il server
// e li manda alla schermata tramite WebSocket.
// ============================================================

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { avviaLettoreLog } from "./gamelog.mjs";
import { avviaMisuraPing } from "./ping.mjs";
import { avviaTelemetria } from "./telemetria.mjs";
import { avviaDemo } from "./demo.mjs";

const cartella = path.dirname(fileURLToPath(import.meta.url));
const CARTELLA_WEB = path.join(cartella, "..", "dist");

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * Avvia il ponte.
 * config: { portaWeb, apriInRete, gameLog, telemetriaHost, telemetriaPorte,
 *           intervalloPing, aggiornamentiAlSecondo }
 * giocoAperto: funzione che restituisce true/false/null (null = non si sa)
 * Restituisce una promessa con { porta, aggiornaConfig, chiudi, sorgenti }.
 */
export function avviaPonte({ config, demo = false, giocoAperto = () => null, scrivi = console.log }) {
  let ultimiDati = { nave: null, armi: null, personaggio: null };
  const registro = []; // ultimi eventi, il più recente per primo

  function aggiungiEvento(testo) {
    const ora = new Date().toLocaleTimeString("it-IT", { hour12: false });
    registro.unshift({ ora, testo });
    if (registro.length > 30) registro.pop();
    scrivi(`[${ora}] ${testo}`);
  }

  function riceviDati(d) {
    ultimiDati = { nave: d.nave, armi: d.armi, personaggio: d.personaggio };
    for (const e of d.eventi) aggiungiEvento(e);
  }

  function creaSorgenti(cfg) {
    if (demo) return avviaDemo({ onDati: riceviDati, onEvento: aggiungiEvento });
    const lettore = avviaLettoreLog(cfg.gameLog, aggiungiEvento);
    // A gioco chiuso il Game.log contiene ancora l'ultima sessione:
    // non misuriamo il ping verso un server che non stiamo più usando.
    const ping = avviaMisuraPing(
      () => (giocoAperto() === false ? {} : lettore.server),
      cfg.intervalloPing,
      scrivi
    );
    const telemetria = avviaTelemetria({
      host: cfg.telemetriaHost,
      porte: cfg.telemetriaPorte,
      portaDalLog: () => lettore.server.portaTelemetria,
      onDati: riceviDati,
      onEvento: aggiungiEvento,
    });
    return {
      get server() {
        return lettore.server;
      },
      ping,
      telemetria,
      lettore,
      ferma() {
        lettore.ferma?.();
        ping.ferma?.();
        telemetria.ferma?.();
      },
    };
  }

  let configAttuale = config;
  let sorgenti = creaSorgenti(config);

  function istantanea() {
    const { server, ping, telemetria, lettore } = sorgenti;
    const aperto = demo ? true : giocoAperto();
    const mostraServer = aperto !== false; // se non si sa, mostriamo
    const uptime =
      server.uptimeSecondi != null && server.uptimeLetto
        ? server.uptimeSecondi + Math.floor((Date.now() - server.uptimeLetto) / 1000)
        : null;
    const telemetriaViva = telemetria.connesso;
    return {
      demo,
      ora: Date.now(),
      stato: {
        versione: demo ? "LIVE" : configAttuale.versione ?? null, // "LIVE" | "PTU"
        gioco: aperto,
        log: lettore.trovato,
        erroreLog: lettore.errore,
        percorsoLog: demo ? null : configAttuale.gameLog,
        telemetria: telemetriaViva,
        portaTelemetria: telemetria.porta,
        erroreTelemetria: telemetria.errore,
        pacchettiAlSecondo: telemetria.pacchettiAlSecondo,
      },
      server: mostraServer
        ? {
            ip: server.ip,
            porta: server.porta,
            shard: server.shard,
            regione: server.regione,
            ambiente: server.ambiente,
            sessione: server.sessione,
            uptimeSecondi: uptime,
            connessoDaSecondi: server.connessoDa ? Math.floor((Date.now() - server.connessoDa) / 1000) : null,
            build: [server.branch, server.changelist].filter(Boolean).join(" · ") || null,
          }
        : {},
      ping: mostraServer
        ? {
            ms: ping.ms,
            metodo: ping.metodo,
            dettaglio: ping.dettaglio ?? null,
            ricerca: !!ping.ricerca,
            storico: ping.storico,
            perdite: ping.perdite,
            tentativi: ping.tentativi,
          }
        : { ms: null, metodo: null, dettaglio: null, ricerca: false, storico: [], perdite: 0, tentativi: 0 },
      // Se la telemetria è ferma non mostriamo dati vecchi come se fossero veri.
      nave: telemetriaViva ? ultimiDati.nave : null,
      armi: telemetriaViva ? ultimiDati.armi : null,
      personaggio: telemetriaViva ? ultimiDati.personaggio : null,
      eventi: registro,
    };
  }

  const serverWeb = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/stato") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(istantanea()));
      return;
    }
    if (!fs.existsSync(CARTELLA_WEB)) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("La pagina non è ancora stata preparata.\nEsegui prima:  npm run build");
      return;
    }
    // Evitiamo che si possa uscire dalla cartella dist con "../"
    let richiesto;
    try {
      richiesto = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    } catch {
      richiesto = "";
    }
    let file = path.join(CARTELLA_WEB, richiesto);
    if (!file.startsWith(CARTELLA_WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(CARTELLA_WEB, "index.html");
    }
    res.writeHead(200, { "Content-Type": TIPI[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });

  const ws = new WebSocketServer({ server: serverWeb, path: "/ws" });
  ws.on("connection", (client) => client.send(JSON.stringify(istantanea())));

  const timerInvio = setInterval(() => {
    if (ws.clients.size === 0) return;
    const messaggio = JSON.stringify(istantanea());
    for (const client of ws.clients) {
      if (client.readyState === 1) client.send(messaggio);
    }
  }, Math.round(1000 / (config.aggiornamentiAlSecondo || 10)));

  function ascolta(porta) {
    return new Promise((risolvi, rifiuta) => {
      const host = config.apriInRete ? "0.0.0.0" : "127.0.0.1";
      const onErrore = (e) => {
        serverWeb.off("listening", onOk);
        rifiuta(e);
      };
      const onOk = () => {
        serverWeb.off("error", onErrore);
        risolvi(serverWeb.address().port);
      };
      serverWeb.once("error", onErrore);
      serverWeb.once("listening", onOk);
      serverWeb.listen(porta, host);
    });
  }

  return ascolta(config.portaWeb).then((porta) => ({
    porta,
    sorgenti: () => sorgenti,
    istantanea,
    // Cambia impostazioni (es. percorso del Game.log) senza riavviare il server.
    aggiornaConfig(nuova) {
      configAttuale = { ...configAttuale, ...nuova };
      sorgenti.ferma?.();
      sorgenti = creaSorgenti(configAttuale);
    },
    chiudi() {
      clearInterval(timerInvio);
      sorgenti.ferma?.();
      for (const c of ws.clients) c.terminate();
      ws.close();
      serverWeb.close();
    },
  }));
}
