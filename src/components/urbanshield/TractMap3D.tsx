import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TractProperties = {
  tract_id: string;
  county: string;
  risk_score: number;
  eviction_count_12mo: number;
  eviction_trend_pct: number;
  rent_zori: number;
  rent_change_yoy: number;
  appraisal_change_pct: number;
  has_appraisal_data: boolean;
  // derived
  idx_eviction: number;
  idx_market: number | null;
  idx_combined: number;
  reliable: boolean;
};

const DFW_CENTER: [number, number] = [-96.85, 32.85];
const COUNTIES = ["All", "Dallas", "Tarrant", "Collin", "Denton"] as const;

const LAYERS = {
  eviction: {
    label: "Eviction pressure",
    field: "idx_eviction",
    blurb: "How many evictions were filed, and whether it's rising.",
  },
  market: {
    label: "Market pressure",
    field: "idx_market",
    blurb: "Rent and property value changes. Shown only where data exists.",
  },
  combined: {
    label: "Combined risk",
    field: "idx_combined",
    blurb: "The published risk score. It blends both views above.",
  },
} as const;
type LayerId = keyof typeof LAYERS;

const EV_FIELDS = [
  { f: "eviction_count_12mo", label: "Evictions filed, past year", kind: "count", src: "County records" },
  { f: "eviction_trend_pct", label: "Change from last year", kind: "pct", src: "County records" },
] as const;
const MK_FIELDS = [
  { f: "rent_zori", label: "Typical rent", kind: "money", src: "Zillow" },
  { f: "rent_change_yoy", label: "Rent change from last year", kind: "pct", src: "Zillow" },
  { f: "appraisal_change_pct", label: "Property value change", kind: "pct", src: "County records" },
] as const;

const pct = (v: number | null | undefined) =>
  v == null || isNaN(Number(v)) ? "n/a" : `${Number(v) > 0 ? "+" : ""}${(Number(v) * 100).toFixed(1)}%`;
const money = (v: number | null | undefined) =>
  v == null || isNaN(Number(v))
    ? "n/a"
    : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const count = (v: number | null | undefined) =>
  v == null || isNaN(Number(v)) ? "n/a" : Number(v).toLocaleString();
const fmtField = (kind: string, v: number) =>
  kind === "money" ? money(v) : kind === "pct" ? pct(v) : count(v);

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sorted[base] ?? 0;
  const b = sorted[base + 1];
  return b !== undefined ? a + rest * (b - a) : a;
}

function normalizer(values: number[]) {
  const clean = values.filter((v) => v != null && !isNaN(v)).sort((a, b) => a - b);
  const lo = quantile(clean, 0.05);
  const hi = quantile(clean, 0.95);
  return (v: number) => (hi === lo ? 0.5 : Math.max(0, Math.min(1, (v - lo) / (hi - lo))));
}

function centroidOf(geometry: any): [number, number] {
  const coords: number[][] = [];
  const walk = (c: any) => {
    if (typeof c[0] === "number") coords.push(c as number[]);
    else c.forEach(walk);
  };
  walk(geometry.coordinates);
  const n = coords.length || 1;
  return [
    coords.reduce((a, c) => a + (c[0] ?? 0), 0) / n,
    coords.reduce((a, c) => a + (c[1] ?? 0), 0) / n,
  ];
}

function enrich(geojson: any) {
  const feats = geojson.features as any[];
  const nEvCount = normalizer(feats.map((f) => f.properties.eviction_count_12mo));
  const nEvTrend = normalizer(feats.map((f) => f.properties.eviction_trend_pct));
  const withAppr = feats.filter((f) => f.properties.has_appraisal_data);
  const base = withAppr.length ? withAppr : feats;
  const nRent = normalizer(base.map((f) => f.properties.rent_zori));
  const nRentChg = normalizer(base.map((f) => f.properties.rent_change_yoy));
  const nAppr = normalizer(base.map((f) => f.properties.appraisal_change_pct));

  feats.forEach((f) => {
    const p = f.properties;
    p.idx_eviction = (nEvCount(p.eviction_count_12mo) + nEvTrend(p.eviction_trend_pct)) / 2;
    p.idx_market = p.has_appraisal_data
      ? (nRent(p.rent_zori) + nRentChg(p.rent_change_yoy) + nAppr(p.appraisal_change_pct)) / 3
      : -1; // -1 = undefined for this layer (maplibre expressions need numbers)
    p.idx_combined = Math.max(0, Math.min(1, Number(p.risk_score) / 100));
    p.reliable = !!p.has_appraisal_data;
    p.centroid_lng = centroidOf(f.geometry)[0];
    p.centroid_lat = centroidOf(f.geometry)[1];
  });
  return geojson;
}

export default function TractMap3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const dataRef = useRef<any>(null);

  const [selected, setSelected] = useState<any | null>(null);
  const [hovered, setHovered] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<LayerId>("combined");
  const [county, setCounty] = useState<(typeof COUNTIES)[number]>("All");
  const [dimUnreliable, setDimUnreliable] = useState(true);
  const [features, setFeatures] = useState<any[]>([]);
  const [showSources, setShowSources] = useState(false);

  const active = hovered ?? selected;

  // ── paint driven by the active layer ──────────────────────────────────
  const applyPaint = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("tracts-extrusion")) return;
    const field = LAYERS[layer].field;
    const val: any = ["coalesce", ["get", field], 0];
    const defined: any = [">=", ["coalesce", ["get", field], -1], 0];

    map.setPaintProperty("tracts-extrusion", "fill-extrusion-height", [
      "case",
      defined,
      ["interpolate", ["linear"], val, 0, 20, 1, 1600],
      10,
    ]);
    map.setPaintProperty("tracts-extrusion", "fill-extrusion-color", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      "#1f2a30",
      ["boolean", ["feature-state", "hover"], false],
      "#e8c877",
      ["!", defined],
      "#d5dadd",
      ["interpolate", ["linear"], val, 0, "#3d6b58", 0.5, "#d4a13d", 1, "#c23b3b"],
    ]);
    map.setPaintProperty("tracts-extrusion", "fill-extrusion-opacity", 0.88);
  }, [layer]);

  const applyFilter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("tracts-extrusion")) return;
    const clauses: any[] = ["all"];
    if (county !== "All") clauses.push(["==", ["get", "county"], county]);
    if (dimUnreliable && layer === "market") clauses.push(["==", ["get", "has_appraisal_data"], true]);
    const filter = clauses.length > 1 ? clauses : null;
    map.setFilter("tracts-extrusion", filter);
    map.setFilter("tracts-outline", filter);
  }, [county, dimUnreliable, layer]);

  useEffect(() => {
    let disposed = false;

    (async () => {
      const [maplibreMod] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      const maplibregl: any = (maplibreMod as any).default ?? maplibreMod;
      if (disposed || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: DFW_CENTER,
        zoom: 9,
        pitch: 45,
        bearing: -10,
        antialias: true,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.on("error", (e: any) => setError(e?.error?.message ?? "Map failed to load"));

      map.on("load", async () => {
        try {
          const res = await fetch("/tracts.geojson");
          const geojson = enrich(await res.json());
          dataRef.current = geojson;
          setFeatures(geojson.features);

          map.addSource("tracts", { type: "geojson", data: geojson, generateId: true });
          map.addLayer({
            id: "tracts-extrusion",
            type: "fill-extrusion",
            source: "tracts",
            paint: { "fill-extrusion-vertical-gradient": true },
          });
          map.addLayer({
            id: "tracts-outline",
            type: "line",
            source: "tracts",
            paint: {
              "line-color": "#1f2a30",
              "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2, 0],
            },
          });

          let hoveredId: string | number | null = null;
          map.on("mousemove", "tracts-extrusion", (e: any) => {
            if (!e.features?.length) return;
            map.getCanvas().style.cursor = "pointer";
            const f = e.features[0];
            if (hoveredId !== null && hoveredId !== f.id) {
              map.setFeatureState({ source: "tracts", id: hoveredId }, { hover: false });
            }
            hoveredId = f.id ?? null;
            if (hoveredId !== null) map.setFeatureState({ source: "tracts", id: hoveredId }, { hover: true });
            setHovered(f.properties);
          });

          map.on("mouseleave", "tracts-extrusion", () => {
            map.getCanvas().style.cursor = "";
            if (hoveredId !== null) map.setFeatureState({ source: "tracts", id: hoveredId }, { hover: false });
            hoveredId = null;
            setHovered(null);
          });

          map.on("click", "tracts-extrusion", (e: any) => {
            const f = e.features?.[0];
            if (f) setSelected(f.properties);
          });

          setReady(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load tract data");
        }
      });
    })();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) applyPaint();
  }, [ready, applyPaint]);
  useEffect(() => {
    if (ready) applyFilter();
  }, [ready, applyFilter]);

  // highlight the selected tract on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.querySourceFeatures("tracts").forEach((sf: any) => {
      if (sf.id !== undefined) {
        map.setFeatureState(
          { source: "tracts", id: sf.id },
          { selected: !!selected && sf.properties?.tract_id === selected.tract_id },
        );
      }
    });
  }, [selected, ready]);

  const layerVal = useCallback(
    (p: any) => {
      const v = p?.[LAYERS[layer].field];
      return v == null || v < 0 ? null : Number(v);
    },
    [layer],
  );

  const scoped = useMemo(
    () => features.filter((f) => county === "All" || f.properties.county === county),
    [features, county],
  );

  const ranked = useMemo(
    () =>
      scoped
        .map((f) => f.properties)
        .filter((p) => layerVal(p) != null)
        .sort((a, b) => (layerVal(b) as number) - (layerVal(a) as number))
        .slice(0, 12),
    [scoped, layerVal],
  );

  const flyTo = (p: any) => {
    setSelected(p);
    mapRef.current?.flyTo({ center: [p.centroid_lng, p.centroid_lat], zoom: 12.5, pitch: 55, duration: 900 });
  };

  const resetView = () => {
    setSelected(null);
    mapRef.current?.flyTo({ center: DFW_CENTER, zoom: 9, pitch: 45, bearing: -10, duration: 800 });
  };

  const colorFor = (v: number | null) =>
    v == null ? "#8a97a0" : v < 0.5 ? "#5f8f6d" : v < 0.75 ? "#d4a13d" : "#c23b3b";

  return (
    <div className="relative h-screen w-full bg-[#f6f4ef]">
      <div ref={containerRef} className="h-full w-full" />

      {/* ── header + controls ── */}
      <div className="absolute left-6 top-6 w-[22rem] rounded-xl border border-[#e6e9eb] bg-white/90 px-5 py-4 backdrop-blur-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8a97a0]">
          Displacement risk explorer · DFW
        </p>
        <h1 className="mt-1 text-lg font-semibold text-[#1f2a30]">Where is housing pressure highest?</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#6a7780]">
          Pick a county, toggle the signal, drag to rotate and tilt. Click any tract for the
          components behind its score.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value as any)}
            className="rounded-lg border border-[#e6e9eb] bg-[#f1efe9] px-3 py-1.5 text-xs font-semibold text-[#1f2a30] outline-none"
            aria-label="County"
          >
            {COUNTIES.map((c) => (
              <option key={c} value={c} >
                {c === "All" ? "All DFW counties" : `${c} County`}
              </option>
            ))}
          </select>
          <span className="font-mono text-[10px] text-[#8a97a0]">{scoped.length} tracts</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(LAYERS) as LayerId[]).map((id) => (
            <button
              key={id}
              onClick={() => setLayer(id)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                layer === id
                  ? "border-[#1f2a30] bg-[#1f2a30] text-white"
                  : "border-[#e6e9eb] bg-[#f1efe9] text-[#6a7780] hover:text-[#1f2a30]"
              }`}
            >
              {LAYERS[id].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#8a97a0]">{LAYERS[layer].blurb}</p>

        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-[#8a97a0]">
          <input
            type="checkbox"
            checked={dimUnreliable}
            onChange={(e) => setDimUnreliable(e.target.checked)}
            className="accent-[#1f2a30]"
          />
          hide tracts without appraisal coverage
        </label>

        {!ready && !error && <p className="mt-2 font-mono text-[10px] text-[#8a97a0]">Loading tracts…</p>}
        {error && <p className="mt-2 font-mono text-[10px] text-[#a8544a]">{error}</p>}
      </div>

      {/* ── legend ── */}
      <div className="pointer-events-none absolute bottom-6 left-6 rounded-lg border border-[#e6e9eb] bg-white/90 px-4 py-3 backdrop-blur-sm">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#8a97a0]">
          {LAYERS[layer].label} index
        </p>
        <div className="h-2 w-32 rounded-full bg-[linear-gradient(to_right,#3d6b58,#d4a13d,#c23b3b)]" />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-[#8a97a0]">
          <span>Lower</span>
          <span>Higher</span>
        </div>
        <div className="mt-2 flex items-center gap-2 font-mono text-[9.5px] text-[#8a97a0]">
          <span className="inline-block h-2.5 w-3.5 rounded-sm bg-[#d5dadd]" />
          no data for this layer
        </div>
      </div>

      <button
        onClick={resetView}
        className="absolute bottom-6 right-6 rounded-lg border border-[#e6e9eb] bg-white/90 px-3 py-1.5 font-mono text-[10px] text-[#3a4750] backdrop-blur-sm hover:text-[#1f2a30]"
      >
        reset view
      </button>

      {/* ── side panel: detail or ranking ── */}
      <div className="absolute right-6 top-6 w-80 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-[#e6e9eb] bg-white/95 p-5 backdrop-blur-sm">
        {active ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#8a97a0]">
                  Tract {active.tract_id}
                </p>
                <p className="text-sm text-[#3a4750]">{active.county} County</p>
              </div>
              {selected && (
                <button
                  onClick={() => setSelected(null)}
                  className="rounded px-2 py-1 text-xs text-[#8a97a0] hover:text-[#1f2a30]"
                  aria-label="Close tract detail"
                >
                  ✕
                </button>
              )}
            </div>

            {!active.reliable && (
              <p className="mt-3 rounded-md bg-[#f7ecea] px-2 py-1.5 text-[11px] text-[#a8544a]">
                No appraisal data here. Market pressure can't be shown for this tract.
              </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              {([
                ["Eviction", layerValOf(active, "idx_eviction")],
                ["Market", layerValOf(active, "idx_market")],
                ["Combined", layerValOf(active, "idx_combined")],
              ] as [string, number | null][]).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-[#f1efe9] px-2 py-2 text-center">
                  <div className="font-mono text-base font-bold" style={{ color: colorFor(v) }}>
                    {v == null ? "n/a" : v.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8a97a0]">{l}</div>
                </div>
              ))}
            </div>

            <p className="mt-4 font-mono text-3xl text-[#1f2a30]">
              {Number(active.risk_score).toFixed(1)}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#8a97a0]">Risk score</p>

            <SectionLabel>Eviction inputs</SectionLabel>
            {EV_FIELDS.map((d) => (
              <Row key={d.f} label={d.label} src={d.src} value={fmtField(d.kind, Number(active[d.f]))} />
            ))}

            <SectionLabel>Market inputs</SectionLabel>
            {!active.has_appraisal_data ? (
              <p className="text-[11px] italic text-[#8a97a0]">
                Appraisal data missing. Left out of the market score.
              </p>
            ) : (
              MK_FIELDS.map((d) => (
                <Row key={d.f} label={d.label} src={d.src} value={fmtField(d.kind, Number(active[d.f]))} />
              ))
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-[#1f2a30]">
              {county === "All" ? "DFW" : `${county} County`}: highest{" "}
              {LAYERS[layer].label.toLowerCase()}
            </p>
            <p className="mt-1 text-[11px] text-[#8a97a0]">
              Hover the map or click a row for the full breakdown.
            </p>
            <div className="mt-3 space-y-0.5">
              {ranked.map((p, i) => {
                const v = layerVal(p);
                return (
                  <button
                    key={p.tract_id}
                    onClick={() => flyTo(p)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[#f1efe9]"
                  >
                    <span className="w-4 font-mono text-[10px] text-[#8a97a0]">{i + 1}</span>
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-sm"
                      style={{ background: colorFor(v) }}
                    />
                    <span className="font-mono text-[11px] text-[#3a4750]">{p.tract_id}</span>
                    {!p.reliable && <span className="text-[9.5px] text-[#aab4bb]">±</span>}
                    <span
                      className="ml-auto font-mono text-xs font-bold"
                      style={{ color: colorFor(v) }}
                    >
                      {v?.toFixed(2)}
                    </span>
                  </button>
                );
              })}
              {ranked.length === 0 && (
                <p className="text-[11px] text-[#8a97a0]">No tracts with data for this layer.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── sources ── */}
      <div className="absolute bottom-6 left-1/2 w-[30rem] max-w-[calc(100vw-3rem)] -translate-x-1/2">
        <button
          onClick={() => setShowSources((s) => !s)}
          className="mx-auto block rounded-lg border border-[#e6e9eb] bg-white/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#6a7780] backdrop-blur-sm hover:text-[#1f2a30]"
        >
          {showSources ? "hide sources" : "data sources"}
        </button>
        {showSources && (
          <div className="mt-2 rounded-xl border border-[#e6e9eb] bg-white/95 px-4 py-3 backdrop-blur-sm">
            <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[#6a7780]">
              <li>
                <b className="text-[#3a4750]">Map shapes.</b> Census boundaries for Dallas,
                Tarrant, Collin, and Denton counties.
              </li>
              <li>
                <b className="text-[#3a4750]">Evictions.</b> County court records. Filings can
                undercount actual displacement.
              </li>
              <li>
                <b className="text-[#3a4750]">Rent.</b> Zillow.
              </li>
              <li>
                <b className="text-[#3a4750]">Property value.</b> County appraisal records, not
                available everywhere.
              </li>
            </ul>
            <p className="mt-2 text-[10.5px] italic leading-relaxed text-[#8a97a0]">
              Eviction and market pressure stay separate on purpose. They measure different
              things. Scores are scaled against the tracts currently loaded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function layerValOf(p: any, field: string): number | null {
  const v = p?.[field];
  return v == null || Number(v) < 0 ? null : Number(v);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 mt-4 font-mono text-[10px] uppercase tracking-wider text-[#8a97a0]">
      {children}
    </p>
  );
}

function Row({ label, src, value }: { label: string; src?: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#e6e9eb] py-1">
      <span className="text-[11px] text-[#8a97a0]">
        {label}
        {src && <span className="ml-1 text-[9.5px] text-[#aab4bb]">· {src}</span>}
      </span>
      <span className="font-mono text-[11px] text-[#1f2a30]">{value}</span>
    </div>
  );
}
