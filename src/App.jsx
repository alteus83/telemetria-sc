import { useEffect, useState } from "react";
import { usePonte } from "./usePonte.js";
import { TESTI, ContestoLingua, useT, traduciRegione, linguaBrowser } from "./lingua.js";
import {
  Cornice, Quadrante, Anello, Segmenti, NaveScudi, Bussola, NastroVerticale, Esagono, Targhetta,
  GraficoPing, Battito, numero, distanza, durata, percento, trattino, impostaLocale,
} from "./hud/strumenti.jsx";

const SPIE = ["pwr", "wpn", "thr", "shld", "cool", "qdrv", "radr", "prox", "hit", "misl"];
const IFCS = ["CPL", "ESP", "GRC", "GSF", "CRU", "LIM", "PRX", "ATT", "STB", "COR", "VNT", "CMD"];
const POTENZA = ["REA", "MOT", "ARM", "RAF", "VIT", "GRA", "SEN", "GSC", "ESC"];

function useTr() {
  const T = useT();
  return (v) => (v ? T.stati[v] ?? v : trattino);
}

// La schermata è disegnata a 1920×1080 (orizzontale) o 1080×1920 (verticale, per i
// monitor ruotati) e si adatta a qualsiasi finestra. Sceglie da sola in base alla forma.
function useScala() {
  const [s, setS] = useState({ scala: 1, verticale: false });
  useEffect(() => {
    const calcola = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const verticale = h > w;
      setS({ verticale, scala: verticale ? Math.min(w / 1080, h / 1920) : Math.min(w / 1920, h / 1080) });
    };
    calcola();
    window.addEventListener("resize", calcola);
    return () => window.removeEventListener("resize", calcola);
  }, []);
  return s;
}

function useOrologio(locale) {
  const [ora, setOra] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setOra(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return ora.toLocaleTimeString(locale, { hour12: false });
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

function Server({ server, ping, lingua }) {
  const T = useT();
  const perdita = ping.tentativi ? ping.perdite / ping.tentativi : null;
  // "rete" misura solo fino all'ingresso nella rete Google, non fino al server:
  // non lo mostriamo come ping (sarebbe molto più basso del reale per server lontani).
  const soloRete = ping.metodo === "rete";
  const msPing = soloRete ? null : ping.ms;
  const tono = tonoPing(msPing);
  return (
    <Cornice titolo={T.server} extra={T.metodi[ping.metodo] ?? (ping.ricerca ? T.ricerca : null)} className="c-server">
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
          <text x="110" y="150" className="quadrante-unita">{ping.metodo && ping.metodo !== "icmp" && !soloRete ? T.msStimato : T.msPing}</text>
        </Quadrante>
        <div className="ping-lato">
          <Dato etichetta={T.persi} valore={ping.metodo ? percento(perdita) : trattino} tono={perdita > 0.05 ? "attenzione" : null} />
          {soloRete ? (
            <Dato etichetta={T.reteGoogle} valore={ping.ms == null ? null : `${ping.ms} ms`} />
          ) : (
            <Dato etichetta={T.verso} valore={ping.dettaglio ?? (server.ip ? T.serverParola : null)} />
          )}
          <GraficoPing storico={ping.storico} />
        </div>
      </div>
      {!server.ip ? (
        <p className="attesa">{T.nessunServer}</p>
      ) : (
        <div className="dati-colonna">
          <Dato etichetta={T.regione} valore={traduciRegione(server.regione, lingua)} />
          <Dato etichetta={T.connesso} valore={durata(server.connessoDaSecondi)} />
          <Dato etichetta={T.shard} valore={server.shard} />
          <Dato etichetta={T.ip} valore={server.ip} />
          <Dato etichetta={T.ambiente} valore={server.ambiente} />
          <Dato etichetta={T.build} valore={server.build} />
        </div>
      )}
    </Cornice>
  );
}

function Eventi({ eventi }) {
  const T = useT();
  return (
    <Cornice titolo={T.registro} className="c-eventi">
      {!eventi?.length ? (
        <p className="attesa">{T.nessunEvento}</p>
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
  const T = useT();
  const tr = useTr();
  const v = nave?.volo;
  const massimo = nave?.modalita === "NAVIGATION" ? 1500 : 450;
  return (
    <div className="centro">
      <div className="centro-testa">
        <div>
          <div className="nave-nome">{nave?.nome ?? T.nessunaNave}</div>
          <div className="nave-sotto">{nave ? nave.produttore ?? "" : T.siediti}</div>
        </div>
        <div className="nave-stati">
          <Targhetta nome={tr(nave?.modalita)} acceso={!!nave} />
          <Targhetta nome={T.spool} acceso={!!nave?.spool} />
          <Targhetta nome={nave ? (nave.atterrata ? T.atterrata : T.inVolo) : "—"} acceso={!!nave} />
          <Targhetta nome={`${T.carrello} ${tr(nave?.carrello)}`} acceso={!!nave} />
          <Targhetta nome={T.luci} acceso={!!nave?.luci} />
        </div>
      </div>

      <div className="centro-corpo">
        <NastroVerticale valore={v?.altitudine ?? null} passo={altPasso(v?.altitudine)} etichetta={T.altitudine} formato={distanzaBreve} />
        <NaveScudi nave={nave} massimoVelocita={massimo} />
        <div className="centro-destra">
          <div className="mini-quadrante">
            <Quadrante valore={v?.g ?? null} min={-5} max={15} tacche={10} r={70} spessore={8} dimensione={180} lancetta={false}
              tono={v?.g != null && Math.abs(v.g) > 7 ? "critico" : v?.g != null && Math.abs(v.g) > 4 ? "attenzione" : "ok"}>
              <text x="90" y="104" className="quadrante-numero piccolo">{v?.g == null ? "--" : numero(v.g, 1)}</text>
              <text x="90" y="124" className="quadrante-unita">G</text>
            </Quadrante>
          </div>
          <Dato etichetta={T.velVerticale} valore={v?.velocitaVerticale == null ? null : `${v.velocitaVerticale >= 0 ? "+" : ""}${numero(v.velocitaVerticale)} m/s`} />
          <Dato etichetta={T.altRadar} valore={distanza(v?.altitudineRadar ?? null)} />
          <Dato etichetta={T.prua} valore={v?.prua == null ? null : `${String(Math.round(v.prua) % 360).padStart(3, "0")}°`} />
          <Dato etichetta={T.scafo} valore={percento(nave?.scafo != null && nave.scafo <= 1 ? nave.scafo : null)} />
        </div>
      </div>

      <div className="centro-piede">
        <div className="spie">
          {SPIE.map((k) => (
            <Esagono key={k} nome={k.toUpperCase()} stato={nave ? nave.spie?.[k] : null} />
          ))}
        </div>
        <div className="targhette">
          <span className="targhette-titolo">{T.ifcs}</span>
          {IFCS.map((k) => (
            <Targhetta key={k} nome={k} acceso={nave?.ifcs?.[k]?.attivo} disponibile={nave?.ifcs?.[k]?.abilitato !== false} />
          ))}
        </div>
        <div className="targhette">
          <span className="targhette-titolo">{T.potenza}</span>
          {POTENZA.map((k) => (
            <Targhetta key={k} nome={k} acceso={nave?.potenza?.[k]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Sistemi({ nave }) {
  const T = useT();
  const s = nave?.sistemi;
  return (
    <Cornice titolo={T.sistemi} extra={s?.boost?.attivo ? T.boostAttivo : null} className="c-sistemi">
      <div className="anelli">
        <Anello rapporto={s?.idrogeno} etichetta={T.idrogeno} />
        <Anello rapporto={s?.quantum} etichetta={T.quantum} />
        <Anello rapporto={s?.scudi} etichetta={T.scudi} />
      </div>
      <Segmenti rapporto={s?.boost?.riserva} etichetta={T.boost} />
    </Cornice>
  );
}

function Armi({ armi }) {
  const T = useT();
  return (
    <Cornice titolo={T.armi} extra={armi?.gimbalBloccati ? T.gimbal : null} className="c-armi">
      <div className="armi-pronte">
        <div className="pip-fila">
          {armi
            ? Array.from({ length: Math.max(armi.totali, 1) }, (_, i) => <span key={i} className={`pip ${i < armi.pronte ? "on" : ""}`} />)
            : <span className="attesa">—</span>}
        </div>
        <span className="armi-conteggio">{armi ? `${armi.pronte}/${armi.totali} ${T.pronte}` : T.nessunDato}</span>
      </div>
      <div className="contatori">
        <div className="contatore">
          <b>{armi?.decoy ?? "--"}</b>
          <span>{T.decoy}</span>
        </div>
        <div className="contatore">
          <b>{armi?.noise ?? "--"}</b>
          <span>{T.noise}</span>
        </div>
        <div className="contatore">
          <b>{armi?.preset ?? "--"}</b>
          <span>{T.preset}</span>
        </div>
      </div>
    </Cornice>
  );
}

function Personaggio({ p }) {
  const T = useT();
  const tr = useTr();
  return (
    <Cornice titolo={T.pilota} extra={p ? (p.aria ? T.ariaOk : T.noAria) : null} className="c-pilota">
      <div className="pilota-riga">
        <Anello rapporto={p?.salute?.rapporto} etichetta={T.salute} dimensione={84} />
        <Anello rapporto={p?.ossigeno?.rapporto} etichetta={T.ossigeno} dimensione={84} />
        <Battito bpm={p?.battito ?? null} />
      </div>
      <div className="dati-colonna">
        <Dato etichetta={T.posizione} valore={p ? `${tr(p.posizione)}${p.ruolo ? ` · ${tr(p.ruolo)}` : ""}` : null} />
        <Dato etichetta="aUEC" valore={p?.auec == null ? null : numero(p.auec)} />
      </div>
    </Cornice>
  );
}

// ---------------------------------------------------------------------------

export default function App() {
  const { dati, collegato } = usePonte();
  const { scala, verticale } = useScala();
  // F2 = Impostazioni (solo dentro l'app per Windows)
  useEffect(() => {
    if (!window.telemetriaApp) return;
    const tasto = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        window.telemetriaApp.apriImpostazioni();
      }
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, []);
  const st = dati?.stato;
  const lingua = st?.lingua === "it" || st?.lingua === "en" ? st.lingua : linguaBrowser();
  const T = TESTI[lingua];
  impostaLocale(T.locale);
  const orologio = useOrologio(T.locale);
  const nave = dati?.nave ?? null;

  let avviso = null;
  if (!collegato) avviso = { tono: "critico", testo: T.avvisi.collegamento };
  else if (st && !st.log) avviso = { tono: "critico", testo: T.avvisi.log };
  else if (st?.gioco === false) avviso = { tono: "attenzione", testo: T.avvisi.chiuso };
  else if (st && !st.telemetria) avviso = { tono: "attenzione", testo: T.avvisi.telemetria };

  return (
    <ContestoLingua.Provider value={T}>
      <div className="schermo">
        <div className={`scena ${verticale ? "verticale" : ""}`} style={{ transform: `translate(-50%, -50%) scale(${scala})` }}>
          <header className="testata">
            <div className="testata-sx">
              <span className="logo">TELEMETRIA SC</span>
              {st?.versione && <span className="distintivo">{st.versione}</span>}
              {dati?.demo && <span className="distintivo demo">DEMO</span>}
            </div>
            <Bussola prua={nave?.volo?.prua ?? null} cardinali={T.cardinali} />
            <div className="testata-dx">
              {st?.gioco != null && <Luce nome={T.gioco} acceso={st.gioco} />}
              <Luce nome={T.log} acceso={!!st?.log} />
              <Luce nome={st?.telemetria ? `${T.telem} ${st.pacchettiAlSecondo}/S` : T.telem} acceso={!!st?.telemetria} />
              <span className="orologio">{orologio}</span>
              {window.telemetriaApp && (
                <button
                  type="button"
                  className="pulsante-impostazioni"
                  title={T.apriImpostazioni}
                  aria-label={T.apriImpostazioni}
                  onClick={() => window.telemetriaApp.apriImpostazioni()}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.2 4.7-.1-2.4 2-1.6-2-3.4-2.4.8a8 8 0 0 0-2-1.2L15.2 3h-4l-.5 2.4a8 8 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.6-.1 1.2.1 1.2-2 1.6 2 3.4 2.4-.8a8 8 0 0 0 2 1.2l.5 2.4h4l.5-2.4a8 8 0 0 0 2-1.2l2.4.8 2-3.4-2-1.6.1-1.2Z" />
                  </svg>
                  <span>F2</span>
                </button>
              )}
            </div>
          </header>

          {avviso && <div className={`avviso tono-bordo-${avviso.tono}`}>{avviso.testo}</div>}

          <main className="cruscotto">
            <div className="colonna">
              {dati && <Server server={dati.server} ping={dati.ping} lingua={lingua} />}
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
    </ContestoLingua.Provider>
  );
}
