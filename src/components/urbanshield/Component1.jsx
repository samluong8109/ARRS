import React, { useState, useMemo } from "react";

// ── Component 1: Financial fragility model ─────────────────────────────────
// Ratio + runway + tier + residual + stress test + depletion timeline,
// PLUS: time-to-crisis headline and a Monte Carlo runway distribution.
// Pure arithmetic + simulation on user-entered numbers. No external data.
// ───────────────────────────────────────────────────────────────────────────

const money = (n) =>
  n === "" || n == null || isNaN(n)
    ? "N/A"
    : "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const C = {
  ok: "#4a7d74", watch: "#b8863b", risk: "#a8544a",
  ink: "#1f2a30", sub: "#6a7780", faint: "#8a97a0",
  line: "#e6e9eb", track: "#eef1f2",
};

// standard-normal sample (Box–Muller)
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function Field({ label, hint, prefix, value, onChange }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#3a4750", marginBottom: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: C.faint, marginBottom: 6 }}>{hint}</div>}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {prefix && <span style={{ position: "absolute", left: 12, color: C.faint, fontSize: 15, pointerEvents: "none" }}>{prefix}</span>}
        <input
          type="number" min="0" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", padding: prefix ? "10px 12px 10px 26px" : "10px 12px", fontSize: 15,
            border: "1px solid #d8dee2", borderRadius: 8, outline: "none", fontFamily: "inherit",
            color: C.ink, background: "#fff", boxSizing: "border-box" }}
          onFocus={(e) => (e.target.style.borderColor = C.ok)}
          onBlur={(e) => (e.target.style.borderColor = "#d8dee2")}
        />
      </div>
    </label>
  );
}

function Card({ children, style }) {
  return <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 22, marginBottom: 18, ...style }}>{children}</div>;
}

function SectionTitle({ kicker, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {kicker && <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, fontWeight: 700 }}>{kicker}</div>}
      <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{children}</div>
    </div>
  );
}

function BurdenMeter({ ratio }) {
  const pct = Math.min(ratio * 100, 100);
  const color = ratio > 0.5 ? C.risk : ratio > 0.3 ? C.watch : C.ok;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ position: "relative", height: 12, background: C.track, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width .35s ease, background .35s ease" }} />
        {[30, 50].map((g) => <div key={g} style={{ position: "absolute", left: `${g}%`, top: 0, bottom: 0, width: 1, background: "#ffffffcc" }} />)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.faint, marginTop: 4 }}>
        <span>0%</span><span style={{ marginLeft: "auto", marginRight: "18%" }}>30% burdened</span><span>50% severe</span>
      </div>
    </div>
  );
}

function RunwayBar({ months }) {
  const capped = Math.min(months, 6), full = Math.floor(capped), frac = capped - full;
  const segs = [];
  for (let i = 0; i < 6; i++) segs.push(i < full ? 1 : i === full ? frac : 0);
  const color = months < 1 ? C.risk : months < 2 ? C.watch : C.ok;
  return (
    <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
      {segs.map((f, i) => (
        <div key={i} style={{ flex: 1, height: 26, background: C.track, borderRadius: 5, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, bottom: 0, top: 0, width: `${f * 100}%`, background: color, transition: "width .35s ease, background .35s ease" }} />
        </div>
      ))}
    </div>
  );
}

function ResidualWaterfall({ income, rent, essentials, residual }) {
  const max = Math.max(income, 1);
  const row = (label, val, color) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#3a4750", marginBottom: 3 }}>
        <span>{label}</span><span style={{ fontWeight: 600 }}>{money(val)}</span>
      </div>
      <div style={{ height: 10, background: C.track, borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: `${Math.min((val / max) * 100, 100)}%`, height: "100%", background: color, borderRadius: 5, transition: "width .35s ease" }} />
      </div>
    </div>
  );
  const resColor = residual < 0 ? C.risk : residual < 0.1 * income ? C.watch : C.ok;
  return (
    <div>
      {row("Take-home income", income, "#9fb4ad")}
      {row("− Rent", rent, "#c8a27a")}
      {row("− Other essentials", essentials, "#c8a27a")}
      <div style={{ height: 1, background: C.line, margin: "12px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Left over each month</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: resColor }}>{money(residual)}</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>
        {residual < 0 ? "You spend more than you bring in. Savings cover the gap each month."
          : residual < 0.1 * income ? "Very little slack after essentials. A small shock erases it."
          : "You have breathing room after rent and essentials."}
      </div>
    </div>
  );
}

function DepletionChart({ savings, monthlyNet, oneTime, horizon = 12 }) {
  const W = 480, H = 170, padL = 46, padR = 14, padT = 14, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const start = Math.max(savings - oneTime, 0);
  const pts = []; let bal = savings - oneTime;
  for (let m = 0; m <= horizon; m++) { pts.push({ m, bal }); bal += monthlyNet; }
  const yMax = Math.max(savings, start, 1) * 1.1;
  const x = (m) => padL + (m / horizon) * plotW;
  const y = (v) => padT + plotH - (Math.max(v, 0) / yMax) * plotH;
  let zeroMonth = null;
  if (monthlyNet < 0 && start > 0) zeroMonth = start / -monthlyNet;
  const linePts = pts.map((p) => `${x(p.m)},${y(p.bal)}`).join(" ");
  const areaPts = `${padL},${padT + plotH} ${linePts} ${x(horizon)},${padT + plotH}`;
  const draining = monthlyNet < 0;
  const stroke = zeroMonth != null && zeroMonth <= horizon ? C.risk : draining ? C.watch : C.ok;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={padT + plotH * (1 - f)} y2={padT + plotH * (1 - f)} stroke={C.line} strokeWidth="1" />
            <text x={padL - 8} y={padT + plotH * (1 - f) + 4} textAnchor="end" fontSize="10" fill={C.faint}>{money(Math.round((yMax * f) / 100) * 100)}</text>
          </g>
        ))}
        <polygon points={areaPts} fill={stroke} opacity="0.08" />
        <polyline points={linePts} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        {zeroMonth != null && zeroMonth <= horizon && (
          <g>
            <line x1={x(zeroMonth)} x2={x(zeroMonth)} y1={padT} y2={padT + plotH} stroke={C.risk} strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx={x(zeroMonth)} cy={y(0)} r="4" fill={C.risk} />
          </g>
        )}
        {[0, 3, 6, 9, 12].map((m) => <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize="10" fill={C.faint}>{m === 0 ? "now" : `${m}mo`}</text>)}
      </svg>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>
        {!draining ? "In this scenario, your savings hold steady or grow."
          : zeroMonth <= horizon ? `Savings run out in about ${zeroMonth.toFixed(1)} months under this scenario.`
          : "Savings drain slowly and would last beyond a year at this rate."}
      </div>
    </div>
  );
}

// ── NEW: Monte Carlo survival curve ────────────────────────────────────────
function SurvivalChart({ survival, color, horizon }) {
  const W = 480, H = 190, padL = 40, padR = 14, padT = 16, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (m) => padL + ((m - 1) / (horizon - 1)) * plotW;
  const y = (v) => padT + plotH - (v / 100) * plotH;
  const linePts = survival.map((s, i) => `${x(i + 1)},${y(s * 100)}`).join(" ");
  const areaPts = `${padL},${padT + plotH} ${linePts} ${x(horizon)},${padT + plotH}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth="1" />
          <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill={C.faint}>{v}%</text>
        </g>
      ))}
      {[6, 12].map((mk) => (
        <g key={mk}>
          <line x1={x(mk)} x2={x(mk)} y1={padT} y2={padT + plotH} stroke={C.line} strokeWidth="1" />
          <text x={x(mk)} y={padT - 4} textAnchor="middle" fontSize="9" fill={C.faint}>{mk}mo</text>
        </g>
      ))}
      <polygon points={areaPts} fill={color} opacity="0.08" />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {[1, 6, 12, 18, 24].map((m) => <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize="10" fill={C.faint}>{m}</text>)}
    </svg>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#3a4750", marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontWeight: 700 }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.risk }} />
    </div>
  );
}

export default function RentBurdenCalculator() {
  const [rent, setRent] = useState("");
  const [income, setIncome] = useState("");
  const [savings, setSavings] = useState("");
  const [setAside, setSetAside] = useState("");
  const [behind, setBehind] = useState(false);

  const [utilities, setUtilities] = useState("");
  const [foodEtc, setFoodEtc] = useState("");
  const [debt, setDebt] = useState("");
  const [transport, setTransport] = useState("");
  const [otherEss, setOtherEss] = useState("");

  const [rentUp, setRentUp] = useState(0);
  const [incomeDown, setIncomeDown] = useState(0);
  const [emergency, setEmergency] = useState(0);

  // Monte Carlo assumptions
  const [incomeVol, setIncomeVol] = useState(8);   // ±%
  const [shockProb, setShockProb] = useState(5);   // %/mo
  const [shockSize, setShockSize] = useState(500); // $

  const r = parseFloat(rent) || 0;
  const inc = parseFloat(income) || 0;
  const sav = parseFloat(savings) || 0;
  const aside = parseFloat(setAside) || 0;
  const essentials =
    (parseFloat(utilities) || 0) + (parseFloat(foodEtc) || 0) + (parseFloat(debt) || 0) +
    (parseFloat(transport) || 0) + (parseFloat(otherEss) || 0);

  const ready = r > 0 && inc > 0;

  const base = useMemo(() => {
    if (!ready) return null;
    const ratio = r / inc, runway = sav / r, covers = aside >= r;
    const shortfall = Math.max(r - aside, 0);
    const residual = inc - r - essentials;
    const reasons = [];
    if (behind) reasons.push("You're already behind on rent.");
    if (ratio > 0.5) reasons.push("Rent takes more than half your income.");
    else if (ratio > 0.3) reasons.push("Rent is above the 30% affordability line.");
    if (residual < 0) reasons.push("You spend more than you earn after essentials.");
    if (runway < 1) reasons.push("Savings cover less than one month of rent.");
    else if (runway < 2) reasons.push("Savings cover under two months of rent.");
    if (!covers && aside > 0) reasons.push(`Your monthly set-aside is ${money(shortfall)} short of rent.`);
    let tier, headline;
    if (behind || (ratio > 0.5 && runway < 1) || (residual < 0 && runway < 1)) { tier = "risk"; headline = "At risk. Worth acting now"; }
    else if (ratio > 0.5 || runway < 2 || !covers || residual < 0) { tier = "watch"; headline = "Watch. Some warning signs"; }
    else { tier = "ok"; headline = "Steady. No immediate flags"; }
    return { ratio, runway, covers, shortfall, residual, tier, headline, reasons };
  }, [ready, r, inc, sav, aside, behind, essentials]);

  const scenario = useMemo(() => {
    if (!ready) return null;
    const rentS = r * (1 + rentUp / 100), incomeS = inc * (1 - incomeDown / 100);
    const monthlyNet = incomeS - rentS - essentials;
    const start = Math.max(sav - emergency, 0);
    const drains = monthlyNet < 0;
    const monthsLeft = drains && start > 0 ? start / -monthlyNet : Infinity;
    let sTier = "ok";
    if (monthsLeft < 1) sTier = "risk";
    else if (monthsLeft < 3 || monthlyNet < 0) sTier = "watch";
    return { rentS, incomeS, monthlyNet, monthsLeft, sTier };
  }, [ready, r, inc, sav, essentials, rentUp, incomeDown, emergency]);

  // ── NEW: Monte Carlo simulation ──
  const mc = useMemo(() => {
    if (!ready) return null;
    const N = 2000, H = 24;
    const vol = incomeVol / 100, p = shockProb / 100;
    const solventAt = new Array(H).fill(0);
    const firstZero = [];
    let out6 = 0, out12 = 0;
    for (let s = 0; s < N; s++) {
      let bal = sav, zeroed = 0;
      for (let m = 0; m < H; m++) {
        const drawInc = Math.max(inc * (1 + vol * randn()), 0);
        const surprise = Math.random() < p ? shockSize : 0;
        bal += drawInc - r - essentials - surprise;
        if (bal > 0) solventAt[m] += 1;
        else if (!zeroed) { zeroed = m + 1; firstZero.push(zeroed); }
      }
      if (zeroed) { if (zeroed <= 6) out6++; if (zeroed <= 12) out12++; }
    }
    const survival = solventAt.map((c) => c / N);
    const prob6 = out6 / N, prob12 = out12 / N;
    const median = firstZero.length
      ? firstZero.slice().sort((a, b) => a - b)[Math.floor(firstZero.length / 2)]
      : null;
    return { survival, prob6, prob12, median, N, H };
  }, [ready, r, inc, sav, essentials, incomeVol, shockProb, shockSize]);

  const T = {
    risk: { bg: "#f7ecea", border: "#d9b3ad", dot: C.risk, text: "#7d3a32", label: "At risk" },
    watch: { bg: "#f8f2e6", border: "#dfc99b", dot: C.watch, text: "#7a5a22", label: "Watch" },
    ok: { bg: "#ecf3f1", border: "#aeccc4", dot: C.ok, text: "#2f5049", label: "Steady" },
  };

  // time-to-crisis headline (deterministic, current burn, no shock)
  const ttc = useMemo(() => {
    if (!base) return null;
    if (behind) return { text: "Already in crisis", color: C.risk };
    if (base.residual >= 0) return { text: "No crisis at current burn", color: C.ok };
    const m = sav / -base.residual;
    return { text: `~${m.toFixed(1)} months of savings left`, color: m < 3 ? C.risk : C.watch };
  }, [base, behind, sav]);

  const actionsFor = (tier) => ({
    risk: [
      "Call 211 (or your state's rental-assistance line) to ask about emergency rental assistance today.",
      "Contact your landlord in writing to propose a payment plan before anything is filed.",
      "Look up your state's required notice period so you know your actual timeline.",
      "Contact local legal aid. Many offer free help before a court date.",
    ],
    watch: [
      "Aim to build at least one month of rent in reserve before anything shifts.",
      "Review recurring expenses for anything you can pause while you rebuild cushion.",
      "Look up rental-assistance options in your area now, so you're ready if you need them.",
    ],
    ok: [
      "Keep your buffer where it is and revisit if rent rises or income changes.",
      "Consider automating your monthly rent set-aside so cushion grows on its own.",
    ],
  }[tier]);

  const mcColor = mc ? (mc.prob6 >= 0.33 ? C.risk : mc.prob12 >= 0.33 ? C.watch : C.ok) : C.ok;

  return (
    <div style={{ minHeight: "100vh", background: "#f6f4ef",
      fontFamily: "inherit",
      padding: "28px 16px", color: C.ink }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>Rent check</div>
          <h1 style={{ fontSize: 26, margin: "4px 0 6px", fontWeight: 700 }}>How much cushion do you have?</h1>
          <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.5, margin: 0 }}>
            Enter what you know. This models your own numbers. It isn't a prediction, and nothing is sent anywhere.
          </p>
        </header>

        <Card>
          <Field label="Monthly rent" prefix="$" value={rent} onChange={setRent} />
          <Field label="Monthly take-home income" hint="After taxes. What actually lands in your account." prefix="$" value={income} onChange={setIncome} />
          <Field label="Savings / cash on hand" hint="What you could put toward rent today if you had to." prefix="$" value={savings} onChange={setSavings} />
          <Field label="Amount you set aside for rent each month" hint="From income, before other spending." prefix="$" value={setAside} onChange={setSetAside} />
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, cursor: "pointer", fontSize: 14, color: "#3a4750" }}>
            <input type="checkbox" checked={behind} onChange={(e) => setBehind(e.target.checked)} style={{ width: 17, height: 17, accentColor: C.risk }} />
            I'm currently behind on rent
          </label>
        </Card>

        <Card>
          <SectionTitle kicker="Optional, but sharper">Monthly essentials</SectionTitle>
          <p style={{ fontSize: 12.5, color: C.sub, margin: "-6px 0 14px" }}>Fill these in for a fuller picture than rent alone can show.</p>
          <Field label="Utilities" prefix="$" value={utilities} onChange={setUtilities} />
          <Field label="Food & groceries" prefix="$" value={foodEtc} onChange={setFoodEtc} />
          <Field label="Debt payments" prefix="$" value={debt} onChange={setDebt} />
          <Field label="Transportation" prefix="$" value={transport} onChange={setTransport} />
          <Field label="Other essentials" hint="Childcare, medical, insurance, etc." prefix="$" value={otherEss} onChange={setOtherEss} />
        </Card>

        {!ready && <div style={{ fontSize: 13, color: C.faint, textAlign: "center", padding: "8px 0" }}>Enter at least your rent and income to see your result.</div>}

        {base && (
          <>
            <Card style={{ background: T[base.tier].bg, border: `1px solid ${T[base.tier].border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: T[base.tier].dot, flexShrink: 0 }} />
                <span style={{ fontSize: 17, fontWeight: 700, color: T[base.tier].text }}>{base.headline}</span>
              </div>
              {base.reasons.length > 0 && (
                <ul style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 13.5, color: T[base.tier].text, lineHeight: 1.6 }}>
                  {base.reasons.map((rsn, i) => <li key={i}>{rsn}</li>)}
                </ul>
              )}
            </Card>

            {/* NEW: time-to-crisis headline */}
            <div style={{ textAlign: "center", padding: "6px 0 20px" }}>
              <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>Estimated time to crisis</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: ttc.color, lineHeight: 1.2 }}>{ttc.text}</div>
              <div style={{ fontSize: 12.5, color: C.sub }}>based on your numbers today, before any shock</div>
            </div>

            <Card>
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#3a4750" }}>Rent as share of income</span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(base.ratio * 100)}%</span>
                </div>
                <BurdenMeter ratio={base.ratio} />
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8 }}>
                  {base.ratio > 0.5 ? "Severely rent-burdened. Over half your income goes to rent."
                    : base.ratio > 0.3 ? "Rent-burdened. Above the standard 30% affordability line."
                    : "Within the 30% affordability guideline."}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#3a4750" }}>Savings runway</span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{base.runway >= 6 ? "6+ mo" : `${base.runway.toFixed(1)} mo`}</span>
                </div>
                <RunwayBar months={base.runway} />
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8 }}>
                  {base.runway < 1 ? "Less than a full month of rent in reserve."
                    : `Your savings could cover about ${base.runway.toFixed(1)} months of rent if income stopped.`}
                  {!base.covers && aside > 0 && <> At your current set-aside you're drawing down {money(base.shortfall)}/mo.</>}
                </div>
              </div>
            </Card>

            {essentials > 0 && (
              <Card>
                <SectionTitle kicker="Where the money goes">What's left after essentials</SectionTitle>
                <ResidualWaterfall income={inc} rent={r} essentials={essentials} residual={base.residual} />
              </Card>
            )}

            <Card>
              <SectionTitle kicker="Stress test">How fragile is this?</SectionTitle>
              <p style={{ fontSize: 12.5, color: C.sub, margin: "-6px 0 16px" }}>Drag to apply a shock. This is a what-if, not a forecast.</p>
              <Slider label="Rent increase" value={rentUp} min={0} max={50} step={1} onChange={setRentUp} fmt={(v) => `+${v}%`} />
              <Slider label="Income drop" value={incomeDown} min={0} max={100} step={1} onChange={setIncomeDown} fmt={(v) => `−${v}%`} />
              <Slider label="One-time emergency expense" value={emergency} min={0} max={Math.max(sav, 5000)} step={50} onChange={setEmergency} fmt={(v) => money(v)} />
              {scenario && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 14px", padding: "8px 12px",
                    background: T[scenario.sTier].bg, border: `1px solid ${T[scenario.sTier].border}`, borderRadius: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: T[scenario.sTier].dot }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: T[scenario.sTier].text }}>Under this scenario: {T[scenario.sTier].label}</span>
                    {(rentUp > 0 || incomeDown > 0 || emergency > 0) && (
                      <button onClick={() => { setRentUp(0); setIncomeDown(0); setEmergency(0); }}
                        style={{ marginLeft: "auto", fontSize: 12, color: C.sub, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>reset</button>
                    )}
                  </div>
                  <DepletionChart savings={sav} monthlyNet={scenario.monthlyNet} oneTime={emergency} />
                </>
              )}
            </Card>

            {/* NEW: Monte Carlo runway distribution */}
            {mc && (
              <Card>
                <SectionTitle kicker="Monte Carlo">Runway across many possible futures</SectionTitle>
                <p style={{ fontSize: 12.5, color: C.sub, margin: "-6px 0 14px" }}>
                  Instead of one straight line, this simulates {mc.N.toLocaleString()} futures where income wobbles and surprise costs hit at random, then reports how often you run out.
                </p>
                <Slider label="Income month-to-month swing" value={incomeVol} min={0} max={40} step={1} onChange={setIncomeVol} fmt={(v) => `±${v}%`} />
                <Slider label="Chance of a surprise cost each month" value={shockProb} min={0} max={30} step={1} onChange={setShockProb} fmt={(v) => `${v}%`} />
                <Field label="Typical surprise cost" prefix="$" value={shockSize} onChange={(v) => setShockSize(parseFloat(v) || 0)} />
                <div style={{ display: "flex", gap: 10, margin: "8px 0 16px" }}>
                  {[
                    { l: "Run out ≤6 mo", v: `${Math.round(mc.prob6 * 100)}%` },
                    { l: "Run out ≤12 mo", v: `${Math.round(mc.prob12 * 100)}%` },
                    { l: "Median to zero", v: mc.median == null ? "N/A" : `${mc.median} mo` },
                  ].map((m, i) => (
                    <div key={i} style={{ flex: 1, background: C.track, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 19, fontWeight: 800, color: C.ink }}>{m.v}</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{m.l}</div>
                    </div>
                  ))}
                </div>
                <SurvivalChart survival={mc.survival} color={mcColor} horizon={mc.H} />
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>% of simulated futures still solvent, month by month</div>
                <p style={{ fontSize: 12.5, color: C.sub, marginTop: 10 }}>
                  We ran {mc.N.toLocaleString()} scenarios. In {Math.round(mc.prob12 * 100)}% of them, you run out within a year. This shows a range of outcomes, not a single prediction.
                </p>
              </Card>
            )}

            <Card>
              <SectionTitle kicker="What to do next">Suggested next steps</SectionTitle>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "#3a4750", lineHeight: 1.7 }}>
                {actionsFor(base.tier).map((a, i) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
              </ul>
              <p style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginTop: 14 }}>General information, not legal advice. Rules vary by state and city, so confirm locally.</p>
            </Card>

            <p style={{ fontSize: 11.5, color: "#9aa5ac", lineHeight: 1.5, marginTop: 4, textAlign: "center" }}>
              A math tool, not financial or legal advice. The 30% and 50% burden lines follow HUD's standard definitions. Everything here is a scenario based on the numbers you set, not a forecast.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
