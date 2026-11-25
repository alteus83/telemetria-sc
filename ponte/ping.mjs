// Misura del ping verso il server di gioco.
// Metodo 1 (ICMP): il classico comando "ping" di Windows.
// Metodo 2 (TCP): se il server non risponde al ping, misuriamo quanto ci
// mette a rispondere (anche con un rifiuto) a una richiesta di connessione.
// Il metodo 2 è un'approssimazione: lo indichiamo sullo schermo.

import { execFile } from "node:child_process";
import net from "node:net";

const suWindows = process.platform === "win32";

function pingIcmp(ip) {
  return new Promise((risolvi) => {
    const argomenti = suWindows ? ["-n", "1", "-w", "1000", ip] : ["-c", "1", "-W", "1", ip];
    execFile("ping", argomenti, { timeout: 3000, windowsHide: true }, (_err, stdout) => {
      // Funziona con Windows in italiano ("durata=23ms", "durata<1ms"),
      // in inglese ("time=23ms") e su Linux ("time=23.4 ms").
      const m = String(stdout || "").match(/(?:durata|time|tempo|zeit|temps)[=<]\s*([\d.,]+)\s*ms/i);
      risolvi(m ? Math.max(1, Math.round(parseFloat(m[1].replace(",", ".")))) : null);
    });
  });
}

function pingTcp(ip, porta) {
  return new Promise((risolvi) => {
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

export function avviaMisuraPing(ottieniServer, intervallo) {
  const stato = {
    ms: null,
    metodo: null, // "icmp" | "tcp" | null
    storico: [], // ultimi valori, per il grafico
    perdite: 0,
    tentativi: 0,
  };
  let ipPrecedente = null;
  let icmpFunziona = true;
  let occupato = false;

  async function misura() {
    if (occupato) return;
    const { ip, porta } = ottieniServer();
    if (!ip) {
      stato.ms = null;
      stato.metodo = null;
      return;
    }
    if (ip !== ipPrecedente) {
      ipPrecedente = ip;
      icmpFunziona = true;
      stato.storico = [];
      stato.perdite = 0;
      stato.tentativi = 0;
    }
    occupato = true;
    try {
      let ms = null;
      let metodo = null;
      if (icmpFunziona) {
        ms = await pingIcmp(ip);
        metodo = "icmp";
        // Se i primi tentativi falliscono tutti, il server ignora il ping:
        // passiamo al metodo TCP.
        if (ms === null && stato.tentativi >= 2 && stato.storico.every((v) => v === null)) {
          icmpFunziona = false;
          // I fallimenti ICMP non erano perdite vere: ripartiamo da zero.
          stato.storico = [];
          stato.perdite = 0;
          stato.tentativi = 0;
        }
      }
      if (ms === null && !icmpFunziona && porta) {
        ms = await pingTcp(ip, porta);
        metodo = "tcp";
      }
      stato.tentativi += 1;
      if (ms === null) stato.perdite += 1;
      stato.ms = ms;
      stato.metodo = ms === null ? stato.metodo : metodo;
      stato.storico.push(ms);
      if (stato.storico.length > 60) stato.storico.shift();
    } finally {
      occupato = false;
    }
  }

  misura();
  const timer = setInterval(misura, intervallo);
  stato.ferma = () => clearInterval(timer);
  return stato;
}
