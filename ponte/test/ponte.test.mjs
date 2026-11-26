// Test automatici del ponte. Si eseguono con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { analizzaRiga, regioneDaShard, statoServerVuoto } from "../gamelog.mjs";
import { avviaTelemetria } from "../telemetria.mjs";

const cartella = path.dirname(fileURLToPath(import.meta.url));

test("Game.log: riconosce ingresso nell'universo, shard e regione", () => {
  const s = statoServerVuoto();
  const ev = analizzaRiga(
    "<2026-11-25T18:00:00.000Z> [Notice] <Join PU> address[35.12.34.56] port[64090] shard[pub_euw1b_9876543_110] locationId[-1]",
    s
  );
  assert.equal(s.ip, "35.12.34.56");
  assert.equal(s.porta, 64090);
  assert.equal(s.shard, "pub_euw1b_9876543_110");
  assert.equal(s.regione, "Europa Ovest");
  assert.deepEqual(ev, { k: "join", p: { shard: "pub_euw1b_9876543_110" } });
});

test("Game.log: porta telemetria, sessione, uptime e riavvio", () => {
  const s = statoServerVuoto();
  analizzaRiga("<GameTelemetry> Local services server is running on 127.0.0.1:2942", s);
  analizzaRiga("[Trace] @env_session: 'pub-sc-alpha-4.10'", s);
  analizzaRiga("Session Uptime: 4521s", s);
  assert.equal(s.portaTelemetria, 2942);
  assert.equal(s.ambiente, "pub-sc-alpha-4.10");
  assert.equal(s.uptimeSecondi, 4521);
  analizzaRiga("Log started on Wed Nov 25 18:00:00 2026", s);
  assert.equal(s.portaTelemetria, null);
});

test("Regioni dagli shard", () => {
  assert.equal(regioneDaShard("pub_use1a_123"), "America Est");
  assert.equal(regioneDaShard("pub_apse2_1"), "Asia-Pacifico Sud");
  assert.equal(regioneDaShard("local_shard"), "Menu principale");
  assert.equal(regioneDaShard("qualcosa"), null);
});

test("Telemetria: riceve e converte i dati da un finto gioco", async () => {
  const def = protoLoader.loadSync("sc/game/telemetry/v1/api.proto", {
    includeDirs: [path.join(cartella, "..", "proto")],
    keepCase: true,
    enums: String,
  });
  const pkg = grpc.loadPackageDefinition(def).sc.game.telemetry.v1;
  const finto = new grpc.Server();
  finto.addService(pkg.GameTelemetryService.service, {
    TelemetryStream(call) {
      const t = setInterval(() => {
        call.write({
          vehicle: {
            state: {
              name: "Gladius",
              manufacturer: "Aegis",
              master_mode: { mode: "VEHICLE_MASTER_MODE_SCM", spooled: true },
              shields: { level: 0.21, faces: [0.2, 0.2, 0.25, 0.2] },
              annunciators: { wpn: "ANNUNCIATOR_STATE_MAJOR_ON" },
              flight: {
                state: { is_landed: false, gear: "VEHICLE_COMPONENT_DEPLOYMENT_STATE_RETRACTED" },
                instruments: { speed: 123.4, altitude: 3.4028235e38, hydrogen_fuel: 0.99 },
                settings: { ifcs_coupled: { enabled: true, active: true } },
              },
            },
          },
          weapons: {
            weapons: [{ name: "a", ready_to_fire: true }, { name: "b", ready_to_fire: false }],
            countermeasures: [{ type: "COUNTERMEASURE_TYPE_DECOY", amount: 48 }],
          },
          actor: { vitals: { health: { current: 50, max: 100 } }, state: { uec_balance: 1000 } },
          events: { events: [{ type: "GAME_EVENT_TYPE_ACTOR_ENTER_SEAT" }] },
        });
      }, 50);
      call.on("cancelled", () => clearInterval(t));
    },
  });
  const porta = await new Promise((ok, ko) =>
    finto.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (e, p) => (e ? ko(e) : ok(p)))
  );

  const ricevuti = [];
  const stato = avviaTelemetria({
    host: "127.0.0.1",
    porte: [porta],
    portaDalLog: () => null,
    onDati: (d) => ricevuti.push(d),
    onEvento: () => {},
  });
  await new Promise((r) => setTimeout(r, 600));
  stato.ferma();
  finto.forceShutdown();

  assert.ok(ricevuti.length > 3, "dovrebbero arrivare più pacchetti");
  const d = ricevuti.at(-1);
  assert.equal(d.nave.nome, "Gladius");
  assert.equal(d.nave.modalita, "SCM");
  assert.equal(d.nave.carrello, "RETRACTED");
  assert.equal(d.nave.spie.wpn, "ON");
  assert.equal(d.nave.volo.altitudine, null, "il valore sentinella diventa 'non disponibile'");
  assert.ok(Math.abs(d.nave.volo.velocita - 123.4) < 0.01);
  assert.equal(d.nave.ifcs.CPL.attivo, true);
  assert.equal(d.armi.pronte, 1);
  assert.equal(d.armi.totali, 2);
  assert.equal(d.armi.decoy, 48);
  assert.equal(d.personaggio.salute.rapporto, 0.5);
  assert.deepEqual(d.eventi, ["ACTOR_ENTER_SEAT"]);
  assert.equal(stato.porta, porta);
});

test("Ponte: a gioco chiuso non mostra l'ultimo server del Game.log", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const { avviaPonte } = await import("../server.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tsc-"));
  const log = path.join(dir, "Game.log");
  fs.writeFileSync(log, "<Join PU> address[127.0.0.1] port[64090] shard[pub_euw1b_1_1]\n");
  let aperto = false;
  const ponte = await avviaPonte({
    config: { portaWeb: 0, gameLog: log, telemetriaHost: "127.0.0.1", telemetriaPorte: [1], intervalloPing: 60000 },
    giocoAperto: () => aperto,
    scrivi: () => {},
  });
  try {
    const chiuso = ponte.istantanea();
    assert.equal(chiuso.stato.gioco, false);
    assert.equal(chiuso.server.ip, undefined);
    aperto = true;
    const ap = ponte.istantanea();
    assert.equal(ap.server.ip, "127.0.0.1");
    assert.equal(ap.server.regione, "Europa Ovest");
  } finally {
    ponte.chiudi();
  }
});

test("Shard: toglie la punteggiatura finale", async () => {
  const { pulisciShard } = await import("../gamelog.mjs");
  assert.equal(pulisciShard("pub_euw1b_13165946_070."), "pub_euw1b_13165946_070");
  const s = statoServerVuoto();
  analizzaRiga("[Notice] <Update Shard Id> New Shard Id: pub_euw1b_13165946_070.", s);
  assert.equal(s.shard, "pub_euw1b_13165946_070");
});

test("Ping: legge i tempi da Windows in italiano", async () => {
  const { leggiTempoPing } = await import("../ping.mjs");
  assert.equal(leggiTempoPing("Risposta da 1.2.3.4: byte=32 durata=17ms TTL=58"), 17);
  assert.equal(leggiTempoPing("Risposta da 1.2.3.4: byte=32 durata<1ms TTL=64"), 1);
  assert.equal(leggiTempoPing("Richiesta scaduta."), null);
});

test("Ping: trova l'ultimo nodo che risponde (tracert reale)", async () => {
  const { ultimoNodo } = await import("../ping.mjs");
  const testo = `
Traccia instradamento verso 35.205.141.100 su un massimo di 30 punti di passaggio

  1    <1 ms    <1 ms    <1 ms  192.168.178.1
  2     *        *        *     Richiesta scaduta.
  3     4 ms     3 ms     4 ms  172.17.70.188
  4     9 ms     4 ms     5 ms  172.17.64.126
  5     5 ms     4 ms     5 ms  172.19.177.74
  6    17 ms    18 ms    17 ms  172.19.177.4
  7    17 ms    17 ms    17 ms  195.22.196.170
  8    17 ms    17 ms    17 ms  74.125.51.148
  9     *        *        *     Richiesta scaduta.
 10     *        *        *     Richiesta scaduta.

Traccia completata.`;
  assert.equal(ultimoNodo(testo, "35.205.141.100"), "74.125.51.148");
});

test("Datacenter: dall'IP alla regione Google e al punto di test", async () => {
  const { regioneDaElenco, puntoDiTest, ipNellaRete } = await import("../datacenter.mjs");
  assert.equal(ipNellaRete("35.205.141.100", "35.205.0.0/16"), true);
  assert.equal(ipNellaRete("35.206.1.1", "35.205.0.0/16"), false);
  const elenco = { prefixes: [{ ipv4Prefix: "35.204.0.0/14", scope: "x" }, { ipv4Prefix: "35.205.0.0/16", scope: "europe-west1" }] };
  assert.equal(regioneDaElenco(elenco, "35.205.141.100"), "europe-west1");
  const ep = { "europe-west1": { URL: "https://europe-west1-abc.a.run.app/", RegionName: "Belgio" } };
  assert.deepEqual(puntoDiTest(ep, "europe-west1"), { url: "https://europe-west1-abc.a.run.app", nome: "Belgio" });
  assert.equal(puntoDiTest(ep, "us-east1"), null);
});

test("user.cfg: aggiunge e corregge le righe senza toccare il resto", async () => {
  const { aggiornaTestoUserCfg } = await import("../../app/telemetria-gioco.mjs");
  const prima = "r_DisplayInfo = 1\r\nserver.game.telemetry.enabled = 0\r\n";
  const dopo = aggiornaTestoUserCfg(prima, "LIVE");
  assert.match(dopo, /^r_DisplayInfo = 1\r\n/);
  assert.match(dopo, /server\.game\.telemetry\.enabled = 1/);
  assert.match(dopo, /grpc\.client\.server\.enabled = 1/);
  assert.match(dopo, /grpc\.client\.server\.port = 2942/);
  assert.equal(aggiornaTestoUserCfg(dopo, "LIVE"), dopo, "seconda volta: nessuna modifica");
  assert.match(aggiornaTestoUserCfg("", "PTU"), /grpc\.client\.server\.port = 29420/);
});

test("Canale: riconosce LIVE e PTU dal percorso dell'eseguibile", async () => {
  const { canaleDaPercorso } = await import("../processo.mjs");
  const ptu = canaleDaPercorso("C:\\Giochi\\StarCitizen\\PTU\\Bin64\\StarCitizen.exe");
  assert.equal(ptu.canale, "PTU");
  assert.equal(ptu.cartellaGioco, "C:\\Giochi\\StarCitizen");
  assert.equal(ptu.gameLog, "C:\\Giochi\\StarCitizen\\PTU\\Game.log");
  assert.equal(canaleDaPercorso("C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Bin64\\StarCitizen.exe").canale, "LIVE");
  assert.equal(canaleDaPercorso(null), null);
});

test("Ping: legge i tempi da Windows in altre lingue", async () => {
  const { leggiTempoPing } = await import("../ping.mjs");
  assert.equal(leggiTempoPing("Respuesta desde 1.2.3.4: bytes=32 tiempo=45ms TTL=58"), 45);
  assert.equal(leggiTempoPing("Antwort von 1.2.3.4: Bytes=32 Zeit=12ms TTL=58"), 12);
  assert.equal(leggiTempoPing("Réponse de 1.2.3.4 : octets=32 temps=8 ms TTL=58"), 8);
  assert.equal(leggiTempoPing("Odpowiedź z 1.2.3.4: bajtów=32 czas=30ms TTL=58"), 30);
  assert.equal(leggiTempoPing("Ответ от 1.2.3.4: число байт=32 время=27мс TTL=58"), 27);
  // codifica rovinata: vale la riserva prima di TTL=
  assert.equal(leggiTempoPing("ЋвўҐв ®в 1.2.3.4: зЁб«® Ў ©в=32 ўаҐ¬п=33¬б TTL=58"), 33);
});

test("Datacenter: punto di test in forme diverse della risposta", async () => {
  const { puntoDiTest } = await import("../datacenter.mjs");
  assert.equal(puntoDiTest([{ region: "us-east4", url: "https://a/" }], "us-east4").url, "https://a");
  assert.equal(puntoDiTest({ "us-east4": "https://us-east4-x.a.run.app" }, "us-east4").url, "https://us-east4-x.a.run.app");
  assert.equal(puntoDiTest({ regioni: { qualcosa: { link: "https://us-east4-y.a.run.app/" } } }, "us-east4").url, "https://us-east4-y.a.run.app");
  assert.equal(puntoDiTest({ "us-east1": { URL: "https://us-east1-z.a.run.app" } }, "us-east4"), null);
});
