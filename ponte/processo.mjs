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
        "(Get-Process -Name StarCitizen -ErrorAction SilentlyContinue | Select-Object -First 1).Path",
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

// onCambio(aperto, info) viene chiamato solo quando lo stato cambia.
// info = { canale, cartellaCanale, cartellaGioco, gameLog } se si è capito da dove parte.
export function avviaControlloGioco(intervallo = 3000, onCambio) {
  const stato = { aperto: null, info: null };
  let occupato = false;

  async function controlla() {
    if (occupato) return;
    occupato = true;
    try {
      const aperto = await giocoInEsecuzione();
      if (aperto !== stato.aperto) {
        stato.aperto = aperto;
        stato.info = aperto ? canaleDaPercorso(await percorsoEseguibile()) : null;
        onCambio?.(aperto, stato.info);
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
