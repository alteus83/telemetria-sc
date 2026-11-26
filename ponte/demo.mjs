// Modalità dimostrativa: genera dati finti ma realistici, per provare lo
// schermo senza avere il gioco aperto. Si avvia con: npm run demo

export function avviaDemo({ onDati, onEvento }) {
  const server = {
    ip: "203.0.113.42", // indirizzo riservato agli esempi, non è un server vero
    porta: 64090,
    shard: "pub_euw1b_9876543_110",
    regione: "Europa Ovest",
    sessione: "demo-sessione",
    ambiente: "pub-sc-alpha-4.10",
    uptimeSecondi: 3600,
    uptimeLetto: Date.now(),
    branch: "sc-alpha-4.10.3",
    changelist: "0000000",
    portaTelemetria: 2942,
    connessoDa: Date.now() - 25 * 60 * 1000,
  };
  const ping = { ms: 38, metodo: "icmp", storico: [], perdite: 0, tentativi: 0 };
  const telemetria = { connesso: true, porta: 2942, pacchettiAlSecondo: 10, ultimoPacchetto: Date.now(), errore: null };

  let t = 0;
  let scudi = 1;
  const timerDati = setInterval(() => {
    t += 0.1;
    const vel = Math.max(0, 180 + Math.sin(t / 3) * 160);
    scudi = Math.min(1, scudi + 0.004);
    if (Math.random() < 0.01) {
      scudi = Math.max(0, scudi - 0.35);
      onEvento({ k: "colpo" });
    }
    telemetria.ultimoPacchetto = Date.now();
    onDati({
      nave: {
        nome: "Gladius",
        produttore: "Aegis Dynamics",
        tipo: "SPACESHIP",
        luci: Math.sin(t / 10) > 0,
        scafo: 0.92,
        modalita: "SCM",
        spool: true,
        atterrata: false,
        carrello: "RETRACTED",
        volo: {
          velocita: vel,
          velocitaVerticale: Math.cos(t / 3) * 12,
          altitudine: 31600 + Math.sin(t / 7) * 80,
          altitudineRadar: 31600 + Math.sin(t / 7) * 80,
          prua: (350 + t * 4) % 360,
          g: 1 + Math.sin(t) * 0.6,
          densita: 0,
        },
        sistemi: {
          scudi,
          facceScudi: [scudi, scudi * 0.9, scudi, scudi * 0.95],
          idrogeno: 0.87,
          quantum: 0.64,
          boost: { attivo: vel > 300, riserva: 0.7, critico: false },
        },
        spie: {
          pwr: "NOMINAL", wpn: scudi < 0.5 ? "MAJOR_ON" : "NOMINAL", thr: "NOMINAL", shld: scudi < 0.3 ? "MAJOR_FLASHING" : "NOMINAL",
          cool: "NOMINAL", qdrv: "OFF", radr: "NOMINAL", prox: "NOMINAL", hit: scudi < 0.7 ? "MINOR_ON" : "NOMINAL", misl: "NOMINAL",
        },
        ifcs: {
          CPL: { attivo: true, abilitato: true }, ESP: { attivo: true, abilitato: true }, GRC: { attivo: true, abilitato: true },
          GSF: { attivo: true, abilitato: true }, CRU: { attivo: false, abilitato: false }, LIM: { attivo: true, abilitato: true },
          PRX: { attivo: false, abilitato: true }, ATT: { attivo: false, abilitato: true }, STB: { attivo: true, abilitato: true },
          COR: { attivo: true, abilitato: true }, VNT: { attivo: true, abilitato: true }, CMD: { attivo: true, abilitato: true },
        },
        potenza: { REA: true, MOT: true, ARM: true, RAF: true, VIT: true, GRA: false, SEN: true, GSC: true, ESC: true },
      },
      armi: { pronte: 3, totali: 3, preset: "0", gimbalBloccati: true, decoy: 48, noise: 5 },
      personaggio: {
        salute: { attuale: 100, massimo: 100, rapporto: 1 },
        ossigeno: { attuale: 100, massimo: 100, rapporto: 1 },
        fame: null,
        sete: null,
        battito: 58 + Math.round(Math.sin(t) * 3),
        gravita: 0,
        aria: true,
        temperaturaEsterna: 21,
        radiazioni: 0,
        posizione: "SEATED",
        ruolo: "PILOT",
        sedile: "Pilota",
        auec: 14984695,
      },
      eventi: [],
    });
  }, 100);

  const timerPing = setInterval(() => {
    const valore = Math.random() < 0.03 ? null : Math.round(32 + Math.random() * 14 + (Math.random() < 0.1 ? 60 : 0));
    ping.ms = valore;
    ping.tentativi += 1;
    if (valore === null) ping.perdite += 1;
    ping.storico.push(valore);
    if (ping.storico.length > 60) ping.storico.shift();
  }, 2000);

  onEvento({ k: "demo" });
  return {
    server,
    ping,
    telemetria,
    lettore: { trovato: true, errore: null },
    ferma() {
      clearInterval(timerDati);
      clearInterval(timerPing);
    },
  };
}
