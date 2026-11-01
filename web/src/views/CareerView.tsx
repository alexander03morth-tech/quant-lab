import { useState } from "react";
import { Link } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../components/Caption";
import { Info } from "../components/Info";
import { cssVar, Plot, scene3d } from "../components/Plot";
import { Seg } from "../components/Slider";
import { CAREERS, IB_DIVISIONS, PE_FUNNEL, PE_STRATEGIES } from "../content/careers";

type Tab = "uppgifter" | "roller" | "dag" | "special";

export function CareerView({ track }: { track: "ib" | "pe" | "aktie" | "kvant" }) {
  const c = CAREERS[track];
  const [tab, setTab] = useState<Tab>("uppgifter");
  const special = track === "pe" ? "Så hittas bolag" : track === "ib" ? "Bankens avdelningar" : null;
  return (
    <>
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Så funkar jobbet</span><span className="live">{c.kicker}</span></div>
          <h1 className="hero-title">{c.title}</h1>
          <p className="hero-sub" style={{ maxWidth: "78ch" }}>{c.purpose}</p>
          <Seg label="Avsnitt" value={tab} onChange={setTab} options={[
            { value: "uppgifter", label: "Syfte & arbetsuppgifter" }, { value: "roller", label: "Roller & karriär" }, { value: "dag", label: "En vanlig dag" },
            ...(special ? [{ value: "special" as Tab, label: special }] : []),
          ]} />
        </div>
      </div>

      {tab === "uppgifter" && (
        <div className="grid">
          <section className="span-8 stack">
            {c.tasks.map((t, i) => (
              <div className="task-card" key={t.title}>
                <div className="task-n">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <div className="task-title">{t.title} {t.concept && <Info id={t.concept} />}</div>
                  <p>{t.text}</p>
                  {t.link && <Link className="chip" to={t.link.to}>Prova i {t.link.label} →</Link>}
                </div>
              </div>
            ))}
          </section>
          <aside className="span-4 stack">
            <section className="card"><div className="card-body">
              <div className="explain-kicker">Vem är kunden?</div>
              <p style={{ margin: "6px 0 0" }}>{c.who}</p>
            </div></section>
            <section className="card"><div className="card-body">
              <div className="explain-kicker">Det här behöver man kunna</div>
              <ul className="check-list">{c.skills.map((s) => <li key={s}>{s}</li>)}</ul>
            </div></section>
            <section className="card"><div className="card-body">
              <div className="explain-kicker">Var jobbar man?</div>
              <ul className="plain-list">{c.where.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>Exempel på typiska arbetsgivare, inte en fullständig lista.</p>
            </div></section>
          </aside>
        </div>
      )}

      {tab === "roller" && (
        <div className="grid">
          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Karriärstegen</h2><span className="dim" style={{ fontSize: 12 }}>typiska titlar och år – varierar mellan firmor</span></div>
            <div className="card-body">
              <ol className="ladder">
                {c.roles.map((r, i) => (
                  <li key={r.title} style={{ ["--step" as string]: i }}>
                    <div className="ladder-bar" />
                    <div className="ladder-body">
                      <div className="ladder-title">{r.title} {r.years && <span className="mono dim">{r.years}</span>}</div>
                      <p>{r.does}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <section className="card span-12"><div className="card-body">
            <div className="explain-kicker">Och sedan?</div>
            <p style={{ margin: "6px 0 0" }}>{c.next}</p>
          </div></section>
        </div>
      )}

      {tab === "dag" && (
        <div className="grid">
          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">01</span>En typisk dag</h2><span className="dim" style={{ fontSize: 12 }}>sammansatt exempel – ingen dag är den andra lik</span></div>
            <div className="card-body">
              <ol className="daylist">
                {c.day.map((d) => <li key={d.time}><span className="day-time">{d.time}</span><span>{d.what}</span></li>)}
              </ol>
            </div>
          </section>
        </div>
      )}

      {tab === "special" && track === "pe" && <PeSourcing />}
      {tab === "special" && track === "ib" && (
        <div className="grid">
          {IB_DIVISIONS.map((d) => (
            <section className="card span-4" key={d.id}><div className="card-body">
              <div className="task-title">{d.name} <Info id={d.concept} /></div>
              <p className="muted" style={{ margin: "6px 0 0" }}>{d.text}</p>
            </div></section>
          ))}
          <section className="card span-12"><div className="card-body">
            <div className="explain-kicker">Front, middle och back office</div>
            <p style={{ margin: "6px 0 0" }}>Avdelningarna ovan är ”front office” – de som möter kunder och gör affärer. Middle office (risk, compliance) kontrollerar att allt sker inom regler och limiter. Back office sköter avveckling, IT och administration. Alla behövs, men det är front office som oftast menas med ”investment banking”.</p>
          </div></section>
        </div>
      )}
    </>
  );
}

function PeSourcing() {
  const [sid, setSid] = useState("midmarket");
  const s = PE_STRATEGIES.find((x) => x.id === sid)!;
  const funnel: Data[] = [{
    type: "funnel", y: PE_FUNNEL.map((f) => f[0]), x: PE_FUNNEL.map((f) => f[1]), textinfo: "text", text: PE_FUNNEL.map((f) => `${f[1]} st · ${(f[1] / PE_FUNNEL[0][1] * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`) as any,
    marker: { color: [cssVar("--surface-2"), "#4a3b35", cssVar("--primary-strong"), cssVar("--primary"), cssVar("--accent"), cssVar("--pos")] },
    textfont: { family: cssVar("--mono"), color: cssVar("--text") }, connector: { line: { color: cssVar("--border") } },
    hovertemplate: "%{y}: %{x} st<extra></extra>",
  } as any];
  // 3D-karta: förväntad avkastning × innehavstid × skuldsättning
  const map: Record<string, [number, number, number]> = { largecap: [0.2, 5, 5], midmarket: [0.22, 5, 3], growth: [0.25, 5.5, 0.5], venture: [0.3, 7.5, 0], infra: [0.1, 11, 6], specialsits: [0.22, 3.5, 2] };
  const pts: Data[] = [{
    type: "scatter3d", mode: "markers+text", x: PE_STRATEGIES.map((p) => map[p.id][0]), y: PE_STRATEGIES.map((p) => map[p.id][1]), z: PE_STRATEGIES.map((p) => map[p.id][2]),
    text: PE_STRATEGIES.map((p) => p.name) as any, textposition: "top center", textfont: { size: 12, color: cssVar("--text") },
    marker: { size: PE_STRATEGIES.map((p) => (p.id === sid ? 14 : 9)), color: PE_STRATEGIES.map((p) => (p.id === sid ? cssVar("--accent") : cssVar("--series-b"))), line: { color: "#000", width: 1 } },
    customdata: PE_STRATEGIES.map((p) => p.short) as any, hovertemplate: "<b>%{text}</b><br>%{customdata}<extra></extra>",
  } as any];
  return (
    <div className="grid">
      <section className="card span-12">
        <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Olika fonder letar efter olika bolag <Info id="private-equity" /></h2></div>
        <div className="card-body">
          <div className="case-grid" style={{ marginTop: 0 }}>
            {PE_STRATEGIES.map((p) => (
              <button key={p.id} className="case" aria-pressed={p.id === sid} onClick={() => setSid(p.id)}><b>{p.name}</b><span>{p.short}</span></button>
            ))}
          </div>
        </div>
      </section>

      <section className="card span-12">
        <div className="card-head"><h2 className="card-title"><span className="idx">02</span>{s.name}</h2><span className="dim" style={{ fontSize: 12 }}>{s.firms}</span></div>
        <div className="card-body">
          <div className="facts">
            {([["Storlek", s.size], ["Ägarandel", s.ownership], ["Skuld", s.debt], ["Avkastningsmål", s.target], ["Innehavstid", s.hold]] as const).map(([k, v]) => (
              <div key={k}><div className="dim" style={{ fontSize: 12 }}>{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>
            ))}
          </div>
          <div className="grid" style={{ marginTop: 14 }}>
            <div className="span-6">
              <div className="explain-kicker">Vad de letar efter</div>
              <ul className="check-list">{s.lookFor.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="span-6">
              <div className="explain-kicker">Var de hittar bolagen</div>
              <ul className="channel-list">{s.channels.map((ch) => <li key={ch.name}><b>{ch.name}</b><span>{ch.text}</span></li>)}</ul>
            </div>
            <div className="span-6"><div className="explain-kicker">Hur de skapar värde</div><p style={{ margin: "6px 0 0" }}>{s.value}</p></div>
            <div className="span-6"><div className="explain-kicker">Hur de säljer (exit)</div><p style={{ margin: "6px 0 0" }}>{s.exit}</p></div>
          </div>
          <div className="eli5" style={{ marginTop: 14 }}><b className="k">Påhittat exempel</b>{s.example}</div>
        </div>
      </section>

      <section className="card span-6">
        <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Från tusen bolag till två affärer</h2></div>
        <div className="card-body"><Plot ariaLabel="Tratt: hur många bolag en PE-fond tittar på per genomförd affär" data={funnel} height={320} layout={{ hovermode: "closest", yaxis: { side: "left", automargin: true } as any, margin: { l: 8, r: 8, t: 8, b: 8 } }} /></div>
        <Caption>En medelstor fond kan titta på runt tusen bolag per år för att göra ett par affärer. <b>Det mesta av jobbet är att säga nej</b> – och att bygga relationer med ägare som kanske säljer om några år. Siffrorna är en tumregel.</Caption>
      </section>
      <section className="card span-6 lab3d">
        <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Strategikartan i 3D</h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera</span></div>
        <div className="card-body"><Plot ariaLabel="3D: PE-strategier efter avkastningsmål, innehavstid och skuldsättning" data={pts} height={320}
          onClick={(pt) => { const p = PE_STRATEGIES[pt?.pointNumber]; if (p) setSid(p.id); }}
          layout={scene3d({ x: "Avkastningsmål", y: "Innehavstid (år)", z: "Skuld (× EBITDA)" }, { xaxis: { tickformat: ".0%" }, camera: { eye: { x: 1.6, y: -1.4, z: 0.9 } } } as any)} /></div>
        <Caption>Varje strategi placerad efter vad den siktar på: venture vill ha högst avkastning men tar störst risk och använder ingen skuld; infrastruktur nöjer sig med lägre avkastning men äger länge och lånar mycket mot säkra kassaflöden. Klicka på en punkt.</Caption>
      </section>
    </div>
  );
}
