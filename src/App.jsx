import { useEffect, useState } from "react";
import { usePonte } from "./usePonte.js";
import {
  Cornice, Quadrante, Anello, Segmenti, NaveScudi, Bussola, NastroVerticale, Esagono, Targhetta,
  GraficoPing, Battito, numero, distanza, durata, percento, trattino,
} from "./hud/strumenti.jsx";

const SPIE = ["pwr", "wpn", "thr", "shld", "cool", "qdrv", "radr", "prox", "hit", "misl"];
const IFCS = ["CPL", "ESP", "GRC", "GSF", "CRU", "LIM", "PRX", "ATT", "STB", "COR", "VNT", "CMD"];
const POTENZA = ["REA", "MOT", "ARM", "RAF", "VIT", "GRA", "SEN", "GSC", "ESC"];

const METODI_PING = {
  icmp: "DIRETTO",
  tcp: "STIMA · TCP",
  datacenter: "STIMA · DATACENTER",
  rete: "SERVER NON MISURABILE",
};

const TRADUZIONI = {
  SCM: "SCM", NAVIGATION: "NAV", STEALTH: "STEALTH",
  RETRACTED: "SU", DEPLOYED: "GIÙ", DEPLOYING: "IN DISCESA", RETRACTING: "IN SALITA",
  SEATED: "SEDUTO", ON_FOOT: "A PIEDI", EVA: "EVA",
  PILOT: "PILOTA", GUNNER: "ARTIGLIERE", CREW: "EQUIPAGGIO",
};
const tr = (v) => (v ? TRADUZIONI[v] ?? v : trattino);

// La schermata è disegnata a 1920×1080 e si adatta a qualsiasi finestra.
function useScala() {
  const [s, setS] = useState(1);
  useEffect(() => {
    const calcola = () => setS(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    calcola();
    window.addEventListener("resize", calcola);
    return () => window.removeEventListener("resize", calcola);
  }, []);
  return s;
}

function useOrologio() {
  const [ora, setOra] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setOra(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return ora.toLocaleTimeString("it-IT", { hour12: false });
}

function Luce({ nome, acceso }) {
  return (
    <span className={`luce ${acceso ? "on" : "off"}`}>
      <i />
      {nome}
    </span>
  );
}

function Dato({ etichetta, valore, tono }) {
  return (
    <div className="dato">
      <span>{etichetta}</span>
      <b className={tono ? `tono-${tono}` : ""}>{valore ?? trattino}</b>
    </div>
  );
}

const tonoPing = (ms) => (ms == null ? "spento" : ms < 80 ? "ok" : ms < 150 ? "attenzione" : "critico");

// ---------------------------------------------------------------------------

function Server({ server, ping }) {
  const perdita = ping.tentativi ? ping.perdite / ping.tentativi : null;
  // "rete" misura solo fino all'ingresso nella rete Google, non fino al server:
  // non lo mostriamo come ping (sarebbe molto più basso del reale per server lontani).
  const soloRete = ping.metodo === "rete";
  const msPing = soloRete ? null : ping.ms;
  const tono = tonoPing(msPing);
  return (
    <Cornice titolo="SERVER" extra={METODI_PING[ping.metodo] ?? (ping.ricerca ? "RICERCA…" : null)} className="c-server">
      <div className="ping-zona">
        <Quadrante
          valore={msPing}
          max={300}
          tacche={12}
          lancetta={false}
          tono={tono}
          zone={[{ da: 0, a: 80, tono: "ok" }, { da: 80, a: 150, tono: "attenzione" }, { da: 150, a: 300, tono: "critico" }]}
        >
          <text x="110" y="128" className={`quadrante-numero tono-${tono}`}>{msPing ?? "---"}</text>
          <text x="110" y="150" className="quadrante-unita">{ping.metodo && ping.metodo !== "icmp" && !soloRete ? "MS · STIMATO" : "MS · PING"}</text>
        </Quadrante>
        <div className="ping-lato">
          <Dato etichetta="PERSI" valore={ping.metodo ? percento(perdita) : trattino} tono={perdita > 0.05 ? "attenzione" : null} />
          {soloRete ? (
            <Dato etichetta="RETE FINO A GOOGLE" valore={ping.ms == null ? null : `${ping.ms} ms`} />
          ) : (
            <Dato etichetta="VERSO" valore={ping.dettaglio ?? (server.ip ? "server" : null)} />
          )}
          <GraficoPing storico={ping.storico} />
        </div>
      </div>
      {!server.ip ? (
        <p className="attesa">Nessun server: entra nell'universo di gioco</p>
      ) : (
        <div className="dati-colonna">
          <Dato etichetta="REGIONE" valore={server.regione} />
          <Dato etichetta="CONNESSO" valore={durata(server.connessoDaSecondi)} />
          <Dato etichetta="SHARD" valore={server.shard} />
          <Dato etichetta="IP" valore={server.ip} />
          <Dato etichetta="AMBIENTE" valore={server.ambiente} />
          <Dato etichetta="BUILD" valore={server.build} />
        </div>
      )}
    </Cornice>
  );
}

function Eventi({ eventi }) {
  return (
    <Cornice titolo="REGISTRO EVENTI" className="c-eventi">
      {!eventi?.length ? (
        <p className="attesa">Nessun evento</p>
      ) : (
        <ul className="registro">
          {eventi.slice(0, 9).map((e, i) => (
            <li key={`${e.ora}-${i}`}>
              <span>{e.ora}</span>
              {e.testo}
            </li>
          ))}
        </ul>
      )}
    </Cornice>
  );
}

const altPasso = (a) => (a == null ? 100 : Math.abs(a) > 20000 ? 1000 : Math.abs(a) > 2000 ? 250 : 50);
const distanzaBreve = (m) => (Math.abs(m) >= 10000 ? `${numero(m / 1000, 1)}k` : numero(m));

function Centro({ nave }) {
  const v = nave?.volo;
  const massimo = nave?.modalita === "NAVIGATION" ? 1500 : 450;
  return (
    <div className="centro">
      <div className="centro-testa">
        <div>
          <div className="nave-nome">{nave?.nome ?? "NESSUNA NAVE"}</div>
          <div className="nave-sotto">{nave ? nave.produttore ?? "" : "Siediti ai comandi di una nave"}</div>
        </div>
        <div className="nave-stati">
          <Targhetta nome={tr(nave?.modalita)} acceso={!!nave} />
          <Targhetta nome="SPOOL" acceso={!!nave?.spool} />
          <Targhetta nome={nave ? (nave.atterrata ? "ATTERRATA" : "IN VOLO") : "—"} acceso={!!nave} />
          <Targhetta nome={`CARRELLO ${tr(nave?.carrello)}`} acceso={!!nave} />
          <Targhetta nome="LUCI" acceso={!!nave?.luci} />
        </div>
      </div>

      <div className="centro-corpo">
        <NastroVerticale valore={v?.altitudine ?? null} passo={altPasso(v?.altitudine)} etichetta="ALTITUDINE" formato={distanzaBreve} />
        <NaveScudi nave={nave} massimoVelocita={massimo} />
        <div className="centro-destra">
          <div className="mini-quadrante">
            <Quadrante valore={v?.g ?? null} min={-5} max={15} tacche={10} r={70} spessore={8} dimensione={180} lancetta={false}
              tono={v?.g != null && Math.abs(v.g) > 7 ? "critico" : v?.g != null && Math.abs(v.g) > 4 ? "attenzione" : "ok"}>
              <text x="90" y="104" className="quadrante-numero piccolo">{v?.g == null ? "--" : numero(v.g, 1)}</text>
              <text x="90" y="124" className="quadrante-unita">G</text>
            </Quadrante>
          </div>
          <Dato etichetta="VEL. VERTICALE" valore={v?.velocitaVerticale == null ? null : `${v.velocitaVerticale >= 0 ? "+" : ""}${numero(v.velocitaVerticale)} m/s`} />
          <Dato etichetta="ALT. RADAR" valore={distanza(v?.altitudineRadar ?? null)} />
          <Dato etichetta="PRUA" valore={v?.prua == null ? null : `${String(Math.round(v.prua) % 360).padStart(3, "0")}°`} />
          <Dato etichetta="SCAFO" valore={percento(nave?.scafo != null && nave.scafo <= 1 ? nave.scafo : null)} />
        </div>
      </div>

      <div className="centro-piede">
        <div className="spie">
          {SPIE.map((k) => (
            <Esagono key={k} nome={k.toUpperCase()} stato={nave ? nave.spie?.[k] : null} />
          ))}
        </div>
        <div className="targhette">
          <span className="targhette-titolo">IFCS</span>
          {IFCS.map((k) => (
            <Targhetta key={k} nome={k} acceso={nave?.ifcs?.[k]?.attivo} disponibile={nave?.ifcs?.[k]?.abilitato !== false} />
          ))}
        </div>
        <div className="targhette">
          <span className="targhette-titolo">POTENZA</span>
          {POTENZA.map((k) => (
            <Targhetta key={k} nome={k} acceso={nave?.potenza?.[k]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Sistemi({ nave }) {
  const s = nave?.sistemi;
  return (
    <Cornice titolo="SISTEMI" extra={s?.boost?.attivo ? "BOOST ATTIVO" : null} className="c-sistemi">
      <div className="anelli">
        <Anello rapporto={s?.idrogeno} etichetta="IDROGENO" />
        <Anello rapporto={s?.quantum} etichetta="QUANTUM" />
        <Anello rapporto={s?.scudi} etichetta="SCUDI" />
      </div>
      <Segmenti rapporto={s?.boost?.riserva} etichetta="BOOST" />
    </Cornice>
  );
}

function Armi({ armi }) {
  return (
    <Cornice titolo="ARMI" extra={armi?.gimbalBloccati ? "GIMBAL BLOCCATI" : null} className="c-armi">
      <div className="armi-pronte">
        <div className="pip-fila">
          {armi
            ? Array.from({ length: Math.max(armi.totali, 1) }, (_, i) => <span key={i} className={`pip ${i < armi.pronte ? "on" : ""}`} />)
            : <span className="attesa">—</span>}
        </div>
        <span className="armi-conteggio">{armi ? `${armi.pronte}/${armi.totali} PRONTE` : "NESSUN DATO"}</span>
      </div>
      <div className="contatori">
        <div className="contatore">
          <b>{armi?.decoy ?? "--"}</b>
          <span>DECOY</span>
        </div>
        <div className="contatore">
          <b>{armi?.noise ?? "--"}</b>
          <span>NOISE</span>
        </div>
        <div className="contatore">
          <b>{armi?.preset ?? "--"}</b>
          <span>PRESET</span>
        </div>
      </div>
    </Cornice>
  );
}

function Personaggio({ p }) {
  return (
    <Cornice titolo="PILOTA" extra={p ? (p.aria ? "ARIA OK" : "NO ARIA") : null} className="c-pilota">
      <div className="pilota-riga">
        <Anello rapporto={p?.salute?.rapporto} etichetta="SALUTE" dimensione={84} />
        <Anello rapporto={p?.ossigeno?.rapporto} etichetta="OSSIGENO" dimensione={84} />
        <Battito bpm={p?.battito ?? null} />
      </div>
      <div className="dati-colonna">
        <Dato etichetta="POSIZIONE" valore={p ? `${tr(p.posizione)}${p.ruolo ? ` · ${tr(p.ruolo)}` : ""}` : null} />
        <Dato etichetta="aUEC" valore={p?.auec == null ? null : numero(p.auec)} />
      </div>
    </Cornice>
  );
}

// ---------------------------------------------------------------------------

export default function App() {
  const { dati, collegato } = usePonte();
  const scala = useScala();
  const orologio = useOrologio();
  const st = dati?.stato;
  const nave = dati?.nave ?? null;

  let avviso = null;
  if (!collegato) avviso = { tono: "critico", testo: "Collegamento interrotto con il motore della telemetria" };
  else if (st && !st.log) avviso = { tono: "critico", testo: "Game.log non trovato: controlla la cartella del gioco nelle Impostazioni" };
  else if (st?.gioco === false) avviso = { tono: "attenzione", testo: "Star Citizen è chiuso: i dati compariranno quando avvii il gioco" };
  else if (st && !st.telemetria)
    avviso = { tono: "attenzione", testo: "Telemetria non ricevuta: Impostazioni → Attiva telemetria nel gioco. Ping e server funzionano comunque" };

  return (
    <div className="schermo">
      <div className="scena" style={{ transform: `translate(-50%, -50%) scale(${scala})` }}>
        <header className="testata">
          <div className="testata-sx">
            <span className="logo">TELEMETRIA SC</span>
            {st?.versione && <span className="distintivo">{st.versione}</span>}
            {dati?.demo && <span className="distintivo demo">DEMO</span>}
          </div>
          <Bussola prua={nave?.volo?.prua ?? null} />
          <div className="testata-dx">
            {st?.gioco != null && <Luce nome="GIOCO" acceso={st.gioco} />}
            <Luce nome="LOG" acceso={!!st?.log} />
            <Luce nome={st?.telemetria ? `TELEM ${st.pacchettiAlSecondo}/S` : "TELEM"} acceso={!!st?.telemetria} />
            <span className="orologio">{orologio}</span>
          </div>
        </header>

        {avviso && <div className={`avviso tono-bordo-${avviso.tono}`}>{avviso.testo}</div>}

        <main className="cruscotto">
          <div className="colonna">
            {dati && <Server server={dati.server} ping={dati.ping} />}
            {dati && <Eventi eventi={dati.eventi} />}
          </div>
          <Centro nave={nave} />
          <div className="colonna">
            <Sistemi nave={nave} />
            <Armi armi={dati?.armi ?? null} />
            <Personaggio p={dati?.personaggio ?? null} />
          </div>
        </main>
      </div>
    </div>
  );
}
