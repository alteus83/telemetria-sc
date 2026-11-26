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

// Servizio standard "reflection" (solo per la diagnosi: elenca i servizi di una porta)
const Riflessione = ["v1", "v1alpha"].map((v) => {
  const def = protoLoader.loadSync(`grpc/reflection/${v}/reflection.proto`, {
    includeDirs: [path.join(cartella, "proto")],
    keepCase: true,
    defaults: true,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(def).grpc.reflection[v].ServerReflection;
});

function elencaServizi(indirizzo) {
  const prova = (Classe) =>
    new Promise((risolvi) => {
      const c = new Classe(indirizzo, grpc.credentials.createInsecure());
      const flusso = c.ServerReflectionInfo({ deadline: Date.now() + 3000 });
      let fatto = false;
      const fine = (v) => {
        if (fatto) return;
        fatto = true;
        c.close();
        risolvi(v);
      };
      flusso.on("data", (r) => fine((r.list_services_response?.service ?? []).map((x) => x.name)));
      flusso.on("error", () => fine(null));
      flusso.on("end", () => fine(null));
      flusso.write({ list_services: "" });
      flusso.end();
    });
  return prova(Riflessione[0]).then((r) => r ?? prova(Riflessione[1]));
}

// Capisce cosa c'è su una porta che accetta connessioni ma non manda dati.
export async function diagnosticaPorta(host, porta) {
  const indirizzo = `${host}:${porta}`;
  const c = new Servizio(indirizzo, grpc.credentials.createInsecure());
  const r = await new Promise((risolvi) =>
    c.ListTriggerableActions({}, { deadline: Date.now() + 3000 }, (err, risposta) => risolvi({ err, risposta }))
  );
  c.close();
  if (!r.err) {
    return { tipo: "telemetria", testo: `è il servizio di telemetria (${r.risposta?.actions?.length ?? 0} azioni disponibili)` };
  }
  if (r.err.code === grpc.status.UNIMPLEMENTED) {
    const servizi = await elencaServizi(indirizzo);
    const conosciuto = servizi?.some((n) => /GameTelemetryService/i.test(n));
    if (conosciuto) return { tipo: "telemetria", testo: `è il servizio di telemetria (servizi: ${servizi.join(", ")})` };
    return {
      tipo: "grpc",
      testo: servizi
        ? `è un server gRPC ma senza il servizio di telemetria conosciuto; servizi: ${servizi.join(", ") || "nessuno"}`
        : "è un server gRPC ma non dice quali servizi offre (forse la telemetria con un nome diverso)",
    };
  }
  return { tipo: "altro", testo: `non è un servizio gRPC (${r.err.details || r.err.message})` };
}

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
// porteGioco: funzione che restituisce le porte su cui il gioco sta ascoltando
// (trovate da Windows): le proviamo insieme a quelle note.
// attesaDati: quanti ms aspettare i primi dati da una porta prima di passare alla successiva.
export function avviaTelemetria({
  host, porte, portaDalLog, porteGioco = () => [], onDati, onEvento, scrivi = () => {}, attesaDati = 8000,
}) {
  const giaSegnalate = new Map(); // porta -> ultimo motivo scritto nel registro
  const diagnosticate = new Set(); // porte già esaminate
  let portaConfermata = null; // porta su cui la diagnosi ha trovato la telemetria
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
  let timerSorveglia = null;

  const timerContatore = setInterval(() => {
    stato.pacchettiAlSecondo = contatore;
    contatore = 0;
    if (stato.ultimoPacchetto && Date.now() - stato.ultimoPacchetto > 3000) stato.connesso = false;
  }, 1000);

  function prossimaPorta() {
    if (portaConfermata) return portaConfermata;
    const dalLog = portaDalLog();
    const elenco = [...new Set([dalLog, ...porte, ...porteGioco()].filter(Boolean))];
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
    let ultimaAttivita = Date.now();

    // Sorveglianza: una porta che accetta la connessione ma non manda dati non deve
    // bloccare tutto. Dopo un po' la esaminiamo, lo scriviamo nel registro e passiamo oltre.
    const sorveglia = setInterval(() => {
      const limite = ricevuto ? 10000 : porta === portaConfermata ? 60000 : attesaDati;
      if (Date.now() - ultimaAttivita < limite) return;
      clearInterval(sorveglia);
      const motivo = ricevuto ? "dati interrotti" : `connessione aperta ma nessun dato in ${Math.round(limite / 1000)} s`;
      if (!ricevuto && !diagnosticate.has(porta)) {
        diagnosticate.add(porta);
        diagnosticaPorta(host, porta)
          .then((d) => {
            scrivi(`Telemetria: porta ${porta}: ${motivo}; ${d.testo}`);
            if (d.tipo === "telemetria") {
              portaConfermata = porta;
              scrivi(`Telemetria: resto sulla porta ${porta} e aspetto i dati (il personaggio deve essere in gioco)`);
            }
          })
          .catch((e) => scrivi(`Telemetria: porta ${porta}: ${motivo}; diagnosi non riuscita (${e.message})`));
      } else if (ricevuto) {
        scrivi(`Telemetria: porta ${porta}: ${motivo}, mi ricollego`);
      }
      const vecchia = chiamata;
      riprova(motivo);
      vecchia?.on("error", () => {});
      vecchia?.cancel();
    }, 1000);
    timerSorveglia = sorveglia;

    chiamata.on("data", (frame) => {
      ultimaAttivita = Date.now();
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
      clearInterval(sorveglia);
      if (stato.connesso && ricevuto) onEvento?.({ k: "telemetriaPersa" });
      stato.connesso = false;
      stato.errore = motivo;
      chiamata?.removeAllListeners();
      chiamata = null;
      if (!fermato) timerRiprova = setTimeout(collega, 2000);
    };
    chiamata.on("error", (e) => {
      const motivo = e.details || e.message;
      // La porta confermata non risponde più (gioco chiuso o riavviato): ricominciamo a cercare.
      if (porta === portaConfermata && /ECONNREFUSED|UNAVAILABLE/i.test(motivo)) portaConfermata = null;
      if (!ricevuto && giaSegnalate.get(porta) !== motivo) {
        giaSegnalate.set(porta, motivo);
        scrivi(`Telemetria: porta ${porta} non risponde (${motivo})`);
      }
      riprova(motivo);
    });
    chiamata.on("end", () => riprova("Flusso terminato dal gioco"));
  }

  collega();
  stato.ferma = () => {
    fermato = true;
    clearInterval(timerSorveglia);
    clearInterval(timerContatore);
    clearTimeout(timerRiprova);
    chiamata?.removeAllListeners();
    chiamata?.on("error", () => {}); // l'annullamento genera un errore che ignoriamo
    chiamata?.cancel();
    client?.close();
  };
  return stato;
}
