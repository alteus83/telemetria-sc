// ============================================================
// Telemetria SC — Ponte da terminale (per prove e sviluppo)
// Per l'uso normale c'è l'app per Windows (cartella app/).
//
// Avvio normale:  npm run ponte
// Avvio demo:     npm run demo
// ============================================================

import { caricaConfigurazione } from "./config.mjs";
import { avviaPonte } from "./server.mjs";
import { avviaControlloGioco } from "./processo.mjs";

const config = caricaConfigurazione();
const modoDemo = process.argv.includes("--demo");

const gioco = modoDemo
  ? { aperto: true }
  : avviaControlloGioco(
      3000,
      (aperto) => {
        if (aperto === true) console.log("Star Citizen è aperto.");
        if (aperto === false) console.log("Star Citizen è chiuso.");
      },
      (porte) => console.log(`Porte in ascolto del gioco: ${porte.join(", ") || "nessuna"}`)
    );

avviaPonte({ config, demo: modoDemo, giocoAperto: () => gioco.aperto, porteGioco: () => gioco.porte ?? [] })
  .then(({ porta }) => {
    console.log("============================================");
    console.log(" TELEMETRIA SC — Ponte" + (modoDemo ? " (DEMO)" : ""));
    console.log("============================================");
    console.log(` Apri sullo schermo secondario:  http://localhost:${porta}`);
    if (!modoDemo) {
      console.log(` Game.log:  ${config.gameLog}`);
      console.log(` Telemetria: ${config.telemetriaHost}, porte ${config.telemetriaPorte.join(", ")}`);
    }
    console.log(" Per chiudere: CTRL + C");
    console.log("============================================\n");
  })
  .catch((e) => {
    if (e.code === "EADDRINUSE") {
      console.error(`\nLa porta ${config.portaWeb} è già occupata: forse il ponte o l'app sono già aperti.`);
    } else {
      console.error(e);
    }
    process.exit(1);
  });

process.on("SIGINT", () => {
  console.log("\nPonte chiuso.");
  process.exit(0);
});
