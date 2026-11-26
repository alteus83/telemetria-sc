// Attivazione della telemetria nel gioco, al posto dei comandi in PowerShell:
//  - variabile di Windows GRPC_CLIENT_SERVER_ENABLED=true (come "setx")
//  - righe nel file user.cfg della cartella LIVE o PTU
// Il gioco legge entrambe solo all'avvio: dopo va riavviato (con il launcher chiuso del tutto).

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { testi } from "./testi.mjs";

const VARIABILE = "GRPC_CLIENT_SERVER_ENABLED";

function esegui(cmd, argomenti) {
  return new Promise((risolvi) => {
    execFile(cmd, argomenti, { timeout: 10000, windowsHide: true }, (err, stdout, stderr) =>
      risolvi({ ok: !err, testo: String(stdout || stderr || err?.message || "") })
    );
  });
}

export function righeUserCfg(versione) {
  return {
    "grpc.client.server.enabled": "1",
    "grpc.client.server.port": versione === "LIVE" ? "2942" : "29420",
    "grpc.client.server.external": "0",
    "server.game.telemetry.enabled": "1",
  };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Restituisce il nuovo testo di user.cfg con le righe necessarie
// (aggiorna quelle presenti con un valore diverso, aggiunge quelle mancanti).
export function aggiornaTestoUserCfg(testo, versione) {
  let risultato = testo ?? "";
  const mancanti = [];
  for (const [chiave, valore] of Object.entries(righeUserCfg(versione))) {
    const re = new RegExp(`^([ \\t]*${escapeRegex(chiave)}[ \\t]*=[ \\t]*)(.*)$`, "mi");
    if (re.test(risultato)) risultato = risultato.replace(re, `$1${valore}`);
    else mancanti.push(`${chiave} = ${valore}`);
  }
  if (mancanti.length) {
    const a_capo = risultato.includes("\r\n") || !risultato ? "\r\n" : "\n";
    if (risultato && !risultato.endsWith("\n")) risultato += a_capo;
    risultato += mancanti.join(a_capo) + a_capo;
  }
  return risultato;
}

function percorsoUserCfg(imp) {
  return imp.cartellaGioco ? path.join(imp.cartellaGioco, imp.versione || "LIVE", "user.cfg") : null;
}

export async function statoTelemetriaGioco(imp) {
  let variabile = null;
  if (process.platform === "win32") {
    const r = await esegui("reg", ["query", "HKCU\\Environment", "/v", VARIABILE]);
    variabile = r.ok && /REG_\w+\s+true/i.test(r.testo);
  }
  const file = percorsoUserCfg(imp);
  let userCfg = null;
  if (file) {
    try {
      const testo = fs.readFileSync(file, "utf8");
      userCfg = aggiornaTestoUserCfg(testo, imp.versione) === testo;
    } catch {
      userCfg = false;
    }
  }
  return { variabile, userCfg, fileUserCfg: file };
}

export async function attivaTelemetriaGioco(imp, lingua = "it") {
  const T = testi(lingua);
  const messaggi = [];
  if (process.platform === "win32") {
    const r = await esegui("setx", [VARIABILE, "true"]);
    messaggi.push(r.ok ? T.tVariabileOk : T.tVariabileNo(r.testo.trim()));
  }
  const file = percorsoUserCfg(imp);
  if (!file) {
    messaggi.push(T.tNoCartella);
  } else {
    try {
      const esiste = fs.existsSync(file);
      const prima = esiste ? fs.readFileSync(file, "utf8") : "";
      const dopo = aggiornaTestoUserCfg(prima, imp.versione);
      if (dopo === prima) {
        messaggi.push(T.tCfgGiaPronto(imp.versione));
      } else {
        // Copia di sicurezza, solo la prima volta
        const copia = `${file}.prima-di-telemetria-sc`;
        if (esiste && !fs.existsSync(copia)) fs.copyFileSync(file, copia);
        fs.writeFileSync(file, dopo, "utf8");
        messaggi.push(esiste ? T.tCfgAggiornato(imp.versione) : T.tCfgCreato(imp.versione));
      }
    } catch (e) {
      messaggi.push(T.tCfgErrore(e.code === "EPERM" || e.code === "EACCES" ? T.tPermesso : e.message));
    }
  }
  messaggi.push(T.tRiavvia);
  return { messaggi, stato: await statoTelemetriaGioco(imp) };
}
