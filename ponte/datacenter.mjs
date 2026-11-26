// Stima del ping verso il datacenter del server di gioco.
// I server di Star Citizen girano su Google Cloud e non rispondono a misure
// dall'esterno. Però:
//  1. Google pubblica l'elenco ufficiale degli indirizzi IP di ogni datacenter
//     (www.gstatic.com/ipranges/cloud.json): dall'IP del server ricaviamo la regione.
//  2. Il progetto pubblico "gcping" (di Google) ha un punto di test in ogni regione:
//     misuriamo quanto ci mette a rispondere quello della stessa regione.
// Il risultato è una stima vicina al ping reale verso lo shard.

import https from "node:https";

const URL_REGIONI = "https://www.gstatic.com/ipranges/cloud.json";
const URL_GCPING = "https://global.gcping.com/api/endpoints";

const agente = new https.Agent({ keepAlive: true, maxSockets: 1 });

function scaricaJson(url) {
  return new Promise((risolvi, rifiuta) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return rifiuta(new Error(`${url}: risposta ${res.statusCode}`));
      }
      let testo = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (testo += c));
      res.on("end", () => {
        try {
          risolvi(JSON.parse(testo));
        } catch (e) {
          rifiuta(e);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("tempo scaduto")));
    req.on("error", rifiuta);
  });
}

function ipInNumero(ip) {
  return ip.split(".").reduce((n, parte) => n * 256 + Number(parte), 0);
}

export function ipNellaRete(ip, cidr) {
  const [rete, bitTesto] = cidr.split("/");
  const bit = Number(bitTesto);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || !/^\d+\.\d+\.\d+\.\d+$/.test(rete)) return false;
  if (!(bit >= 0 && bit <= 32)) return false;
  // Divisione per 2^(32-bit) invece di operatori bit a bit (lavorano a 32 bit con segno).
  const passo = 2 ** (32 - bit);
  return Math.floor(ipInNumero(ip) / passo) === Math.floor(ipInNumero(rete) / passo);
}

export function regioneDaElenco(elenco, ip) {
  let migliore = null;
  for (const p of elenco?.prefixes ?? []) {
    const cidr = p.ipv4Prefix;
    if (!cidr || !ipNellaRete(ip, cidr)) continue;
    const bit = Number(cidr.split("/")[1]);
    if (!migliore || bit > migliore.bit) migliore = { bit, regione: p.scope };
  }
  return migliore?.regione ?? null;
}

// Cerca il punto di test della regione in qualsiasi forma arrivi l'elenco:
// { "us-east4": { URL, RegionName } }, un elenco di oggetti, chiavi in minuscolo...
// Come ultima possibilità cerca qualsiasi indirizzo https che contenga il nome della regione.
export function puntoDiTest(endpoints, regione) {
  if (!endpoints || !regione) return null;
  const voci = Array.isArray(endpoints)
    ? endpoints
    : Object.entries(endpoints).map(([k, v]) => (v && typeof v === "object" ? { chiave: k, ...v } : { chiave: k, URL: v }));
  const campo = (o, ...nomi) => {
    for (const n of nomi) for (const [k, v] of Object.entries(o ?? {})) if (k.toLowerCase() === n && v) return v;
    return null;
  };
  const voce = voci.find((v) => v && (v.chiave === regione || campo(v, "region", "regione", "name") === regione));
  let url = voce ? campo(voce, "url", "endpoint", "uri") : null;
  if (!url) {
    // ricerca profonda di un indirizzo che contenga la regione (es. https://us-east4-xxxx.a.run.app)
    const trovati = [];
    const visita = (x) => {
      if (typeof x === "string") {
        if (/^https:\/\//i.test(x) && x.toLowerCase().includes(regione.toLowerCase())) trovati.push(x);
      } else if (x && typeof x === "object") Object.values(x).forEach(visita);
    };
    visita(endpoints);
    url = trovati[0] ?? null;
  }
  if (!url || typeof url !== "string") return null;
  const nome = (voce && campo(voce, "regionname", "displayname", "label")) || regione;
  return { url: url.replace(/\/+$/, ""), nome };
}

// Breve descrizione della forma di una risposta, per il registro.
export function formaRisposta(x) {
  try {
    if (Array.isArray(x)) return `elenco di ${x.length}, primo: ${JSON.stringify(x[0]).slice(0, 160)}`;
    const chiavi = Object.keys(x ?? {});
    return `oggetto con ${chiavi.length} chiavi (${chiavi.slice(0, 8).join(", ")}…), prima: ${JSON.stringify(x[chiavi[0]]).slice(0, 160)}`;
  } catch {
    return typeof x;
  }
}

let elencoRegioni = null; // promessa in cache
let elencoEndpoint = null;

function regioni() {
  elencoRegioni ??= scaricaJson(URL_REGIONI).catch((e) => {
    elencoRegioni = null; // riproveremo più tardi
    throw e;
  });
  return elencoRegioni;
}

function endpoints() {
  elencoEndpoint ??= scaricaJson(URL_GCPING).catch((e) => {
    elencoEndpoint = null;
    throw e;
  });
  return elencoEndpoint;
}

// Restituisce { regione, nome, url } oppure null se non si riesce.
export async function trovaDatacenter(ip) {
  let elenco;
  try {
    elenco = await regioni();
  } catch (e) {
    throw new Error(`elenco IP di Google non scaricabile (${e.message})`);
  }
  const regione = regioneDaElenco(elenco, ip);
  if (!regione) throw new Error(`l'IP ${ip} non risulta tra i datacenter Google Cloud`);
  let ep;
  try {
    ep = await endpoints();
  } catch (e) {
    throw new Error(`regione ${regione} trovata, ma l'elenco dei punti di test gcping non è scaricabile (${e.message})`);
  }
  const punto = puntoDiTest(ep, regione);
  if (!punto) throw new Error(`regione ${regione} trovata, ma nessun punto di test gcping per quella regione. Risposta: ${formaRisposta(ep)}`);
  return { regione, ...punto };
}

// Tempo fino all'inizio della risposta, sulla connessione già aperta.
export function misuraDatacenter(url) {
  return new Promise((risolvi) => {
    const inizio = process.hrtime.bigint();
    const req = https.get(`${url}/api/ping`, { agent: agente, timeout: 3000 }, (res) => {
      const ms = Number(process.hrtime.bigint() - inizio) / 1e6;
      res.resume();
      risolvi(res.statusCode < 500 ? Math.max(1, Math.round(ms)) : null);
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => risolvi(null));
  });
}
