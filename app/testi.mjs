// Testi dell'app (menu dell'icona, notifiche, finestre) in italiano e inglese.
import { linguaDiSistema } from "../ponte/eventi.mjs";

const TESTI = {
  it: {
    giocoAperto: "Star Citizen: aperto",
    giocoChiuso: "Star Citizen: chiuso",
    giocoSconosciuto: "Star Citizen: —",
    apriSchermata: "Apri schermata",
    impostazioni: "Impostazioni…",
    installaAgg: (v) => `Installa aggiornamento ${v} e riavvia`,
    esci: "Esci",
    titoloImpostazioni: "Telemetria SC — Impostazioni",
    sfoglia: "Scegli la cartella di Star Citizen (quella che contiene LIVE e PTU)",
    erroreAvvio: (e) => `L'app non è riuscita a partire:\n\n${e}`,
    aggProntoTitolo: "Telemetria SC: aggiornamento pronto",
    aggProntoTesto: (v) => `La versione ${v} è pronta. Clicca qui per installarla (oppure si installerà alla chiusura dell'app).`,
    tVariabileOk: "✓ Variabile di Windows impostata",
    tVariabileNo: (m) => `✗ Variabile di Windows: ${m}`,
    tNoCartella: "✗ Cartella del gioco non impostata",
    tCfgGiaPronto: (v) => `✓ user.cfg (${v}) già pronto`,
    tCfgAggiornato: (v) => `✓ user.cfg (${v}) aggiornato`,
    tCfgCreato: (v) => `✓ user.cfg (${v}) creato`,
    tCfgErrore: (m) => `✗ user.cfg: ${m}`,
    tPermesso: "permesso negato",
    tRiavvia: "Ora chiudi del tutto l'RSI Launcher (anche dall'icona vicino all'orologio) e riavvia il gioco.",
  },
  en: {
    giocoAperto: "Star Citizen: running",
    giocoChiuso: "Star Citizen: closed",
    giocoSconosciuto: "Star Citizen: —",
    apriSchermata: "Open display",
    impostazioni: "Settings…",
    installaAgg: (v) => `Install update ${v} and restart`,
    esci: "Quit",
    titoloImpostazioni: "Telemetria SC — Settings",
    sfoglia: "Choose the Star Citizen folder (the one containing LIVE and PTU)",
    erroreAvvio: (e) => `The app could not start:\n\n${e}`,
    aggProntoTitolo: "Telemetria SC: update ready",
    aggProntoTesto: (v) => `Version ${v} is ready. Click here to install it (or it will be installed when the app closes).`,
    tVariabileOk: "✓ Windows variable set",
    tVariabileNo: (m) => `✗ Windows variable: ${m}`,
    tNoCartella: "✗ Game folder not set",
    tCfgGiaPronto: (v) => `✓ user.cfg (${v}) already set`,
    tCfgAggiornato: (v) => `✓ user.cfg (${v}) updated`,
    tCfgCreato: (v) => `✓ user.cfg (${v}) created`,
    tCfgErrore: (m) => `✗ user.cfg: ${m}`,
    tPermesso: "permission denied",
    tRiavvia: "Now fully close the RSI Launcher (also from the icon next to the clock) and restart the game.",
  },
};

// scelta: "AUTO", "it" o "en". locale: lingua di Windows (app.getLocale()).
export function linguaEffettiva(scelta, locale) {
  if (scelta === "it" || scelta === "en") return scelta;
  return linguaDiSistema(locale);
}

export function testi(lingua) {
  return TESTI[lingua] ?? TESTI.en;
}
