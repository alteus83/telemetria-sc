// Impostazioni dell'app: lette e salvate in un file nella cartella dati
// dell'utente (su Windows: %APPDATA%\Telemetria SC\impostazioni.json).

import fs from "node:fs";
import path from "node:path";

export const PREDEFINITE = {
  avvioConPC: false, // parte all'accensione del PC (scelta dell'utente)
  aperturaAutomatica: true, // apre/chiude la schermata con il gioco
  schermoIntero: true,
  versione: "LIVE", // "LIVE" oppure "PTU"
  cartellaGioco: null, // es. C:\Giochi\StarCitizen (null = da cercare)
  monitorId: null, // id del monitor scelto (null = il secondo, se c'è)
  portaWeb: 8787,
};

// Posti dove di solito si trova Star Citizen. Si prova su più dischi.
const SOTTOCARTELLE = [
  "Program Files\\Roberts Space Industries\\StarCitizen",
  "Roberts Space Industries\\StarCitizen",
  "Giochi\\StarCitizen",
  "Games\\StarCitizen",
  "StarCitizen",
];

export function cercaCartellaGioco() {
  if (process.platform !== "win32") return null;
  for (const disco of ["C", "D", "E", "F", "G"]) {
    for (const sotto of SOTTOCARTELLE) {
      const candidata = `${disco}:\\${sotto}`;
      if (fs.existsSync(path.join(candidata, "LIVE")) || fs.existsSync(path.join(candidata, "PTU"))) {
        return candidata;
      }
    }
  }
  return null;
}

export function percorsoGameLog(imp) {
  if (!imp.cartellaGioco) return "";
  return path.join(imp.cartellaGioco, imp.versione === "PTU" ? "PTU" : "LIVE", "Game.log");
}

// Accetta sia la cartella principale sia una sottocartella LIVE/PTU scelta per sbaglio.
export function normalizzaCartella(scelta) {
  if (!scelta) return null;
  const base = path.basename(scelta).toUpperCase();
  return base === "LIVE" || base === "PTU" ? path.dirname(scelta) : scelta;
}

export function creaArchivio(cartellaDati) {
  const file = path.join(cartellaDati, "impostazioni.json");

  function leggi() {
    let salvate = {};
    try {
      salvate = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    } catch {
      /* prima apertura o file rovinato: si usano le predefinite */
    }
    const imp = { ...PREDEFINITE, ...salvate };
    if (!imp.cartellaGioco) imp.cartellaGioco = cercaCartellaGioco();
    return imp;
  }

  function salva(imp) {
    fs.mkdirSync(cartellaDati, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(imp, null, 2), "utf8");
  }

  return { leggi, salva, file };
}
