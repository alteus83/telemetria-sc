// Configurazione del ponte.
// I valori qui sotto sono quelli predefiniti. Per cambiarli senza toccare il
// codice, crea il file ponte/config.json (vedi ponte/config.esempio.json):
// ogni chiave presente lì sostituisce quella qui sotto.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cartella = path.dirname(fileURLToPath(import.meta.url));

const predefiniti = {
  // Porta della pagina web e del flusso dati verso lo schermo.
  portaWeb: 8787,
  // true = la pagina è raggiungibile anche da altri dispositivi in casa
  // (telefono, tablet). false = solo da questo PC.
  apriInRete: false,

  // Percorso del Game.log di Star Citizen (cartella LIVE o PTU).
  gameLog: "C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log",

  // Telemetria locale del gioco (gRPC). Se il Game.log indica una porta,
  // viene usata quella; altrimenti si provano queste in ordine.
  telemetriaHost: "127.0.0.1",
  telemetriaPorte: [2942, 29420, 50051],

  // Ogni quanti millisecondi misurare il ping verso il server di gioco.
  intervalloPing: 2000,
  // Lingua della schermata: "auto" (quella del sistema), "it" o "en".
  lingua: "auto",
  // Quante volte al secondo inviare i dati allo schermo.
  aggiornamentiAlSecondo: 10,
};

export function caricaConfigurazione() {
  const file = path.join(cartella, "config.json");
  let personali = {};
  if (fs.existsSync(file)) {
    try {
      personali = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.error(`[config] config.json non valido, uso i valori predefiniti: ${e.message}`);
    }
  }
  return { ...predefiniti, ...personali };
}
