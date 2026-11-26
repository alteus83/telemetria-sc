// Controlla se Star Citizen è aperto (elenco dei programmi di Windows, comando
// "tasklist") e, quando parte, da quale cartella è stato avviato:
//   C:\...\StarCitizen\LIVE\Bin64\StarCitizen.exe  ->  canale LIVE
//   C:\...\StarCitizen\PTU\Bin64\StarCitizen.exe   ->  canale PTU
// Così l'app sa da sola quale Game.log leggere.
// Su altri sistemi non si può sapere: lo stato resta "null" (sconosciuto).

import { execFile } from "node:child_process";
import path from "node:path";

const NOME_ESEGUIBILE = "StarCitizen.exe";

function giocoInEsecuzione() {
  return new Promise((risolvi) => {
    if (process.platform !== "win32") return risolvi(null);
    execFile(
      "tasklist",
      ["/FI", `IMAGENAME eq ${NOME_ESEGUIBILE}`, "/FO", "CSV", "/NH"],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        if (err) return risolvi(null);
        risolvi(String(stdout).toLowerCase().includes(NOME_ESEGUIBILE.toLowerCase()));
      }
    );
  });
}

function percorsoEseguibile() {
  return new Promise((risolvi) => {
    if (process.platform !== "win32") return risolvi(null);
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        // Get-Process a volte non legge il percorso (protezione anti-cheat): proviamo anche CIM.
        "$p = (Get-Process -Name StarCitizen -ErrorAction SilentlyContinue | Select-Object -First 1).Path; " +
          "if (-not $p) { $p = (Get-CimInstance Win32_Process -Filter \"Name='StarCitizen.exe'\" -ErrorAction SilentlyContinue | Select-Object -First 1).ExecutablePath }; $p",
      ],
      { timeout: 15000, windowsHide: true },
      (err, stdout) => risolvi(err ? null : String(stdout).trim() || null)
    );
  });
}

// Dal percorso dell'eseguibile ricava canale (LIVE, PTU, EPTU, ...) e cartelle.
export function canaleDaPercorso(percorsoExe) {
  if (!percorsoExe) return null;
  const p = path.win32;
  const bin = p.dirname(percorsoExe); // ...\PTU\Bin64
  const cartellaCanale = p.basename(bin).toLowerCase() === "bin64" ? p.dirname(bin) : bin;
  const canale = p.basename(cartellaCanale).toUpperCase();
  if (!canale) return null;
  return {
    canale,
    cartellaCanale,
    cartellaGioco: p.dirname(cartellaCanale),
    gameLog: p.join(cartellaCanale, "Game.log"),
  };
}

// Porte su cui il gioco sta ascoltando ed è raggiungibile da questo PC
// (indirizzo 0.0.0.0, 127.0.0.1, :: o ::1). Tra queste potrebbe esserci la telemetria.
export function porteInAscolto() {
  return new Promise((risolvi) => {
    if (process.platform !== "win32") return risolvi([]);
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$g = Get-Process -Name StarCitizen -ErrorAction SilentlyContinue; if ($g) { " +
          "Get-NetTCPConnection -State Listen -OwningProcess $g.Id -ErrorAction SilentlyContinue | " +
          "ForEach-Object { $_.LocalAddress + ' ' + $_.LocalPort } }",
      ],
      { timeout: 15000, windowsHide: true },
      (err, stdout) => {
        if (err) return risolvi([]);
        const porte = new Set();
        for (const riga of String(stdout).split(/\r?\n/)) {
          const [indirizzo, porta] = riga.trim().split(/\s+/);
          if (porta && ["0.0.0.0", "127.0.0.1", "::", "::1"].includes(indirizzo)) porte.add(Number(porta));
        }
        risolvi([...porte].filter((p) => p > 0));
      }
    );
  });
}

// onCambio(aperto, info) viene chiamato solo quando lo stato cambia.
// info = { canale, cartellaCanale, cartellaGioco, gameLog } se si è capito da dove parte.
// onPorte(porte) viene chiamato quando cambia l'elenco delle porte in ascolto del gioco.
export function avviaControlloGioco(intervallo = 3000, onCambio, onPorte) {
  const stato = { aperto: null, info: null, porte: [] };
  let occupato = false;
  let giri = 0;

  async function controlla() {
    if (occupato) return;
    occupato = true;
    try {
      const aperto = await giocoInEsecuzione();
      if (aperto !== stato.aperto) {
        stato.aperto = aperto;
        stato.info = aperto ? canaleDaPercorso(await percorsoEseguibile()) : null;
        if (!aperto) stato.porte = [];
        onCambio?.(aperto, stato.info);
      }
      // A gioco aperto, ogni ~15 secondi ricontrolliamo le porte in ascolto.
      if (aperto && giri++ % 5 === 0) {
        const porte = await porteInAscolto();
        if (porte.join(",") !== stato.porte.join(",")) {
          stato.porte = porte;
          onPorte?.(porte);
        }
      }
    } finally {
      occupato = false;
    }
  }

  controlla();
  const timer = setInterval(controlla, intervallo);
  stato.ferma = () => clearInterval(timer);
  return stato;
}
