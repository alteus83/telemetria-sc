// Mattoncini grafici riutilizzati dalla schermata telemetria.

export const trattino = "—";

export function numero(v, decimali = 0) {
  if (v == null || !Number.isFinite(v)) return trattino;
  return v.toLocaleString("it-IT", { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
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

export function Pannello({ titolo, extra, className = "", children }) {
  return (
    <section className={`pannello ${className}`}>
      <header className="pannello-titolo">
        <span>{titolo}</span>
        {extra && <span className="pannello-extra">{extra}</span>}
      </header>
      <div className="pannello-corpo">{children}</div>
    </section>
  );
}

export function Riga({ etichetta, valore, tono }) {
  return (
    <div className="riga">
      <span className="riga-etichetta">{etichetta}</span>
      <span className={`riga-valore ${tono ? `tono-${tono}` : ""}`}>{valore ?? trattino}</span>
    </div>
  );
}

export function Barra({ etichetta, rapporto, invertita = false }) {
  const r = rapporto == null || !Number.isFinite(rapporto) ? null : Math.max(0, Math.min(1, rapporto));
  // invertita: valori alti sono un problema (es. fame)
  const livello = r == null ? 1 : invertita ? 1 - r : r;
  const tono = livello < 0.25 ? "critico" : livello < 0.5 ? "attenzione" : "ok";
  return (
    <div className="barra">
      <span className="riga-etichetta">{etichetta}</span>
      <div className="barra-binario">
        <div className={`barra-riempimento tono-sfondo-${tono}`} style={{ width: `${(r ?? 0) * 100}%` }} />
      </div>
      <span className={`barra-valore tono-${r == null ? "spento" : tono}`}>{percento(r)}</span>
    </div>
  );
}

// Spia stile cruscotto. stato: NOMINAL, OFF, MINOR_ON, MINOR_FLASHING, MAJOR_ON, MAJOR_FLASHING
export function Spia({ nome, stato }) {
  const s = stato ?? "OFF";
  const classe =
    s.startsWith("MAJOR") ? "spia-grave" : s.startsWith("MINOR") ? "spia-lieve" : s === "NOMINAL" ? "spia-ok" : "spia-spenta";
  return <span className={`spia ${classe} ${s.endsWith("FLASHING") ? "lampeggia" : ""}`}>{nome}</span>;
}

// Sigla accesa/spenta (IFCS, potenza)
export function Sigla({ nome, acceso, disponibile = true }) {
  return <span className={`sigla ${!disponibile ? "sigla-assente" : acceso ? "sigla-on" : "sigla-off"}`}>{nome}</span>;
}

export function tonoPing(ms) {
  if (ms == null) return "critico";
  if (ms < 80) return "ok";
  if (ms < 150) return "attenzione";
  return "critico";
}

// Grafico del ping: una linea per gli ultimi valori, buchi dove il ping è andato perso.
export function GraficoPing({ storico }) {
  const valori = storico ?? [];
  const massimo = Math.max(100, ...valori.filter((v) => v != null)) * 1.15;
  const n = 60;
  const segmenti = [];
  let corrente = [];
  valori.forEach((v, i) => {
    const x = n - valori.length + i;
    if (v == null) {
      if (corrente.length) segmenti.push(corrente);
      corrente = [];
    } else {
      corrente.push(`${x},${100 - (v / massimo) * 100}`);
    }
  });
  if (corrente.length) segmenti.push(corrente);
  const perdite = valori.map((v, i) => (v == null ? n - valori.length + i : null)).filter((x) => x != null);

  return (
    <svg className="grafico" viewBox={`0 0 ${n - 1} 100`} preserveAspectRatio="none" role="img" aria-label="Andamento del ping">
      {[25, 50, 75].map((y) => (
        <line key={y} x1="0" x2={n} y1={y} y2={y} className="grafico-griglia" />
      ))}
      {segmenti.map((s, i) =>
        s.length === 1 ? (
          <circle key={i} cx={s[0].split(",")[0]} cy={s[0].split(",")[1]} r="0.8" className="grafico-punto" />
        ) : (
          <polyline key={i} points={s.join(" ")} className="grafico-linea" />
        )
      )}
      {perdite.map((x) => (
        <line key={`p${x}`} x1={x} x2={x} y1="0" y2="100" className="grafico-perdita" />
      ))}
    </svg>
  );
}
