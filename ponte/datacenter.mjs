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

// Accetta sia { "europe-west1": { URL, RegionName } } sia un elenco di oggetti.
export function puntoDiTest(endpoints, regione) {
  if (!endpoints || !regione) return null;
  const voci = Array.isArray(endpoints) ? endpoints : Object.entries(endpoints).map(([k, v]) => ({ chiave: k, ...v }));
  const voce = voci.find((v) => v.chiave === regione || v.Region === regione || v.region === regione);
  const url = voce?.URL ?? voce?.url;
  if (!url) return null;
  return { url: String(url).replace(/\/+$/, ""), nome: voce.RegionName ?? voce.regionName ?? regione };
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
  if (!punto) throw new Error(`regione ${regione} trovata, ma gcping non ha un punto di test per quella regione`);
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
