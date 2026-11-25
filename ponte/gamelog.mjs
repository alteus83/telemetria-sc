// Lettura del Game.log di Star Citizen.
// Il gioco scrive in questo file mentre gira: noi lo rileggiamo ogni mezzo
// secondo e analizziamo solo le righe nuove. Non modifichiamo mai il file e
// non tocchiamo la memoria del gioco.

import fs from "node:fs";

// Righe che ci interessano. Sono ricavate dall'osservazione del log
// (vedi anche il progetto komandio-mobisync): se CIG cambia il formato,
// basta aggiornare queste espressioni.
const MODELLI = {
  avvioLog: /Log started on/i,
  joinPU: /<Join PU>\s*address\[([^\]]+)\]\s*port\[(\d+)\]\s*shard\[([^\]]+)\]/i,
  nuovoShard: /<Update Shard Id>\s*New Shard Id:\s*(\S+)/i,
  connessione: /Connection requested to:\s*(\d[\d.]*)/i,
  sessione: /@session:\s*'([^']+)'/i,
  sessioneHost: /@host_session:\s*'([^']+)'/i,
  ambiente: /@env_session:\s*'([^']+)'/i,
  uptime: /Session Uptime:\s*(\d+)s/i,
  branch: /Branch:\s*(\S+)/i,
  changelist: /Changelist:\s*(\d+)/i,
  portaTelemetria: /Local services server is running on\s*([\d.]+):(\d+)/i,
  morte: /<Actor Death>/i,
};

const REGIONI = {
  eu: "Europa",
  us: "America",
  ap: "Asia-Pacifico",
  au: "Australia",
};
const ZONE = { w: "Ovest", e: "Est", c: "Centro", n: "Nord", s: "Sud" };

// Ricava una regione leggibile dal nome dello shard (es. "pub_euw1b_...").
export function regioneDaShard(shard) {
  if (!shard) return null;
  if (/local_shard/i.test(shard)) return "Menu principale";
  const m = String(shard).toLowerCase().match(/(?:^|[_-])(eu|us|ap|au)([wecns])?\d*/);
  if (!m) return null;
  return [REGIONI[m[1]], ZONE[m[2]]].filter(Boolean).join(" ");
}

export function statoServerVuoto() {
  return {
    ip: null,
    porta: null,
    shard: null,
    regione: null,
    sessione: null,
    ambiente: null,
    uptimeSecondi: null,
    uptimeLetto: null, // quando abbiamo letto l'uptime (per farlo avanzare)
    branch: null,
    changelist: null,
    portaTelemetria: null,
    connessoDa: null,
  };
}

// Analizza una riga e aggiorna lo stato. Restituisce un evento leggibile
// (stringa) se la riga è degna di comparire nel registro eventi.
export function analizzaRiga(riga, s, adesso = Date.now()) {
  let m;
  if (MODELLI.avvioLog.test(riga)) {
    Object.assign(s, statoServerVuoto());
    return "Gioco avviato (nuovo log)";
  }
  if ((m = riga.match(MODELLI.joinPU))) {
    s.ip = m[1];
    s.porta = Number(m[2]);
    s.shard = m[3];
    s.regione = regioneDaShard(m[3]);
    s.connessoDa = adesso;
    return `Entrato nell'universo: shard ${m[3]}`;
  }
  if ((m = riga.match(MODELLI.nuovoShard))) {
    s.shard = m[1];
    s.regione = regioneDaShard(m[1]) ?? s.regione;
    return `Cambio shard: ${m[1]}`;
  }
  if ((m = riga.match(MODELLI.connessione))) {
    if (s.ip !== m[1]) {
      s.ip = m[1];
      s.connessoDa = adesso;
    }
    return null;
  }
  if ((m = riga.match(MODELLI.sessioneHost))) {
    s.shard = s.shard ?? m[1];
    s.regione = s.regione ?? regioneDaShard(m[1]);
    return null;
  }
  if ((m = riga.match(MODELLI.ambiente))) {
    s.ambiente = m[1];
    return null;
  }
  if ((m = riga.match(MODELLI.sessione))) {
    s.sessione = m[1];
    return null;
  }
  if ((m = riga.match(MODELLI.uptime))) {
    s.uptimeSecondi = Number(m[1]);
    s.uptimeLetto = adesso;
    return null;
  }
  if ((m = riga.match(MODELLI.portaTelemetria))) {
    s.portaTelemetria = Number(m[2]);
    return `Telemetria del gioco attiva sulla porta ${m[2]}`;
  }
  if (!s.branch && (m = riga.match(MODELLI.branch))) {
    s.branch = m[1];
    return null;
  }
  if (!s.changelist && (m = riga.match(MODELLI.changelist))) {
    s.changelist = m[1];
    return null;
  }
  if (MODELLI.morte.test(riga)) {
    return "Morte registrata nel log";
  }
  return null;
}

// Segue il file nel tempo. onEvento(testo) viene chiamato per le righe
// importanti; lo stato del server è sempre disponibile in lettore.server.
export function avviaLettoreLog(percorso, onEvento) {
  const lettore = {
    server: statoServerVuoto(),
    trovato: false,
    errore: null,
  };
  let posizione = 0;
  let resto = "";
  let primaLettura = true;

  function leggi() {
    let info;
    try {
      info = fs.statSync(percorso);
    } catch {
      lettore.trovato = false;
      lettore.errore = "Game.log non trovato: controlla il percorso in ponte/config.json";
      return;
    }
    lettore.trovato = true;
    lettore.errore = null;

    // Il file è ricominciato da capo (gioco riavviato).
    if (info.size < posizione) {
      posizione = 0;
      resto = "";
      lettore.server = statoServerVuoto();
    }
    if (info.size === posizione) return;

    const fd = fs.openSync(percorso, "r");
    try {
      const lunghezza = info.size - posizione;
      const buffer = Buffer.alloc(lunghezza);
      fs.readSync(fd, buffer, 0, lunghezza, posizione);
      posizione = info.size;
      const testo = resto + buffer.toString("utf8");
      const righe = testo.split(/\r?\n/);
      resto = righe.pop() ?? "";
      for (const riga of righe) {
        const evento = analizzaRiga(riga, lettore.server);
        // Alla prima lettura il file contiene la storia passata: aggiorniamo
        // lo stato ma non riempiamo il registro con eventi vecchi.
        if (evento && !primaLettura) onEvento?.(evento);
      }
    } finally {
      fs.closeSync(fd);
    }
    primaLettura = false;
  }

  leggi();
  const timer = setInterval(leggi, 500);
  lettore.ferma = () => clearInterval(timer);
  return lettore;
}
