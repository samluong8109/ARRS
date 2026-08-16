import React, { useState, useEffect } from "react";
import {
  Building2, Landmark, Banknote, ShieldCheck, Zap, CheckCircle2,
  AlertTriangle, Play, Pause, RotateCcw, Lock, ChevronRight, Wallet,
  Cpu, Activity, TrendingUp, UserCheck,
} from "lucide-react";

/* ---------------- config ---------------- */
const THRESHOLD = 0.75; // action threshold — a policy decision, kept explicit

const SCENARIOS = {
  high:       { label: "High risk",   final: 0.86 },
  borderline: { label: "Borderline",  final: 0.72 },
  low:        { label: "Stable",      final: 0.41 },
};

const SIGNALS = [
  { k: "Rent-to-income", v: "58%" },
  { k: "Income volatility", v: "+34%" },
  { k: "Rent change · 90d", v: "+22%" },
  { k: "Late payments · 12mo", v: "3" },
  { k: "Tract eviction filings", v: "2.1× base" },
];
const REASONS = ["Rent spiked +22%", "Income dipped", "Rent-to-income 58%"];

// transfer lifecycle — verification is a hard gate before money moves
const FLOW = [
  { key: "REQUEST_RECEIVED", label: "Request received", tag: "Auto-filed", pos: 0.06,
    checks: ["Relief request opened by model", "Amount matched to back rent"] },
  { key: "VERIFY_TENANT", label: "Verify tenant", tag: "KYC · lease", pos: 0.06,
    checks: ["Identity (KYC) match", "Lease authenticity", "Rent-burden eligibility"] },
  { key: "VERIFY_LANDLORD", label: "Verify landlord", tag: "KYB · account", pos: 0.06,
    checks: ["Business identity (KYB)", "Bank account ownership", "Property deed match"] },
  { key: "VERIFY_FUNDER", label: "Verify funder", tag: "KYC · source of funds", pos: 0.06,
    checks: ["Funder identity", "Source-of-funds cleared", "Commitment available"] },
  { key: "MATCH_CAPITAL", label: "Match capital", tag: "Reserve, not hold", pos: 0.1,
    checks: ["Reservation hold placed", "Funds claimed from funder pool"] },
  { key: "EXECUTING", label: "Execute over FedNow", tag: "Partner instructed", pos: 0.5,
    checks: ["Idempotency key set", "Partner debits funder", "FedNow push initiated"] },
  { key: "SETTLED", label: "Settled", tag: "Landed at landlord", pos: 1,
    checks: ["Funds credited to landlord", "Ledger entry written", "All parties notified"] },
];

const RELIEF_DEFAULT = { id: "RLF-4482", tenant: "A. Morales", landlord: "Riverbend Holdings LLC", funder: "Meridian Impact Fund", amountCents: 184000 };
const fmt = (c) => c.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const leftPct = (pos) => 4 + pos * 92;

// detection sub-stages (IDLE / CLEARED handled separately)
const DETECT_STEPS = [
  { key: "MONITORING", label: "Monitor signals" },
  { key: "SCORING", label: "Risk model scores" },
  { key: "FLAGGED", label: "Threshold crossed" },
  { key: "AUTO_FILED", label: "Auto-file request" },
  { key: "AWAITING_CONSENT", label: "Confirm need" },
];
const detectRank = (s) => DETECT_STEPS.findIndex((d) => d.key === s);

export default function EmergencyTransferConsole() {
  const [scenario, setScenario] = useState("high");
  const [relief, setRelief] = useState(RELIEF_DEFAULT);
  const [amountInput, setAmountInput] = useState((RELIEF_DEFAULT.amountCents / 100).toFixed(2));
  const [scoreOverride, setScoreOverride] = useState("");
  const [detectStage, setDetectStage] = useState("IDLE");
  const [score, setScore] = useState(0);
  const [transferStarted, setTransferStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [heldReason, setHeldReason] = useState("");
  const [failAt, setFailAt] = useState("NONE");
  const [running, setRunning] = useState(false);

  const overrideNum = scoreOverride === "" ? null : Math.max(0, Math.min(1, Number(scoreOverride)));
  const final = overrideNum == null || isNaN(overrideNum) ? SCENARIOS[scenario].final : overrideNum;
  const crossed = final >= THRESHOLD;

  const reset = () => {
    setDetectStage("IDLE"); setScore(0); setTransferStarted(false);
    setStepIndex(0); setHeld(false); setHeldReason(""); setRunning(false);
  };

  const confirmNeed = () => setTransferStarted(true);

  const advanceDetect = () => {
    switch (detectStage) {
      case "IDLE": return setDetectStage("MONITORING");
      case "MONITORING": return setDetectStage("SCORING");
      case "SCORING": return setDetectStage(crossed ? "FLAGGED" : "CLEARED");
      case "FLAGGED": return setDetectStage("AUTO_FILED");
      case "AUTO_FILED": return setDetectStage("AWAITING_CONSENT");
      case "AWAITING_CONSENT": return confirmNeed();
      default: return;
    }
  };

  const advanceTransfer = () => {
    if (held || stepIndex >= FLOW.length - 1) return;
    const next = stepIndex + 1;
    const ns = FLOW[next];
    if (failAt !== "NONE" && ns.key === failAt) {
      setHeld(true);
      setHeldReason(`${ns.label.toLowerCase()} failed. Reservation released, sent to manual review.`);
      setRunning(false);
      return;
    }
    setStepIndex(next);
  };

  const advance = () => (transferStarted ? advanceTransfer() : advanceDetect());

  // animate the score toward its stage target
  useEffect(() => {
    const target = detectStage === "IDLE" ? 0 : detectStage === "MONITORING" ? final * 0.62 : final;
    const id = setInterval(() => {
      setScore((s) => (Math.abs(target - s) < 0.004 ? target : s + (target - s) * 0.18));
    }, 40);
    return () => clearInterval(id);
  }, [detectStage, final]);

  // auto-run
  const finished = held || detectStage === "CLEARED" || (transferStarted && stepIndex >= FLOW.length - 1);
  useEffect(() => {
    if (!running || finished) { if (finished) setRunning(false); return; }
    const t = setTimeout(() => {
      if (!transferStarted && detectStage === "AWAITING_CONSENT") confirmNeed();
      else advance();
    }, 1150);
    return () => clearTimeout(t);
  }, [running, detectStage, transferStarted, stepIndex, held, finished]); // eslint-disable-line

  const started = detectStage !== "IDLE";
  const meterColor = score >= THRESHOLD ? "#a8544a" : "#b8863b";
  const statusText = {
    IDLE: "Idle", MONITORING: "Monitoring signals…", SCORING: "Scoring…",
    FLAGGED: "Flagged, above threshold", AUTO_FILED: "Relief request auto-filed",
    AWAITING_CONSENT: "Awaiting confirmed need", CLEARED: "Below threshold, no action",
  }[detectStage];

  const cur = FLOW[stepIndex];
  const done = stepIndex >= FLOW.length - 1;
  const packetPos = held ? 0.06 : cur.pos;
  const accent = held ? "#a8544a" : done ? "#4a7d74" : "#b8863b";
  const railFillW = held ? 0 : leftPct(cur.pos) - 4;
  const stamp = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const showConsentBtn = !transferStarted && detectStage === "AWAITING_CONSENT";

  return (
    <div className="w-full min-h-screen" style={{ background: "#f6f4ef", color: "#1f2a30", fontFamily: "inherit", padding: "28px 16px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-[#8a97a0] mb-1">Rent Guard</div>
            <h1 className="text-xl md:text-2xl font-semibold text-[#1f2a30] tracking-tight">Relief trigger</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e9eb] bg-white px-3 py-1.5 text-[11px] font-medium text-[#3a4750]">
              <Lock size={12} className="text-[#4a7d74]" /> Model proposes · person confirms
            </span>
            <span className="rounded-md bg-white border border-[#e6e9eb] px-3 py-1.5 font-mono text-sm text-[#1f2a30]">
              {fmt(relief.amountCents)}
            </span>
          </div>
        </div>

        {/* -------- CASE INPUTS -------- */}
        <div className="rounded-2xl border border-[#e6e9eb] bg-white p-5 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <UserCheck size={15} className="text-[#4a7d74]" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#8a97a0]">Case inputs</span>
            </div>
            <span className="text-[11px] text-[#8a97a0]">
              {started ? "Reset to edit the case" : "Fill in the relief case, then run detection"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Relief ID" value={relief.id} disabled={started}
              onChange={(v) => setRelief((r) => ({ ...r, id: v }))} />
            <Field label="Tenant" value={relief.tenant} disabled={started}
              onChange={(v) => setRelief((r) => ({ ...r, tenant: v }))} />
            <Field label="Landlord" value={relief.landlord} disabled={started}
              onChange={(v) => setRelief((r) => ({ ...r, landlord: v }))} />
            <Field label="Funder" value={relief.funder} disabled={started}
              onChange={(v) => setRelief((r) => ({ ...r, funder: v }))} />
            <Field label="Amount (USD)" value={amountInput} type="number" disabled={started}
              onChange={(v) => {
                setAmountInput(v);
                const cents = Math.round((Number(v) || 0) * 100);
                setRelief((r) => ({ ...r, amountCents: cents }));
              }} />
            <Field label="Score override (0–1)" value={scoreOverride} type="number" placeholder="use scenario"
              disabled={started} onChange={(v) => setScoreOverride(v)} />
          </div>

          <p className="mt-3 text-[11px] text-[#8a97a0] leading-relaxed">
            These values drive the rail, the receipt and the idempotency key. Leave the score override
            blank to use the scenario preset below.
          </p>
        </div>


        {/* -------- DETECTION -------- */}
        <div className="rounded-2xl border border-[#e6e9eb] bg-white p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={15} className="text-[#4a7d74]" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#8a97a0]">Risk detection</span>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* signals */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#8a97a0] mb-2">
                <Activity size={12} /> Live signals
              </div>
              <div className="space-y-1.5">
                {SIGNALS.map((s) => (
                  <div key={s.k} className="flex items-center justify-between rounded-lg px-3 py-2"
                       style={{ background: started ? "#f6f4ef" : "transparent",
                                border: "1px solid " + (started ? "#e6e9eb" : "transparent"),
                                opacity: started ? 1 : 0.4, transition: "opacity 400ms, background 400ms" }}>
                    <span className="text-[13px] text-[#3a4750]">{s.k}</span>
                    <span className="font-mono text-[13px] text-[#1f2a30]">{s.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* meter */}
            <div className="flex flex-col">
              <div className="flex items-end justify-between mb-1">
                <span className="text-[11px] text-[#8a97a0] flex items-center gap-1"><TrendingUp size={12} /> P(miss next payment)</span>
                <span className="font-mono text-2xl text-[#1f2a30]" style={{ color: meterColor }}>{score.toFixed(2)}</span>
              </div>
              {/* track */}
              <div className="relative rounded-full" style={{ height: 12, background: "#eef1f2" }}>
                <div className="rounded-full" style={{ height: 12, width: `${score * 100}%`, background: meterColor, transition: "width 120ms linear, background 300ms" }} />
                {/* threshold tick */}
                <div className="absolute" style={{ left: `${THRESHOLD * 100}%`, top: -4, bottom: -4, width: 2, background: "#1f2a30" }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#8a97a0] font-mono">0.00</span>
                <span className="text-[10px] text-[#6a7780] font-mono" style={{ marginLeft: `${(THRESHOLD - 0.06) * 100}%` }}>
                  ▲ action {THRESHOLD}
                </span>
                <span className="text-[10px] text-[#8a97a0] font-mono">1.00</span>
              </div>

              <div className="mt-3 text-[13px] font-medium"
                   style={{ color: detectStage === "CLEARED" ? "#6a7780" : detectStage === "IDLE" ? "#8a97a0" : meterColor }}>
                {statusText}
              </div>

              {/* reasons / cleared */}
              {detectRank(detectStage) >= detectRank("FLAGGED") && crossed && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-widest text-[#8a97a0] mb-1.5">Top drivers (explainability)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {REASONS.map((r) => (
                      <span key={r} className="rounded-md border border-[#e6e9eb] bg-[#f6f4ef] px-2 py-1 text-[11px] text-[#3a4750]">{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {detectStage === "CLEARED" && (
                <p className="mt-2 text-[12px] text-[#8a97a0] leading-relaxed">
                  Score stayed under the threshold, so no request was filed and no money moved. The gate is what stops blind-firing.
                </p>
              )}
            </div>
          </div>

          {/* consent banner */}
          {showConsentBtn && (
            <div className="mt-4 rounded-xl border border-[#cfe0dc] bg-[#eef5f3] p-3 flex items-center gap-3">
              <UserCheck size={18} className="text-[#4a7d74] shrink-0" />
              <p className="text-[13px] text-[#3a4750] flex-1">
                Model filed a pre-verified request. A person (tenant or caseworker) confirms need before the money hits the rail.
              </p>
            </div>
          )}
          {transferStarted && (
            <div className="mt-4 flex items-center gap-2 text-[12px] text-[#4a7d74]">
              <CheckCircle2 size={14} /> Need confirmed, handed off to transfer
            </div>
          )}
        </div>

        {/* handoff arrow */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest"
               style={{ color: transferStarted ? "#4a7d74" : "#c8d0d4" }}>
            <span style={{ width: 40, height: 1, background: "currentColor", display: "inline-block" }} />
            hand off to money movement
            <ChevronRight size={14} />
          </div>
        </div>

        {/* -------- TRANSFER RAIL -------- */}
        <div className="rounded-2xl border border-[#e6e9eb] bg-white p-5 md:p-6 mb-4"
             style={{ opacity: transferStarted ? 1 : 0.45, transition: "opacity 500ms" }}>
          <div className="relative" style={{ height: 190 }}>
            <div className="absolute" style={{ left: "50%", top: 0, transform: "translateX(-50%)" }}>
              <div className="flex flex-col items-center">
                <div className="rounded-xl border border-[#e6e9eb] bg-[#eef1f2] px-3 py-2 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#4a7d74]" />
                  <span className="text-xs font-medium text-[#1f2a30]">Orchestrator</span>
                </div>
                <span className="mt-1 text-[10px] uppercase tracking-widest text-[#8a97a0]">no custody</span>
              </div>
            </div>
            <div className="absolute" style={{ left: "50%", top: 66, height: 30, transform: "translateX(-50%)", borderLeft: "2px dashed #475569" }} />
            <div className="absolute" style={{ left: "4%", right: "4%", top: 128, height: 3, background: "#dfe4e6", borderRadius: 2 }} />
            <div className="absolute" style={{ left: "4%", top: 128, height: 3, width: `${transferStarted ? railFillW : 0}%`, background: accent, borderRadius: 2, transition: "width 700ms ease, background 400ms" }} />
            <div className="absolute" style={{ left: `${leftPct(packetPos)}%`, top: 128, transform: "translate(-50%,-50%)", transition: "left 700ms ease" }}>
              <div className="rounded-full flex items-center justify-center shadow-lg"
                   style={{ width: 34, height: 34, background: accent, boxShadow: `0 0 18px ${accent}66` }}>
                {held ? <AlertTriangle size={16} className="text-white" />
                      : done && transferStarted ? <CheckCircle2 size={16} className="text-white" />
                      : <Banknote size={16} className="text-white" />}
              </div>
            </div>
            <RailNode leftPct={4} icon={<Wallet size={18} className="text-[#3a4750]" />} title="Funder" sub={relief.funder} />
            <RailNode leftPct={50} icon={<Landmark size={18} className="text-[#3a4750]" />} title="Partner bank" sub="BaaS · FedNow" />
            <RailNode leftPct={96} icon={<Building2 size={18} className="text-[#3a4750]" />} title="Landlord" sub={relief.landlord} />
          </div>
        </div>

        {/* lifecycle + detail */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#e6e9eb] bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#8a97a0] mb-3 px-1">Lifecycle</div>

            <div className="text-[10px] uppercase tracking-widest text-[#8a97a0] mb-1.5 px-1">Detection</div>
            <ol className="space-y-0.5 mb-3">
              {DETECT_STEPS.map((d) => {
                const active = !transferStarted && detectStage === d.key;
                const passed = transferStarted || detectRank(detectStage) > detectRank(d.key) ||
                  (detectStage === "CLEARED" && (d.key === "MONITORING" || d.key === "SCORING"));
                const skipped = detectStage === "CLEARED" && ["FLAGGED", "AUTO_FILED", "AWAITING_CONSENT"].includes(d.key);
                return (
                  <li key={d.key} className="flex items-center gap-3 rounded-lg px-3 py-1.5"
                      style={{ background: active ? "#f6f4ef" : "transparent", opacity: skipped ? 0.35 : 1 }}>
                    <StatusDot passed={passed} active={active} />
                    <span className="text-[13px] text-[#3a4750]">{d.label}</span>
                  </li>
                );
              })}
              {detectStage === "CLEARED" && (
                <li className="flex items-center gap-3 rounded-lg px-3 py-1.5">
                  <span className="flex items-center justify-center rounded-md" style={{ width: 20, height: 20, background: "#dfe4e6" }}>
                    <CheckCircle2 size={13} className="text-[#6a7780]" />
                  </span>
                  <span className="text-[13px] text-[#6a7780]">Cleared, no request filed</span>
                </li>
              )}
            </ol>

            <div className="text-[10px] uppercase tracking-widest text-[#8a97a0] mb-1.5 px-1">Transfer</div>
            <ol className="space-y-0.5">
              {FLOW.map((s, i) => {
                const active = transferStarted && !held && i === stepIndex;
                const heldHere = transferStarted && held && i === stepIndex;
                const passed = transferStarted && i < stepIndex;
                const isGate = ["VERIFY_TENANT", "VERIFY_LANDLORD", "VERIFY_FUNDER"].includes(s.key);
                return (
                  <li key={s.key} className="flex items-center gap-3 rounded-lg px-3 py-1.5"
                      style={{ background: active || heldHere ? "#f6f4ef" : "transparent", opacity: transferStarted ? 1 : 0.4 }}>
                    <StatusDot passed={passed} active={active} held={heldHere} idx={i + 1} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[#3a4750] truncate">{s.label}</div>
                      <div className="text-[10px] text-[#8a97a0]">{s.tag}{isGate ? " · gate" : ""}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* detail panel */}
          <div className="rounded-2xl border border-[#e6e9eb] bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#8a97a0] mb-3 px-1">
              {held ? "Held for review" : (transferStarted && done) ? "Settlement receipt" : transferStarted ? "Current step" : "Model decision"}
            </div>

            {!transferStarted ? (
              <div className="font-mono text-[12px] text-[#3a4750] space-y-2">
                <Row k="scenario" v={overrideNum == null || isNaN(overrideNum) ? SCENARIOS[scenario].label : "Custom score"} />
                <Row k="score" v={score.toFixed(2)} accent={meterColor} />
                <Row k="threshold" v={THRESHOLD.toFixed(2)} />
                <Row k="decision" v={detectStage === "CLEARED" ? "no action" : crossed ? "file relief" : "monitoring"}
                     accent={detectStage === "CLEARED" ? "#6a7780" : crossed ? "#a8544a" : "#b8863b"} />
                {detectRank(detectStage) >= detectRank("AUTO_FILED") && <Row k="relief_id" v={relief.id} />}
                {detectRank(detectStage) >= detectRank("AUTO_FILED") && <Row k="amount" v={fmt(relief.amountCents)} />}
              </div>
            ) : held ? (
              <div className="rounded-lg border border-[#e8d3d0] bg-[#f7ecea] p-3">
                <div className="flex items-center gap-2 text-[#a8544a] text-sm font-medium mb-1">
                  <AlertTriangle size={15} /> Routed to manual review
                </div>
                <p className="text-[13px] text-[#6a7780] leading-relaxed">{heldReason}.</p>
                <p className="text-[12px] text-[#8a97a0] mt-2">No funds moved. The capital reservation was released back to the funder.</p>
              </div>
            ) : done ? (
              <div className="font-mono text-[12px] text-[#3a4750] space-y-2">
                <Row k="relief_id" v={relief.id} />
                <Row k="payment_id" v="pmt_9f3ac71b" />
                <Row k="idempotency" v={`relief:${relief.id}`} />
                <Row k="rail" v="FEDNOW · instant" />
                <Row k="amount" v={fmt(relief.amountCents)} />
                <Row k="credited" v={relief.landlord} />
                <Row k="settled_at" v={stamp} accent="#4a7d74" />
              </div>
            ) : (
              <div>
                <div className="text-sm text-[#1f2a30] mb-1">{cur.label}</div>
                <div className="text-[11px] text-[#8a97a0] mb-3">{cur.tag}</div>
                <ul className="space-y-2">
                  {cur.checks.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-[13px] text-[#6a7780]">
                      <span className="rounded-full" style={{ width: 6, height: 6, background: accent }} />{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* controls */}
        <div className="mt-4 rounded-2xl border border-[#e6e9eb] bg-white p-4 flex flex-wrap items-center gap-3">
          {showConsentBtn ? (
            <button onClick={confirmNeed}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4a7d74] px-4 py-2 text-sm font-semibold text-white">
              <UserCheck size={15} /> Confirm need
            </button>
          ) : (
            <button onClick={advance} disabled={finished}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f2a30] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed">
              Advance <ChevronRight size={15} />
            </button>
          )}
          <button onClick={() => setRunning((r) => !r)} disabled={finished}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e6e9eb] px-4 py-2 text-sm font-medium text-[#1f2a30] disabled:opacity-40 disabled:cursor-not-allowed">
            {running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Auto-run</>}
          </button>
          <button onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e6e9eb] px-4 py-2 text-sm font-medium text-[#3a4750]">
            <RotateCcw size={15} /> Reset
          </button>

          <div className="flex-1" />

          <label className="flex items-center gap-2 text-[12px] text-[#6a7780]">
            Scenario
            <select value={scenario} onChange={(e) => { setScenario(e.target.value); reset(); }}
              className="rounded-md border border-[#e6e9eb] bg-[#f6f4ef] px-2 py-1.5 text-[#1f2a30] text-[12px]">
              {Object.entries(SCENARIOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[12px] text-[#6a7780]">
            Fail at
            <select value={failAt} onChange={(e) => setFailAt(e.target.value)}
              className="rounded-md border border-[#e6e9eb] bg-[#f6f4ef] px-2 py-1.5 text-[#1f2a30] text-[12px]">
              <option value="NONE">none</option>
              <option value="VERIFY_TENANT">tenant</option>
              <option value="VERIFY_LANDLORD">landlord</option>
              <option value="VERIFY_FUNDER">funder</option>
            </select>
          </label>
        </div>

        <p className="mt-4 text-[11px] text-[#8a97a0] leading-relaxed">
          This is a prototype. No real money moves, and the scores are sample data.
          A regulated partner would move real funds, and a person would confirm need
          first. Any real version should be checked for unfair bias before it touches
          real housing decisions.
        </p>
      </div>
    </div>
  );
}

function StatusDot({ passed, active, held, idx }) {
  return (
    <span className="flex items-center justify-center rounded-md shrink-0" style={{
      width: 20, height: 20,
      background: held ? "#f7ecea" : passed ? "#e6f0ed" : active ? "#f6ecda" : "transparent",
      border: !passed && !active && !held ? "1px solid #334155" : "none",
    }}>
      {held ? <AlertTriangle size={12} className="text-[#a8544a]" />
        : passed ? <CheckCircle2 size={12} className="text-[#4a7d74]" />
        : active ? <Zap size={11} className="text-[#b8863b]" />
        : <span className="text-[9px] font-mono text-[#8a97a0]">{idx ?? ""}</span>}
    </span>
  );
}

function RailNode({ leftPct, icon, title, sub }) {
  return (
    <div className="absolute text-center" style={{ left: `${leftPct}%`, top: 96, transform: "translateX(-50%)", width: 120 }}>
      <div className="mx-auto rounded-xl border border-[#e6e9eb] bg-[#eef1f2] flex items-center justify-center" style={{ width: 44, height: 44 }}>{icon}</div>
      <div className="mt-2 text-[12px] font-medium text-[#1f2a30]">{title}</div>
      <div className="text-[10px] text-[#8a97a0] leading-tight px-1">{sub}</div>
    </div>
  );
}

function Row({ k, v, accent }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#e6e9eb] pb-1.5">
      <span className="text-[#8a97a0]">{k}</span>
      <span style={{ color: accent || "#3a4750" }} className="truncate">{v}</span>
    </div>
  );
}


function Field({ label, value, onChange, disabled, type = "text", placeholder }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-[#8a97a0] mb-1">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        step={type === "number" ? "0.01" : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#e6e9eb] bg-[#f6f4ef] px-3 py-2 text-[13px] text-[#1f2a30] outline-none focus:border-[#4a7d74] disabled:opacity-50"
      />
    </label>
  );
}
