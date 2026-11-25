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
  assert.match(ev, /shard/);
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
  assert.deepEqual(d.eventi, ["Seduto"]);
  assert.equal(stato.porta, porta);
});
