import { useEffect, useState } from "react";
import { usePonte } from "./usePonte.js";
import {
  Pannello, Riga, Barra, Spia, Sigla, GraficoPing,
  numero, percento, distanza, durata, tonoPing, trattino,
} from "./componenti.jsx";

const SPIE = ["pwr", "wpn", "thr", "shld", "cool", "qdrv", "radr", "prox", "hit", "misl"];
const IFCS = ["CPL", "ESP", "GRC", "GSF", "CRU", "LIM", "PRX", "ATT", "STB", "COR", "VNT", "CMD"];
const POTENZA = ["REA", "MOT", "ARM", "RAF", "VIT", "GRA", "SEN", "GSC", "ESC"];

const TRADUZIONI = {
  SCM: "SCM", NAVIGATION: "NAV", STEALTH: "STEALTH",
  RETRACTED: "SU", DEPLOYED: "GIÙ", DEPLOYING: "IN DISCESA", RETRACTING: "IN SALITA",
  SEATED: "SEDUTO", ON_FOOT: "A PIEDI", EVA: "EVA",
  PILOT: "PILOTA", GUNNER: "ARTIGLIERE", CREW: "EQUIPAGGIO",
  SPACESHIP: "NAVE SPAZIALE", GROUND: "VEICOLO TERRESTRE", GRAVLEV: "GRAVLEV", BOAT: "IMBARCAZIONE",
};
const tr = (v) => (v ? TRADUZIONI[v] ?? v : trattino);

function useOrologio() {
  const [ora, setOra] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setOra(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return ora.toLocaleTimeString("it-IT", { hour12: false });
}

function Indicatore({ nome, acceso, titolo }) {
  return (
    <span className={`indicatore ${acceso ? "indicatore-on" : "indicatore-off"}`} title={titolo}>
      <span className="indicatore-punto" />
      {nome}
    </span>
  );
}

function InAttesa({ testo = "In attesa dei dati" }) {
  return <p className="in-attesa">{testo}…</p>;
}

// ---------------------------------------------------------------------------

function PannelloServer({ server, ping }) {
  const tono = tonoPing(ping.ms);
  const perdita = ping.tentativi ? ping.perdite / ping.tentativi : null;
  return (
    <Pannello
      titolo="SERVER"
      className="largo"
      extra={ping.metodo === "tcp" ? "ping stimato (TCP)" : ping.metodo === "icmp" ? "ping ICMP" : null}
    >
      {!server.ip ? (
        <InAttesa testo="Nessun server rilevato: entra nell'universo di gioco" />
      ) : (
        <div className="server-griglia">
          <div className="ping-blocco">
            <span className="ping-etichetta">PING</span>
            <span className={`ping-valore tono-${tono}`}>
              {ping.ms == null ? "---" : ping.ms}
              <small>ms</small>
            </span>
            <span className="ping-perdita">Pacchetti persi: {perdita == null ? trattino : percento(perdita)}</span>
          </div>
          <GraficoPing storico={ping.storico} />
          <div className="server-dati">
            <Riga etichetta="REGIONE" valore={server.regione} />
            <Riga etichetta="SHARD" valore={server.shard} />
            <Riga etichetta="IP" valore={server.ip ? `${server.ip}${server.porta ? `:${server.porta}` : ""}` : null} />
            <Riga etichetta="CONNESSO DA" valore={durata(server.connessoDaSecondi)} />
            <Riga etichetta="UPTIME SERVER" valore={server.uptimeSecondi != null ? durata(server.uptimeSecondi) : null} />
            <Riga etichetta="AMBIENTE" valore={server.ambiente} />
            <Riga etichetta="BUILD" valore={server.build} />
          </div>
        </div>
      )}
    </Pannello>
  );
}

function PannelloNave({ nave }) {
  return (
    <Pannello titolo="NAVE" extra={nave ? (nave.spool ? "SPOOL" : null) : null}>
      {!nave ? (
        <InAttesa testo="Non sei in una nave" />
      ) : (
        <>
          <p className="nave-nome">{nave.nome}</p>
          <Riga etichetta="COSTRUTTORE" valore={nave.produttore} />
          <Riga etichetta="MODALITÀ" valore={tr(nave.modalita)} />
          <Riga etichetta="STATO" valore={nave.atterrata ? "ATTERRATA" : "IN VOLO"} />
          <Riga etichetta="CARRELLO" valore={tr(nave.carrello)} />
          <Riga etichetta="LUCI" valore={nave.luci ? "ACCESE" : "SPENTE"} tono={nave.luci ? "ok" : "spento"} />
        </>
      )}
    </Pannello>
  );
}

function PannelloVolo({ nave }) {
  const v = nave?.volo;
  return (
    <Pannello titolo="VOLO">
      {!v ? (
        <InAttesa />
      ) : (
        <>
          <div className="grande-valore">
            {numero(v.velocita)}
            <small>m/s</small>
          </div>
          <Riga etichetta="VEL. VERTICALE" valore={v.velocitaVerticale == null ? null : `${v.velocitaVerticale >= 0 ? "+" : ""}${numero(v.velocitaVerticale)} m/s`} />
          <Riga etichetta="G" valore={v.g == null ? null : `${v.g >= 0 ? "+" : ""}${numero(v.g, 1)} G`} tono={v.g != null && Math.abs(v.g) > 6 ? "critico" : null} />
          <Riga etichetta="ALTITUDINE" valore={distanza(v.altitudine)} />
          <Riga etichetta="ALT. RADAR" valore={distanza(v.altitudineRadar)} />
          <Riga etichetta="PRUA" valore={v.prua == null ? null : `${numero(v.prua)}°`} />
        </>
      )}
    </Pannello>
  );
}

function PannelloSistemi({ nave }) {
  const s = nave?.sistemi;
  return (
    <Pannello titolo="SISTEMI" extra={s?.boost?.attivo ? "BOOST ATTIVO" : null}>
      {!s ? (
        <InAttesa />
      ) : (
        <>
          <Barra etichetta="SCUDI" rapporto={s.scudi} />
          <Barra etichetta="SCAFO" rapporto={nave.scafo != null && nave.scafo <= 1 ? nave.scafo : null} />
          <Barra etichetta="IDROGENO" rapporto={s.idrogeno} />
          <Barra etichetta="QUANTUM" rapporto={s.quantum} />
          <Barra etichetta="BOOST" rapporto={s.boost?.riserva} />
          {s.facceScudi?.length > 0 && (
            <div className="facce-scudi" title="Scudi per lato">
              {s.facceScudi.map((f, i) => (
                <span key={i} className="faccia" style={{ opacity: 0.25 + (f ?? 0) * 0.75 }}>
                  {percento(f)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Pannello>
  );
}

function PannelloSpie({ nave }) {
  return (
    <Pannello titolo="SPIE">
      {!nave ? (
        <InAttesa />
      ) : (
        <div className="griglia-spie">
          {SPIE.map((k) => (
            <Spia key={k} nome={k.toUpperCase()} stato={nave.spie?.[k]} />
          ))}
        </div>
      )}
    </Pannello>
  );
}

function PannelloIfcs({ nave }) {
  return (
    <Pannello titolo="IFCS E POTENZA">
      {!nave ? (
        <InAttesa />
      ) : (
        <>
          <div className="gruppo-sigle">
            <span className="riga-etichetta">IFCS</span>
            <div className="sigle">
              {IFCS.map((k) => (
                <Sigla key={k} nome={k} acceso={nave.ifcs?.[k]?.attivo} disponibile={nave.ifcs?.[k]?.abilitato !== false} />
              ))}
            </div>
          </div>
          <div className="gruppo-sigle">
            <span className="riga-etichetta">POT.</span>
            <div className="sigle">
              {POTENZA.map((k) => (
                <Sigla key={k} nome={k} acceso={nave.potenza?.[k]} />
              ))}
            </div>
          </div>
        </>
      )}
    </Pannello>
  );
}

function PannelloArmi({ armi }) {
  return (
    <Pannello titolo="ARMI" extra={armi?.gimbalBloccati ? "G.LOCK" : null}>
      {!armi ? (
        <InAttesa />
      ) : (
        <>
          <Riga etichetta="PRONTE" valore={`${armi.pronte}/${armi.totali}`} tono={armi.pronte < armi.totali ? "attenzione" : "ok"} />
          <Riga etichetta="PRESET" valore={armi.preset} />
          <Riga etichetta="DECOY" valore={armi.decoy} />
          <Riga etichetta="NOISE" valore={armi.noise} />
        </>
      )}
    </Pannello>
  );
}

function PannelloPersonaggio({ p }) {
  return (
    <Pannello titolo="PERSONAGGIO" extra={p?.aria ? "ARIA RESPIRABILE" : p ? "ARIA NON RESPIRABILE" : null}>
      {!p ? (
        <InAttesa />
      ) : (
        <>
          <Barra etichetta="SALUTE" rapporto={p.salute?.rapporto} />
          <Barra etichetta="OSSIGENO" rapporto={p.ossigeno?.rapporto} />
          {p.fame && <Barra etichetta="FAME" rapporto={p.fame.rapporto} invertita />}
          {p.sete && <Barra etichetta="SETE" rapporto={p.sete.rapporto} invertita />}
          <Riga etichetta="BATTITO" valore={p.battito == null ? null : `${numero(p.battito)} BPM`} />
          <Riga etichetta="POSIZIONE" valore={`${tr(p.posizione)}${p.ruolo ? ` · ${tr(p.ruolo)}` : ""}`} />
          <Riga etichetta="aUEC" valore={p.auec == null ? null : numero(p.auec)} />
          <Riga etichetta="TEMP. ESTERNA" valore={p.temperaturaEsterna == null ? null : `${numero(p.temperaturaEsterna)} °C`} />
        </>
      )}
    </Pannello>
  );
}

function PannelloEventi({ eventi }) {
  return (
    <Pannello titolo="EVENTI" className="eventi">
      {!eventi?.length ? (
        <InAttesa testo="Nessun evento" />
      ) : (
        <ul className="registro">
          {eventi.slice(0, 12).map((e, i) => (
            <li key={`${e.ora}-${i}`}>
              <span className="registro-ora">{e.ora}</span> {e.testo}
            </li>
          ))}
        </ul>
      )}
    </Pannello>
  );
}

// ---------------------------------------------------------------------------

export default function App() {
  const { dati, collegato } = usePonte();
  const orologio = useOrologio();
  const st = dati?.stato;

  return (
    <div className="schermo">
      <header className="testata">
        <div className="testata-titolo">
          TELEMETRIA SC <span className="testata-sotto">STAR CITIZEN</span>
          {dati?.demo && <span className="badge-demo">DEMO</span>}
        </div>
        <div className="testata-stato">
          {st?.gioco != null && (
            <Indicatore nome="GIOCO" acceso={st.gioco} titolo={st.gioco ? "Star Citizen è aperto" : "Star Citizen è chiuso"} />
          )}
          <Indicatore nome="LOG" acceso={!!st?.log} titolo={st?.erroreLog ?? "Game.log trovato"} />
          <Indicatore
            nome={st?.telemetria ? `TELEMETRIA ${st.pacchettiAlSecondo} PKT/S` : "TELEMETRIA"}
            acceso={!!st?.telemetria}
            titolo={st?.erroreTelemetria ?? "Telemetria del gioco"}
          />
          <span className="orologio">{orologio}</span>
        </div>
      </header>

      {!collegato && (
        <div className="avviso">
          Collegamento interrotto con il motore della telemetria. Se usi l'app, riaprila dall'icona vicino
          all'orologio; se usi il ponte da terminale, avvialo con <code>npm run ponte</code>.
        </div>
      )}
      {collegato && st && !st.log && (
        <div className="avviso">
          Game.log non trovato{st.percorsoLog ? <> in <code>{st.percorsoLog}</code></> : null}. Controlla la cartella
          del gioco nelle Impostazioni.
        </div>
      )}
      {collegato && st?.log && st.gioco === false && (
        <div className="avviso avviso-lieve">Star Citizen è chiuso. I dati compariranno quando avvii il gioco.</div>
      )}
      {collegato && st?.log && st.gioco !== false && !st.telemetria && (
        <div className="avviso avviso-lieve">
          Telemetria del gioco non ricevuta. Il gioco deve essere aperto, con il personaggio in gioco e la telemetria
          attivata (vedi LEGGIMI.md). Ping e dati del server funzionano comunque dal Game.log.
        </div>
      )}

      {dati && (
        <main className="griglia">
          <PannelloServer server={dati.server} ping={dati.ping} />
          <PannelloNave nave={dati.nave} />
          <PannelloVolo nave={dati.nave} />
          <PannelloSistemi nave={dati.nave} />
          <PannelloSpie nave={dati.nave} />
          <PannelloIfcs nave={dati.nave} />
          <PannelloArmi armi={dati.armi} />
          <PannelloPersonaggio p={dati.personaggio} />
          <PannelloEventi eventi={dati.eventi} />
        </main>
      )}
    </div>
  );
}
