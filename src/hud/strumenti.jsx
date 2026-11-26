// Strumenti di bordo disegnati in SVG: quadranti, anello scudi, bussola, altimetro...
// Design originale ispirato agli schermi di bordo delle navi spaziali.

export const trattino = "—";

// Formato dei numeri (virgola o punto per i decimali) secondo la lingua scelta.
let LOCALE = "it-IT";
export function impostaLocale(l) {
  LOCALE = l;
}

export function numero(v, decimali = 0) {
  if (v == null || !Number.isFinite(v)) return trattino;
  return v.toLocaleString(LOCALE, { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
}
export function percento(r) {
  if (r == null || !Number.isFinite(r)) return trattino;
  return `${Math.round(Math.max(0, Math.min(1, r)) * 100)}%`;
}
export function distanza(m) {
  if (m == null) return trattino;
  return Math.abs(m) >= 10000 ? `${numero(m / 1000, 1)} km` : `${numero(m)} m`;
}
export function durata(secondi) {
  if (secondi == null) return trattino;
  const h = Math.floor(secondi / 3600);
  const m = Math.floor((secondi % 3600) / 60);
  const s = secondi % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}
const limita = (v, a, b) => Math.max(a, Math.min(b, v));
export const tonoLivello = (r) => (r == null ? "spento" : r < 0.25 ? "critico" : r < 0.5 ? "attenzione" : "ok");

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------
function polare(cx, cy, r, gradi) {
  const a = ((gradi - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
export function arco(cx, cy, r, da, a) {
  if (Math.abs(a - da) < 0.01) a = da + 0.01;
  const [x0, y0] = polare(cx, cy, r, da);
  const [x1, y1] = polare(cx, cy, r, a);
  const grande = Math.abs(a - da) > 180 ? 1 : 0;
  const verso = a > da ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${grande} ${verso} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Pannello con angoli tagliati
// ---------------------------------------------------------------------------
export function Cornice({ titolo, extra, className = "", style, children }) {
  return (
    <section className={`cornice ${className}`} style={style}>
      <div className="cornice-fondo" />
      {titolo && (
        <header className="cornice-titolo">
          <span className="cornice-segno" />
          <span>{titolo}</span>
          {extra && <span className="cornice-extra">{extra}</span>}
        </header>
      )}
      <div className="cornice-corpo">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quadrante ad arco con tacche, zone colorate e lancetta
// ---------------------------------------------------------------------------
export function Quadrante({
  valore, min = 0, max = 100, da = -130, a = 130, r = 90, spessore = 10,
  tacche = 10, zone = null, lancetta = true, tono = "ok", children, dimensione = 220,
}) {
  const c = dimensione / 2;
  const v = valore == null || !Number.isFinite(valore) ? null : limita(valore, min, max);
  const angolo = v == null ? da : da + ((v - min) / (max - min)) * (a - da);
  const [lx, ly] = polare(c, c, r - spessore - 6, angolo);
  const elencoTacche = [];
  for (let i = 0; i <= tacche; i++) {
    const g = da + (i / tacche) * (a - da);
    const [x0, y0] = polare(c, c, r + spessore / 2 + 3, g);
    const [x1, y1] = polare(c, c, r + spessore / 2 + (i % 2 === 0 ? 11 : 7), g);
    elencoTacche.push(<line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className="tacca" />);
  }
  return (
    <svg viewBox={`0 0 ${dimensione} ${dimensione}`} className="quadrante">
      <path d={arco(c, c, r, da, a)} className="arco-fondo" strokeWidth={spessore} />
      {zone?.map((z, i) => (
        <path
          key={i}
          d={arco(c, c, r + spessore / 2 + 1.5, da + ((z.da - min) / (max - min)) * (a - da), da + ((z.a - min) / (max - min)) * (a - da))}
          className={`zona tono-tratto-${z.tono}`}
        />
      ))}
      {v != null && <path d={arco(c, c, r, da, angolo)} className={`arco-valore tono-tratto-${tono}`} strokeWidth={spessore} />}
      {elencoTacche}
      {lancetta && v != null && (
        <g className="lancetta">
          <line x1={c} y1={c} x2={lx} y2={ly} />
          <circle cx={c} cy={c} r="5" />
        </g>
      )}
      {children}
    </svg>
  );
}

// Piccolo anello percentuale (salute, ossigeno, carburante)
export function Anello({ rapporto, etichetta, dimensione = 92 }) {
  const c = dimensione / 2;
  const r = c - 8;
  const v = rapporto == null || !Number.isFinite(rapporto) ? null : limita(rapporto, 0, 1);
  const tono = tonoLivello(v);
  return (
    <div className="anello">
      <svg viewBox={`0 0 ${dimensione} ${dimensione}`}>
        <path d={arco(c, c, r, -135, 135)} className="arco-fondo" strokeWidth="7" />
        {v != null && v > 0 && <path d={arco(c, c, r, -135, -135 + v * 270)} className={`arco-valore tono-tratto-${tono}`} strokeWidth="7" />}
        <text x={c} y={c + 2} className={`anello-valore tono-${tono}`}>{v == null ? "--" : Math.round(v * 100)}</text>
        <text x={c} y={c + 16} className="anello-unita">%</text>
      </svg>
      <span className="anello-etichetta">{etichetta}</span>
    </div>
  );
}

// Barra a segmenti (boost, carburante)
export function Segmenti({ rapporto, etichetta, quanti = 20 }) {
  const v = rapporto == null || !Number.isFinite(rapporto) ? null : limita(rapporto, 0, 1);
  const accesi = v == null ? 0 : Math.round(v * quanti);
  const tono = tonoLivello(v);
  return (
    <div className="segmenti">
      <span className="segmenti-etichetta">{etichetta}</span>
      <div className="segmenti-fila">
        {Array.from({ length: quanti }, (_, i) => (
          <span key={i} className={`segmento ${i < accesi ? `acceso tono-sfondo-${tono}` : ""}`} />
        ))}
      </div>
      <span className={`segmenti-valore tono-${tono}`}>{percento(v)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nave al centro con l'anello degli scudi (4 lati) e il tachimetro esterno
// ---------------------------------------------------------------------------
const SAGOMA =
  "M0,-118 L14,-70 L24,-30 L78,22 L84,52 L34,44 L24,78 L10,70 L0,84 L-10,70 L-24,78 L-34,44 L-84,52 L-78,22 L-24,-30 L-14,-70 Z";

export function NaveScudi({ nave, massimoVelocita }) {
  const D = 600;
  const c = D / 2;
  const facce = nave?.sistemi?.facceScudi ?? [];
  const livello = nave?.sistemi?.scudi;
  // Ordine dei lati ipotizzato: davanti, dietro, sinistra, destra
  const lati = [
    { nome: "AVANTI", da: -38, a: 38, v: facce[0] ?? livello },
    { nome: "DESTRA", da: 52, a: 128, v: facce[3] ?? livello },
    { nome: "DIETRO", da: 142, a: 218, v: facce[1] ?? livello },
    { nome: "SINISTRA", da: 232, a: 308, v: facce[2] ?? livello },
  ];
  const vel = nave?.volo?.velocita;
  const max = massimoVelocita;
  const angoloVel = vel == null ? null : -135 + limita(vel / max, 0, 1) * 270;
  const tacche = [];
  for (let i = 0; i <= 54; i++) {
    const g = -135 + (i / 54) * 270;
    const lunga = i % 6 === 0;
    const [x0, y0] = polare(c, c, 250, g);
    const [x1, y1] = polare(c, c, lunga ? 264 : 257, g);
    tacche.push(<line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={lunga ? "tacca forte" : "tacca"} />);
    if (lunga) {
      const [tx, ty] = polare(c, c, 234, g);
      tacche.push(
        <text key={`t${i}`} x={tx} y={ty + 4} className="tacca-testo">{Math.round((i / 54) * max)}</text>
      );
    }
  }

  return (
    <svg viewBox={`0 0 ${D} ${D}`} className="nave-scudi">
      <defs>
        <radialGradient id="aloneNave" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(79,216,255,0.18)" />
          <stop offset="70%" stopColor="rgba(79,216,255,0.03)" />
          <stop offset="100%" stopColor="rgba(79,216,255,0)" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r="210" fill="url(#aloneNave)" />
      {/* cerchi guida */}
      <circle cx={c} cy={c} r="210" className="guida" />
      <circle cx={c} cy={c} r="118" className="guida tratteggio" />
      <g>
        <path d={arco(c, c, 200, 0, 40)} className="radar-scia" />
        <animateTransform attributeName="transform" type="rotate" from={`0 ${c} ${c}`} to={`360 ${c} ${c}`} dur="6s" repeatCount="indefinite" />
      </g>

      {/* tachimetro esterno */}
      <path d={arco(c, c, 276, -135, 135)} className="arco-fondo" strokeWidth="10" />
      {angoloVel != null && <path d={arco(c, c, 276, -135, angoloVel)} className="arco-valore tono-tratto-ok" strokeWidth="10" />}
      {tacche}

      {/* scudi */}
      {lati.map((l) => {
        const v = l.v == null ? null : limita(l.v, 0, 1);
        const tono = tonoLivello(v);
        const [tx, ty] = polare(c, c, 134, (l.da + l.a) / 2);
        return (
          <g key={l.nome}>
            <path d={arco(c, c, 160, l.da, l.a)} className="scudo-fondo" />
            {v != null && v > 0 && (
              <path d={arco(c, c, 160, l.da, l.a)} className={`scudo tono-tratto-${tono}`} style={{ opacity: 0.35 + v * 0.65 }} />
            )}
            <text x={tx} y={ty + 5} className={`scudo-testo tono-${tono}`}>{v == null ? "--" : Math.round(v * 100)}</text>
          </g>
        );
      })}

      {/* sagoma della nave */}
      <g transform={`translate(${c} ${c - 4}) scale(0.82)`}>
        <path d={SAGOMA} className={`sagoma ${nave ? "" : "spenta"}`} />
        <path d="M0,-90 L0,60 M-50,32 L50,32" className="sagoma-linee" />
      </g>

      {/* velocità in basso, nella fessura del tachimetro */}
      <text x={c} y={c + 250} className="vel-numero">{vel == null ? "---" : numero(vel)}</text>
      <text x={c} y={c + 274} className="vel-unita">M/S</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bussola a nastro (prua)
// ---------------------------------------------------------------------------
const CARDINALI = { 0: "N", 90: "E", 180: "S", 270: "O" };
export function Bussola({ prua, larghezza = 760, cardinali = CARDINALI }) {
  const visibili = 120; // gradi visibili
  const px = larghezza / visibili;
  const segni = [];
  if (prua != null) {
    const inizio = Math.floor((prua - visibili / 2) / 5) * 5;
    for (let g = inizio; g <= prua + visibili / 2; g += 5) {
      const x = larghezza / 2 + (g - prua) * px;
      const norm = ((g % 360) + 360) % 360;
      const forte = norm % 15 === 0;
      segni.push(<line key={g} x1={x} x2={x} y1={forte ? 26 : 32} y2={42} className={forte ? "tacca forte" : "tacca"} />);
      if (forte)
        segni.push(
          <text key={`t${g}`} x={x} y={20} className={`bussola-testo ${cardinali[norm] ? "cardinale" : ""}`}>
            {cardinali[norm] ?? String(norm).padStart(3, "0")}
          </text>
        );
    }
  }
  return (
    <svg viewBox={`0 0 ${larghezza} 60`} className="bussola">
      <defs>
        <linearGradient id="sfumaBussola" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.15" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.85" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="mascheraBussola">
          <rect width={larghezza} height="60" fill="url(#sfumaBussola)" />
        </mask>
      </defs>
      <g mask="url(#mascheraBussola)">
        <line x1="0" x2={larghezza} y1="42" y2="42" className="guida" />
        {segni}
      </g>
      <path d={`M${larghezza / 2 - 9} 58 L${larghezza / 2} 46 L${larghezza / 2 + 9} 58 Z`} className="indice" />
      <rect x={larghezza / 2 - 34} y="0" width="68" height="0" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nastro verticale (altitudine)
// ---------------------------------------------------------------------------
export function NastroVerticale({ valore, passo = 100, altezza = 420, etichetta, formato = (v) => numero(v) }) {
  const larghezza = 120;
  const visibili = passo * 8;
  const px = altezza / visibili;
  const segni = [];
  if (valore != null) {
    const inizio = Math.floor((valore - visibili / 2) / (passo / 2)) * (passo / 2);
    for (let v = inizio; v <= valore + visibili / 2; v += passo / 2) {
      const y = altezza / 2 - (v - valore) * px;
      const forte = Math.round(v / passo) * passo === Math.round(v);
      segni.push(<line key={v} x1={forte ? 70 : 80} x2={92} y1={y} y2={y} className={forte ? "tacca forte" : "tacca"} />);
      if (forte) segni.push(<text key={`t${v}`} x={64} y={y + 5} className="nastro-testo">{formato(v)}</text>);
    }
  }
  return (
    <div className="nastro">
      <span className="nastro-etichetta">{etichetta}</span>
      <svg viewBox={`0 0 ${larghezza} ${altezza}`} style={{ height: altezza }}>
        <defs>
          <linearGradient id="sfumaNastro" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.2" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="mascheraNastro">
            <rect width={larghezza} height={altezza} fill="url(#sfumaNastro)" />
          </mask>
        </defs>
        <g mask="url(#mascheraNastro)">
          <line x1="92" x2="92" y1="0" y2={altezza} className="guida" />
          {segni}
        </g>
        <path d={`M96 ${altezza / 2} L110 ${altezza / 2 - 9} L110 ${altezza / 2 + 9} Z`} className="indice" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spia esagonale
// ---------------------------------------------------------------------------
export function Esagono({ nome, stato }) {
  const s = stato ?? "OFF";
  const classe = s.startsWith("MAJOR") ? "grave" : s.startsWith("MINOR") ? "lieve" : s === "NOMINAL" ? "ok" : "spenta";
  return (
    <svg viewBox="0 0 92 80" className={`esagono esagono-${classe} ${s.endsWith("FLASHING") ? "lampeggia" : ""}`}>
      <polygon points="23,3 69,3 90,40 69,77 23,77 2,40" />
      <text x="46" y="46">{nome}</text>
    </svg>
  );
}

// Targhetta accesa/spenta (IFCS, potenza)
export function Targhetta({ nome, acceso, disponibile = true }) {
  return <span className={`targhetta ${!disponibile ? "assente" : acceso ? "on" : "off"}`}>{nome}</span>;
}

// ---------------------------------------------------------------------------
// Grafico del ping
// ---------------------------------------------------------------------------
export function GraficoPing({ storico }) {
  const valori = storico ?? [];
  const massimo = Math.max(100, ...valori.filter((v) => v != null)) * 1.15;
  const n = 60;
  const punti = [];
  const segmenti = [];
  valori.forEach((v, i) => {
    const x = n - valori.length + i;
    if (v == null) {
      if (punti.length) segmenti.push([...punti]);
      punti.length = 0;
    } else punti.push(`${x},${100 - (v / massimo) * 100}`);
  });
  if (punti.length) segmenti.push(punti);
  const perdite = valori.map((v, i) => (v == null ? n - valori.length + i : null)).filter((x) => x != null);
  return (
    <svg className="grafico" viewBox={`0 0 ${n - 1} 100`} preserveAspectRatio="none">
      {[25, 50, 75].map((y) => (
        <line key={y} x1="0" x2={n} y1={y} y2={y} className="grafico-griglia" />
      ))}
      {segmenti.map((s, i) =>
        s.length > 1 ? (
          <g key={i}>
            <polygon points={`${s[0].split(",")[0]},100 ${s.join(" ")} ${s.at(-1).split(",")[0]},100`} className="grafico-area" />
            <polyline points={s.join(" ")} className="grafico-linea" />
          </g>
        ) : null
      )}
      {perdite.map((x) => (
        <line key={`p${x}`} x1={x} x2={x} y1="0" y2="100" className="grafico-perdita" />
      ))}
    </svg>
  );
}

// Tracciato del battito che scorre
export function Battito({ bpm }) {
  const durataCiclo = bpm ? 60 / bpm : 1;
  return (
    <div className="battito">
      <svg viewBox="0 0 200 40" preserveAspectRatio="none">
        <g className="battito-linea" style={{ animationDuration: `${durataCiclo * 2}s` }}>
          {[0, 100, 200].map((x) => (
            <polyline key={x} points={`${x},24 ${x + 30},24 ${x + 38},18 ${x + 44},24 ${x + 52},24 ${x + 56},4 ${x + 62},36 ${x + 67},24 ${x + 100},24`} />
          ))}
        </g>
      </svg>
      <span className="battito-valore">{bpm == null ? "--" : numero(bpm)}</span>
      <span className="battito-unita">BPM</span>
    </div>
  );
}
