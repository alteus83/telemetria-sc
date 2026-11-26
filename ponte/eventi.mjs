// Testi del registro eventi in italiano e inglese.
// Gli eventi viaggiano come codici ({ k, p }) e diventano testo solo quando
// vengono mostrati, nella lingua scelta.

const TESTI = {
  it: {
    avvioLog: "Gioco avviato (nuovo log)",
    join: "Entrato nell'universo: shard {shard}",
    shard: "Cambio shard: {shard}",
    portaTelemetria: "Telemetria del gioco attiva sulla porta {porta}",
    morte: "Morte registrata nel log",
    telemetriaOk: "Telemetria collegata (porta {porta})",
    telemetriaPersa: "Telemetria persa, riprovo…",
    demo: "Modalità DEMO: dati simulati",
    colpo: "Colpo agli scudi",
    ACTOR_SPAWN: "Personaggio comparso",
    ACTOR_DEAD: "Personaggio morto",
    ACTOR_ENTER_SEAT: "Seduto",
    ACTOR_LEAVE_SEAT: "Alzato dal sedile",
    ACTOR_RESPAWN: "Rinascita",
    ACTOR_DOWNED: "A terra (ferito)",
  },
  en: {
    avvioLog: "Game started (new log)",
    join: "Joined the universe: shard {shard}",
    shard: "Shard changed: {shard}",
    portaTelemetria: "Game telemetry active on port {porta}",
    morte: "Death recorded in the log",
    telemetriaOk: "Telemetry connected (port {porta})",
    telemetriaPersa: "Telemetry lost, retrying…",
    demo: "DEMO mode: simulated data",
    colpo: "Shield hit",
    ACTOR_SPAWN: "Character spawned",
    ACTOR_DEAD: "Character died",
    ACTOR_ENTER_SEAT: "Seated",
    ACTOR_LEAVE_SEAT: "Left the seat",
    ACTOR_RESPAWN: "Respawned",
    ACTOR_DOWNED: "Downed",
  },
};

export function testoEvento(evento, lingua = "it") {
  if (typeof evento === "string") return evento;
  const modello = (TESTI[lingua] ?? TESTI.it)[evento.k] ?? TESTI.it[evento.k] ?? evento.k;
  return modello.replace(/\{(\w+)\}/g, (_, nome) => evento.p?.[nome] ?? "");
}

// "it" se il sistema è in italiano, altrimenti "en".
export function linguaDiSistema(locale) {
  const l = String(locale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? "").toLowerCase();
  return l.startsWith("it") ? "it" : "en";
}
