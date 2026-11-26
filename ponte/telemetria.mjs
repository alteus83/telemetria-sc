// Collegamento alla telemetria locale di Star Citizen (gRPC su 127.0.0.1).
// Le definizioni del protocollo (cartella proto/) vengono dal progetto
// open source "Verse Data Gateway" (licenza Apache-2.0): non sono un SDK
// ufficiale di CIG e potrebbero cambiare con le patch del gioco.

import path from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const cartella = path.dirname(fileURLToPath(import.meta.url));
const NON_VALIDO = 1e30; // il gioco usa 3.4e38 per "valore non disponibile"

const definizione = protoLoader.loadSync("sc/game/telemetry/v1/api.proto", {
  includeDirs: [path.join(cartella, "proto")],
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});
const pacchetto = grpc.loadPackageDefinition(definizione);
const Servizio = pacchetto.sc.game.telemetry.v1.GameTelemetryService;

// ---------------------------------------------------------------------------
// Conversione dei dati grezzi in un formato semplice per lo schermo
// ---------------------------------------------------------------------------
const valido = (v) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < NON_VALIDO ? v : null);
const ultimaParte = (s) => (s ? String(s).split("_").pop() : null);
const disponibilita = (a) => (a ? { attivo: !!a.active, abilitato: !!a.enabled } : null);

function gauge(g) {
  if (!g || !g.max) return null;
  return { attuale: g.current, massimo: g.max, rapporto: g.current / g.max };
}

function normalizzaNave(v) {
  const s = v?.state;
  if (!s) return null;
  const volo = s.flight ?? {};
  const strum = volo.instruments ?? {};
  const imp = volo.settings ?? {};
  const spie = s.annunciators ?? {};
  const pot = s.power ?? {};
  return {
    nome: s.name || s.class_name || "Sconosciuta",
    produttore: s.manufacturer || null,
    tipo: ultimaParte(s.type),
    luci: !!s.lights_enabled,
    scafo: valido(s.health),
    modalita: ultimaParte(s.master_mode?.mode),
    spool: !!s.master_mode?.spooled,
    atterrata: !!volo.state?.is_landed,
    carrello: ultimaParte(volo.state?.gear),
    volo: {
      velocita: valido(strum.speed),
      velocitaVerticale: valido(strum.vertical_speed_indicator),
      altitudine: valido(strum.altitude),
      altitudineRadar: valido(strum.radar_altitude),
      prua: valido(strum.heading),
      g: strum.g_meter ? valido(strum.g_meter.current) : null,
      densita: valido(strum.atmospheric_density),
    },
    sistemi: {
      scudi: valido(s.shields?.level),
      facceScudi: (s.shields?.faces ?? []).map(valido),
      idrogeno: valido(strum.hydrogen_fuel),
      quantum: valido(strum.quantum_fuel),
      boost: strum.boost
        ? { attivo: !!strum.boost.engaged, riserva: valido(strum.boost.reserves), critico: !!strum.boost.critical }
        : null,
    },
    spie: Object.fromEntries(Object.entries(spie).map(([k, val]) => [k, ultimaParte(val)])),
    ifcs: {
      CPL: disponibilita(imp.ifcs_coupled),
      ESP: disponibilita(imp.ifcs_esp),
      GRC: disponibilita(imp.ifcs_gravity_compensation),
      GSF: disponibilita(imp.ifcs_g_safe),
      CRU: disponibilita(imp.ifcs_cruise_mode),
      LIM: disponibilita(imp.ifcs_speed_limiter),
      PRX: disponibilita(imp.ifcs_proximity_assist),
      ATT: disponibilita(imp.ifcs_proximity_assist_landing),
      STB: disponibilita(imp.ifcs_stability),
      COR: disponibilita(imp.ifcs_core),
      VNT: disponibilita(imp.ifcs_wind_compensation),
      CMD: disponibilita(imp.ifcs_command_behaviour),
    },
    potenza: {
      REA: !!pot.powerplants,
      MOT: !!pot.engines,
      ARM: !!pot.weapons,
      RAF: !!pot.coolers,
      VIT: !!pot.life_support,
      GRA: !!pot.gravity_generators,
      SEN: !!pot.sensors,
      GSC: !!pot.shield_generators,
      ESC: !!pot.shield_emitters,
    },
  };
}

function normalizzaArmi(w) {
  if (!w) return null;
  const lista = w.weapons ?? [];
  const contro = Object.fromEntries((w.countermeasures ?? []).map((c) => [ultimaParte(c.type), c.amount]));
  return {
    pronte: lista.filter((a) => a.ready_to_fire).length,
    totali: lista.length,
    preset: w.preset_name || String(w.preset_index ?? 0),
    gimbalBloccati: !!w.settings?.gimbals_locked,
    decoy: contro.DECOY ?? null,
    noise: contro.NOISE ?? null,
  };
}

function normalizzaPersonaggio(a) {
  if (!a) return null;
  const v = a.vitals ?? {};
  const st = a.state ?? {};
  return {
    salute: gauge(v.health),
    ossigeno: gauge(v.oxygen),
    fame: gauge(v.hunger),
    sete: gauge(v.thirst),
    battito: valido(v.heart_rate),
    gravita: valido(v.gravity),
    aria: !!a.environment?.breathable_atmosphere,
    temperaturaEsterna: valido(a.environment?.external_temperature),
    radiazioni: valido(a.environment?.ambient_radiation_rate),
    posizione: ultimaParte(st.locomotion),
    ruolo: ultimaParte(st.crew_role),
    sedile: st.seat_name || null,
    auec: typeof st.uec_balance === "number" ? st.uec_balance : null,
  };
}

export function normalizzaFrame(f) {
  return {
    nave: normalizzaNave(f.vehicle),
    armi: normalizzaArmi(f.weapons),
    personaggio: normalizzaPersonaggio(f.actor),
    // Codici degli eventi del gioco (es. ACTOR_ENTER_SEAT): il testo è in eventi.mjs
    eventi: (f.events?.events ?? []).map((e) => String(e.type).replace("GAME_EVENT_TYPE_", "")),
  };
}

// ---------------------------------------------------------------------------
// Connessione con nuovi tentativi automatici
// ---------------------------------------------------------------------------
export function avviaTelemetria({ host, porte, portaDalLog, onDati, onEvento }) {
  const stato = {
    connesso: false,
    porta: null,
    pacchettiAlSecondo: 0,
    ultimoPacchetto: null,
    errore: null,
  };
  let contatore = 0;
  let indice = 0;
  let chiamata = null;
  let client = null;
  let fermato = false;
  let timerRiprova = null;

  const timerContatore = setInterval(() => {
    stato.pacchettiAlSecondo = contatore;
    contatore = 0;
    if (stato.ultimoPacchetto && Date.now() - stato.ultimoPacchetto > 3000) stato.connesso = false;
  }, 1000);

  function prossimaPorta() {
    const dalLog = portaDalLog();
    const elenco = dalLog ? [dalLog, ...porte.filter((p) => p !== dalLog)] : porte;
    const porta = elenco[indice % elenco.length];
    indice += 1;
    return porta;
  }

  function collega() {
    if (fermato) return;
    const porta = prossimaPorta();
    client?.close();
    client = new Servizio(`${host}:${porta}`, grpc.credentials.createInsecure());
    chiamata = client.TelemetryStream({});
    let ricevuto = false;

    chiamata.on("data", (frame) => {
      if (!ricevuto) {
        ricevuto = true;
        indice -= 1; // restiamo su questa porta ai prossimi tentativi
        onEvento?.({ k: "telemetriaOk", p: { porta } });
      }
      stato.connesso = true;
      stato.porta = porta;
      stato.errore = null;
      stato.ultimoPacchetto = Date.now();
      contatore += 1;
      onDati(normalizzaFrame(frame));
    });

    let chiusa = false;
    const riprova = (motivo) => {
      if (chiusa) return; // "error" ed "end" possono arrivare entrambi
      chiusa = true;
      if (stato.connesso && ricevuto) onEvento?.({ k: "telemetriaPersa" });
      stato.connesso = false;
      stato.errore = motivo;
      chiamata?.removeAllListeners();
      chiamata = null;
      if (!fermato) timerRiprova = setTimeout(collega, 2000);
    };
    chiamata.on("error", (e) => riprova(e.details || e.message));
    chiamata.on("end", () => riprova("Flusso terminato dal gioco"));
  }

  collega();
  stato.ferma = () => {
    fermato = true;
    clearInterval(timerContatore);
    clearTimeout(timerRiprova);
    chiamata?.removeAllListeners();
    chiamata?.on("error", () => {}); // l'annullamento genera un errore che ignoriamo
    chiamata?.cancel();
    client?.close();
  };
  return stato;
}
