// Testi della schermata in italiano e inglese.
import { createContext, useContext } from "react";

export const TESTI = {
  it: {
    server: "SERVER", registro: "REGISTRO EVENTI", sistemi: "SISTEMI", armi: "ARMI", pilota: "PILOTA",
    metodi: { icmp: "DIRETTO", tcp: "STIMA · TCP", datacenter: "STIMA · DATACENTER", rete: "SERVER NON MISURABILE" },
    ricerca: "RICERCA…",
    msPing: "MS · PING", msStimato: "MS · STIMATO",
    persi: "PERSI", verso: "VERSO", reteGoogle: "RETE → GOOGLE", serverParola: "server",
    nessunServer: "Nessun server: entra nell'universo di gioco",
    regione: "REGIONE", connesso: "CONNESSO", shard: "SHARD", ip: "IP", ambiente: "AMBIENTE", build: "BUILD",
    nessunEvento: "Nessun evento",
    nessunaNave: "NESSUNA NAVE", siediti: "Siediti ai comandi di una nave",
    spool: "SPOOL", atterrata: "ATTERRATA", inVolo: "IN VOLO", carrello: "CARRELLO", luci: "LUCI",
    altitudine: "ALTITUDINE", velVerticale: "VEL. VERTICALE", altRadar: "ALT. RADAR", prua: "PRUA", scafo: "SCAFO",
    ifcs: "IFCS", potenza: "POTENZA",
    boostAttivo: "BOOST ATTIVO", idrogeno: "IDROGENO", quantum: "QUANTUM", scudi: "SCUDI", boost: "BOOST",
    gimbal: "GIMBAL BLOCCATI", pronte: "PRONTE", nessunDato: "NESSUN DATO", decoy: "DECOY", noise: "NOISE", preset: "PRESET",
    ariaOk: "ARIA OK", noAria: "NO ARIA", salute: "SALUTE", ossigeno: "OSSIGENO", posizione: "POSIZIONE",
    gioco: "GIOCO", log: "LOG", telem: "TELEM", apriImpostazioni: "Apri le Impostazioni (F2)",
    avvisi: {
      collegamento: "Collegamento interrotto con il motore della telemetria",
      log: "Game.log non trovato: controlla la cartella del gioco nelle Impostazioni",
      chiuso: "Star Citizen è chiuso: i dati compariranno quando avvii il gioco",
      telemetria: "Telemetria non ricevuta: Impostazioni → Attiva telemetria nel gioco. Ping e server funzionano comunque",
    },
    stati: {
      SCM: "SCM", NAVIGATION: "NAV", STEALTH: "STEALTH",
      RETRACTED: "SU", DEPLOYED: "GIÙ", DEPLOYING: "IN DISCESA", RETRACTING: "IN SALITA",
      SEATED: "SEDUTO", ON_FOOT: "A PIEDI", EVA: "EVA",
      PILOT: "PILOTA", GUNNER: "ARTIGLIERE", CREW: "EQUIPAGGIO",
    },
    cardinali: { 0: "N", 90: "E", 180: "S", 270: "O" },
    locale: "it-IT",
  },
  en: {
    server: "SERVER", registro: "EVENT LOG", sistemi: "SYSTEMS", armi: "WEAPONS", pilota: "PILOT",
    metodi: { icmp: "DIRECT", tcp: "ESTIMATE · TCP", datacenter: "ESTIMATE · DATACENTER", rete: "SERVER NOT MEASURABLE" },
    ricerca: "SEARCHING…",
    msPing: "MS · PING", msStimato: "MS · ESTIMATED",
    persi: "LOST", verso: "TARGET", reteGoogle: "NET → GOOGLE", serverParola: "server",
    nessunServer: "No server: join the game universe",
    regione: "REGION", connesso: "CONNECTED", shard: "SHARD", ip: "IP", ambiente: "ENVIRONMENT", build: "BUILD",
    nessunEvento: "No events",
    nessunaNave: "NO SHIP", siediti: "Sit at the controls of a ship",
    spool: "SPOOL", atterrata: "LANDED", inVolo: "FLYING", carrello: "GEAR", luci: "LIGHTS",
    altitudine: "ALTITUDE", velVerticale: "VERT. SPEED", altRadar: "RADAR ALT.", prua: "HEADING", scafo: "HULL",
    ifcs: "IFCS", potenza: "POWER",
    boostAttivo: "BOOST ACTIVE", idrogeno: "HYDROGEN", quantum: "QUANTUM", scudi: "SHIELDS", boost: "BOOST",
    gimbal: "GIMBALS LOCKED", pronte: "READY", nessunDato: "NO DATA", decoy: "DECOY", noise: "NOISE", preset: "PRESET",
    ariaOk: "AIR OK", noAria: "NO AIR", salute: "HEALTH", ossigeno: "OXYGEN", posizione: "POSITION",
    gioco: "GAME", log: "LOG", telem: "TELEM", apriImpostazioni: "Open Settings (F2)",
    avvisi: {
      collegamento: "Connection to the telemetry engine lost",
      log: "Game.log not found: check the game folder in Settings",
      chiuso: "Star Citizen is closed: data will appear when you start the game",
      telemetria: "No telemetry received: Settings → Enable telemetry in game. Ping and server info work anyway",
    },
    stati: {
      SCM: "SCM", NAVIGATION: "NAV", STEALTH: "STEALTH",
      RETRACTED: "UP", DEPLOYED: "DOWN", DEPLOYING: "LOWERING", RETRACTING: "RAISING",
      SEATED: "SEATED", ON_FOOT: "ON FOOT", EVA: "EVA",
      PILOT: "PILOT", GUNNER: "GUNNER", CREW: "CREW",
    },
    cardinali: { 0: "N", 90: "E", 180: "S", 270: "W" },
    locale: "en-US",
  },
};

// La regione arriva dal motore in italiano (es. "Europa Ovest"): la traduciamo parola per parola.
const PAROLE_REGIONE = {
  Europa: "Europe", America: "US", "Asia-Pacifico": "Asia-Pacific", Australia: "Australia",
  Ovest: "West", Est: "East", Centro: "Central", Nord: "North", Sud: "South",
  Menu: "Main", principale: "menu",
};
export function traduciRegione(regione, lingua) {
  if (!regione || lingua === "it") return regione;
  return regione.split(" ").map((p) => PAROLE_REGIONE[p] ?? p).join(" ");
}

export function linguaBrowser() {
  return String(navigator.language || "").toLowerCase().startsWith("it") ? "it" : "en";
}

export const ContestoLingua = createContext(TESTI.it);
export const useT = () => useContext(ContestoLingua);
