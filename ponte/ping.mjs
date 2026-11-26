// Misura del ping verso il server di gioco.
// I server di Star Citizen (Google Cloud) di solito non rispondono a misure
// dall'esterno, quindi proviamo più metodi in ordine e ci fermiamo sul primo
// che funziona:
//   1. icmp        il classico comando "ping"
//   2. tcp         tempo di risposta a una richiesta di connessione
//   3. datacenter  punto di test di Google nello stesso datacenter dello shard
//   4. rete        ultimo nodo di rete che risponde lungo il percorso (tracert)
// Dal 2 in poi il valore è una STIMA e la schermata lo dice.

import { execFile } from "node:child_process";
import net from "node:net";
import { trovaDatacenter, misuraDatacenter } from "./datacenter.mjs";

const suWindows = process.platform === "win32";
const FASI = ["icmp", "tcp", "datacenter", "rete"];
const TENTATIVI_PER_FASE = 3;

export function leggiTempoPing(testo) {
  // Windows in italiano ("durata=23ms", "durata<1ms"), in inglese ("time=23ms"), Linux ("time=23.4 ms").
  const m = String(testo || "").match(/(?:durata|time|tempo|zeit|temps)[=<]\s*([\d.,]+)\s*ms/i);
  return m ? Math.max(1, Math.round(parseFloat(m[1].replace(",", ".")))) : null;
}

function pingIcmp(ip) {
  return new Promise((risolvi) => {
    const argomenti = suWindows ? ["-n", "1", "-w", "1000", ip] : ["-c", "1", "-W", "1", ip];
    execFile("ping", argomenti, { timeout: 3000, windowsHide: true }, (_err, stdout) => risolvi(leggiTempoPing(stdout)));
  });
}

function pingTcp(ip, porta) {
  return new Promise((risolvi) => {
    if (!porta) return risolvi(null);
    const inizio = process.hrtime.bigint();
    const socket = net.connect({ host: ip, port: porta });
    const fine = (ok) => {
      socket.destroy();
      risolvi(ok ? Math.max(1, Math.round(Number(process.hrtime.bigint() - inizio) / 1e6)) : null);
    };
    socket.setTimeout(1500, () => fine(false));
    socket.once("connect", () => fine(true));
    // "Connessione rifiutata" significa comunque che il server ha risposto.
    socket.once("error", (e) => fine(e.code === "ECONNREFUSED"));
  });
}

const PRIVATO = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^127\./];

// Dal testo di "tracert" ricava l'ultimo nodo che ha risposto (preferendo uno pubblico).
export function ultimoNodo(testo, destinazione) {
  const nodi = [];
  for (const riga of String(testo).split(/\r?\n/)) {
    const m = riga.match(/^\s*\d+\s+.*?(\d{1,3}(?:\.\d{1,3}){3})\s*$/);
    if (!m || !/ms/i.test(riga) || m[1] === destinazione) continue;
    nodi.push(m[1]);
  }
  const pubblici = nodi.filter((ip) => !PRIVATO.some((r) => r.test(ip)));
  return pubblici.at(-1) ?? nodi.at(-1) ?? null;
}

function tracert(ip) {
  return new Promise((risolvi) => {
    const [cmd, argomenti] = suWindows
      ? ["tracert", ["-d", "-w", "700", "-h", "20", ip]]
      : ["traceroute", ["-n", "-w", "1", "-q", "1", "-m", "20", ip]];
    execFile(cmd, argomenti, { timeout: 90000, windowsHide: true }, (_err, stdout) => risolvi(ultimoNodo(stdout, ip)));
  });
}

export function avviaMisuraPing(ottieniServer, intervallo) {
  const stato = {
    ms: null,
    metodo: null, // "icmp" | "tcp" | "datacenter" | "rete" | null
    dettaglio: null, // es. "europe-west1 (Belgio)" o l'IP del nodo di rete
    ricerca: false, // true mentre stiamo ancora cercando un metodo che funzioni
    storico: [],
    perdite: 0,
    tentativi: 0,
  };
  let ip = null;
  let fase = 0;
  let tentativiFase = 0;
  let successiFase = 0;
  let datacenter = null; // { url, nome, regione } | false (non trovato)
  let nodo = null; // IP | false
  let preparazione = null; // promessa in corso (ricerca datacenter / tracert)
  let occupato = false;

  function azzera() {
    stato.storico = [];
    stato.perdite = 0;
    stato.tentativi = 0;
    tentativiFase = 0;
    successiFase = 0;
  }

  function nuovoServer(nuovo) {
    ip = nuovo;
    fase = 0;
    datacenter = null;
    nodo = null;
    preparazione = null;
    stato.ms = null;
    stato.metodo = null;
    stato.dettaglio = null;
    stato.ricerca = !!nuovo;
    azzera();
  }

  // Prepara (una volta per server) quello che serve alle fasi 3 e 4.
  // Restituisce true se la fase è pronta, false se non è ancora pronta.
  function prepara(nomeFase) {
    if (nomeFase === "datacenter" && datacenter === null) {
      preparazione ??= trovaDatacenter(ip)
        .then(async (d) => {
          datacenter = d ?? false;
          if (d) await misuraDatacenter(d.url); // la prima apre la connessione: non la contiamo
        })
        .catch(() => (datacenter = false))
        .finally(() => (preparazione = null));
      return false;
    }
    if (nomeFase === "rete" && nodo === null) {
      preparazione ??= tracert(ip)
        .then((n) => (nodo = n ?? false))
        .catch(() => (nodo = false))
        .finally(() => (preparazione = null));
      return false;
    }
    return true;
  }

  async function misuraFase(nomeFase, server) {
    switch (nomeFase) {
      case "icmp":
        return { ms: await pingIcmp(ip) };
      case "tcp":
        return { ms: await pingTcp(ip, server.porta) };
      case "datacenter":
        if (!datacenter) return { ms: null, saltaFase: true };
        return { ms: await misuraDatacenter(datacenter.url), dettaglio: `${datacenter.regione} (${datacenter.nome})` };
      case "rete":
        if (!nodo) return { ms: null, saltaFase: true };
        return { ms: await pingIcmp(nodo), dettaglio: nodo };
      default:
        return { ms: null };
    }
  }

  async function misura() {
    if (occupato) return;
    const server = ottieniServer() ?? {};
    if (server.ip !== ip) nuovoServer(server.ip ?? null);
    if (!ip) return;

    occupato = true;
    try {
      const nomeFase = FASI[fase];
      if (!prepara(nomeFase)) return; // in preparazione: riproviamo al prossimo giro

      const r = await misuraFase(nomeFase, server);
      if (server.ip !== ip) return; // il server è cambiato nel frattempo

      // Fase non utilizzabile o mai riuscita dopo alcuni tentativi: passiamo alla successiva.
      if (r.saltaFase || (r.ms === null && successiFase === 0 && tentativiFase + 1 >= TENTATIVI_PER_FASE)) {
        if (fase < FASI.length - 1) {
          fase += 1;
        } else {
          // Nessun metodo ha funzionato: lo segnaliamo e ricominciamo da capo.
          stato.ricerca = false;
          stato.metodo = null;
          stato.dettaglio = null;
          stato.ms = null;
          fase = 0;
          datacenter = null;
          nodo = null;
        }
        azzera();
        return;
      }

      tentativiFase += 1;
      if (r.ms !== null) {
        successiFase += 1;
        stato.ricerca = false;
        stato.metodo = nomeFase;
        stato.dettaglio = r.dettaglio ?? null;
      }
      // Durante la ricerca non mostriamo i fallimenti come pacchetti persi.
      if (successiFase > 0) {
        stato.tentativi += 1;
        if (r.ms === null) stato.perdite += 1;
        stato.ms = r.ms;
        stato.storico.push(r.ms);
        if (stato.storico.length > 60) stato.storico.shift();
      }
    } finally {
      occupato = false;
    }
  }

  misura();
  const timer = setInterval(misura, intervallo);
  stato.ferma = () => clearInterval(timer);
  return stato;
}
