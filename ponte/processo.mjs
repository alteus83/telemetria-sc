// Controlla se Star Citizen è aperto, guardando l'elenco dei programmi in
// esecuzione di Windows (comando "tasklist"). Su altri sistemi non si può
// sapere: lo stato resta "null" (sconosciuto) e il resto funziona lo stesso.

import { execFile } from "node:child_process";

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

// onCambio(aperto) viene chiamato solo quando lo stato cambia.
export function avviaControlloGioco(intervallo = 3000, onCambio) {
  const stato = { aperto: null };
  let occupato = false;

  async function controlla() {
    if (occupato) return;
    occupato = true;
    try {
      const aperto = await giocoInEsecuzione();
      if (aperto !== stato.aperto) {
        stato.aperto = aperto;
        onCambio?.(aperto);
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
