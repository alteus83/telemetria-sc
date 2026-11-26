// Impostazioni dell'app: lette e salvate in un file nella cartella dati
// dell'utente (su Windows: %APPDATA%\Telemetria SC\impostazioni.json).

import fs from "node:fs";
import path from "node:path";

export const PREDEFINITE = {
  avvioConPC: false, // parte all'accensione del PC (scelta dell'utente)
  aperturaAutomatica: true, // apre/chiude la schermata con il gioco
  schermoIntero: true,
  canale: "AUTO", // scelta dell'utente: "AUTO" (riconosce da solo), "LIVE" o "PTU"
  versione: "LIVE", // canale in uso adesso (LIVE, PTU, EPTU...): l'ultimo riconosciuto o quello scelto
  cartellaGioco: null, // es. C:\Giochi\StarCitizen (null = da cercare)
  monitorId: null, // id del monitor scelto (null = il secondo, se c'è)
  portaWeb: 8787,
  lingua: "AUTO", // "AUTO" (quella di Windows), "it" o "en"
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

// Riconoscimento di riserva: il canale il cui Game.log è stato modificato da poco
// (il gioco lo crea appena parte). Restituisce { canale, cartellaCanale, cartellaGioco, gameLog } o null.
const CANALI = ["LIVE", "PTU", "EPTU", "TECH-PREVIEW", "HOTFIX"];
export function canaleDaLogRecente(cartellaGioco, entroMs = 120000) {
  if (!cartellaGioco) return null;
  let migliore = null;
  for (const canale of CANALI) {
    const gameLog = path.join(cartellaGioco, canale, "Game.log");
    try {
      const t = fs.statSync(gameLog).mtimeMs;
      if (Date.now() - t <= entroMs && (!migliore || t > migliore.t)) {
        migliore = { t, canale, cartellaCanale: path.join(cartellaGioco, canale), cartellaGioco, gameLog };
      }
    } catch {
      /* canale non installato */
    }
  }
  if (!migliore) return null;
  const { t, ...info } = migliore;
  return info;
}

export function percorsoGameLog(imp) {
  if (!imp.cartellaGioco) return "";
  return path.join(imp.cartellaGioco, imp.versione || "LIVE", "Game.log");
}

// Accetta sia la cartella principale sia una sottocartella LIVE/PTU scelta per sbaglio.
export function normalizzaCartella(scelta) {
  if (!scelta) return null;
  const base = path.basename(scelta).toUpperCase();
  return ["LIVE", "PTU", "EPTU", "HOTFIX", "TECH-PREVIEW"].includes(base) ? path.dirname(scelta) : scelta;
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
    // Versioni fino alla 2.1.x non avevano la scelta automatica: la attiviamo.
    if (!("canale" in salvate)) imp.canale = "AUTO";
    if (!imp.cartellaGioco) imp.cartellaGioco = cercaCartellaGioco();
    return imp;
  }

  function salva(imp) {
    fs.mkdirSync(cartellaDati, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(imp, null, 2), "utf8");
  }

  return { leggi, salva, file };
}
