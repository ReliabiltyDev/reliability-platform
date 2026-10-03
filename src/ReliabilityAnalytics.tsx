import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Activity, BarChart3, CalendarDays, Plus, TrendingUp } from "lucide-react";
import { supabase } from "./lib/supabase";

type Site = { id: string; name: string };
type Asset = { id: string; site_id: string; name: string; asset_tag: string; criticality: number | null };
type Failure = { id: string; asset_id: string; occurred_at: string; failure_mode: string | null; failure_cause: string | null; downtime_minutes: number | null };
type Reading = { id: string; site_id: string; asset_id: string; visit_id: string | null; observed_at: string; measure_name: string; value: number; unit: string; potential_failure_threshold: number | null; functional_failure_threshold: number | null; higher_is_worse: boolean; notes: string | null };
type Visit = { id: string; site_id: string; asset_id: string | null; visit_date: string; scheduled_start: string | null; all_day: boolean; purpose: string | null };
type Basis = "failure_mode" | "failure_cause" | "asset";
type Measure = "events" | "downtime";
type ReadingDraft = { asset_id: string; visit_id: string; observed_at: string; measure_name: string; value: string; unit: string; potential_failure_threshold: string; functional_failure_threshold: string; higher_is_worse: boolean; notes: string };
const DAY = 86400000;
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const newReading = (assetId = ""): ReadingDraft => ({ asset_id: assetId, visit_id: "", observed_at: nowLocal(), measure_name: "Vibration", value: "", unit: "mm/s RMS", potential_failure_threshold: "", functional_failure_threshold: "", higher_is_worse: true, notes: "" });
const dayLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function ReliabilityAnalytics({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [siteFilter, setSiteFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [basis, setBasis] = useState<Basis>("failure_mode");
  const [measure, setMeasure] = useState<Measure>("downtime");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedMeasure, setSelectedMeasure] = useState("");
  const [readingOpen, setReadingOpen] = useState(false);
  const [draft, setDraft] = useState<ReadingDraft>(newReading());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    const auth = await supabase!.auth.getUser();
    if (auth.error || !auth.data.user) { setError(auth.error?.message || "Your session could not be confirmed."); return; }
    const [siteResult, assetResult, failureResult, readingResult, visitResult] = await Promise.all([
      supabase!.from("sites").select("id,name").order("name"),
      supabase!.from("assets").select("id,site_id,name,asset_tag,criticality").order("name"),
      supabase!.from("failure_events").select("id,asset_id,occurred_at,failure_mode,failure_cause,downtime_minutes").order("occurred_at", { ascending: false }),
      supabase!.from("asset_condition_readings").select("id,site_id,asset_id,visit_id,observed_at,measure_name,value,unit,potential_failure_threshold,functional_failure_threshold,higher_is_worse,notes").order("observed_at", { ascending: true }),
      supabase!.from("site_visits").select("id,site_id,asset_id,visit_date,scheduled_start,all_day,purpose").eq("created_by", auth.data.user.id).order("visit_date", { ascending: true })
    ]);
    if (siteResult.error) setError(siteResult.error.message); else setSites((siteResult.data || []) as Site[]);
    if (assetResult.error) setError(assetResult.error.message); else {
      const nextAssets = (assetResult.data || []) as Asset[];
      setAssets(nextAssets);
      if (!selectedAsset && nextAssets[0]) setSelectedAsset(nextAssets[0].id);
    }
    if (failureResult.error) setError(failureResult.error.message); else setFailures((failureResult.data || []) as Failure[]);
    if (readingResult.error) setError(readingResult.error.message); else setReadings((readingResult.data || []) as Reading[]);
    if (visitResult.error) setError(visitResult.error.message); else setVisits((visitResult.data || []) as Visit[]);
  }
  useEffect(() => { void load(); }, []);

  const visibleAssetIds = new Set(assets.filter(asset => siteFilter === "all" || asset.site_id === siteFilter).map(asset => asset.id));
  const cutoff = period === "12m" ? new Date(Date.now() - 365 * DAY).getTime() : 0;
  const visibleFailures = failures.filter(failure => visibleAssetIds.has(failure.asset_id) && new Date(failure.occurred_at).getTime() >= cutoff);
  const visibleReadings = readings.filter(reading => siteFilter === "all" || reading.site_id === siteFilter);
  const pareto = useMemo(() => {
    const groups = new Map<string, number>();
    for (const failure of visibleFailures) {
      const asset = assets.find(item => item.id === failure.asset_id);
      const key = basis === "asset" ? (asset?.name || "Unknown asset") : basis === "failure_cause" ? (failure.failure_cause || "Cause not recorded") : (failure.failure_mode || "Mode not recorded");
      groups.set(key, (groups.get(key) || 0) + (measure === "events" ? 1 : Math.max(0, failure.downtime_minutes || 0)));
    }
    const list = [...groups.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const total = list.reduce((sum, item) => sum + item.value, 0);
    let running = 0;
    return list.slice(0, 8).map(item => {
      running += item.value;
      return { ...item, percent: total ? (item.value / total) * 100 : 0, cumulative: total ? (running / total) * 100 : 0 };
    });
  }, [visibleFailures, assets, basis, measure]);
  const trendAssets = assets.filter(asset => siteFilter === "all" || asset.site_id === siteFilter);
  const assetReadings = visibleReadings.filter(reading => reading.asset_id === selectedAsset);
  const measureNames = [...new Set(assetReadings.map(reading => reading.measure_name))].sort();
  const activeMeasure = measureNames.includes(selectedMeasure) ? selectedMeasure : (measureNames[0] || "");
  const series = assetReadings.filter(reading => reading.measure_name === activeMeasure).slice(-30);
  const latestReading = series[series.length - 1];
  const pfThreshold = [...series].reverse().find(reading => reading.potential_failure_threshold != null || reading.functional_failure_threshold != null);
  const pThreshold = pfThreshold?.potential_failure_threshold ?? null;
  const fThreshold = pfThreshold?.functional_failure_threshold ?? null;
  const higherIsWorse = pfThreshold?.higher_is_worse ?? true;
  const chartValues = [...series.map(reading => Number(reading.value)), ...(pThreshold == null ? [] : [Number(pThreshold)]), ...(fThreshold == null ? [] : [Number(fThreshold)])].filter(Number.isFinite);
  const rawMin = chartValues.length ? Math.min(...chartValues) : 0;
  const rawMax = chartValues.length ? Math.max(...chartValues) : 1;
  const range = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.12, 1);
  const chartMin = rawMin - range * 0.12;
  const chartMax = rawMax + range * 0.12;
  const W = 720, H = 278, left = 56, right = 18, top = 18, bottom = 42;
  const plotW = W - left - right, plotH = H - top - bottom;
  const xAt = (index: number) => left + (series.length <= 1 ? plotW / 2 : (index / (series.length - 1)) * plotW);
  const yAt = (value: number) => top + ((chartMax - value) / (chartMax - chartMin)) * plotH;
  const path = series.map((reading, index) => (index ? "L" : "M") + xAt(index).toFixed(1) + "," + yAt(Number(reading.value)).toFixed(1)).join(" ");
  const trend = series.length >= 2 ? calculateTrend(series, higherIsWorse, pThreshold, fThreshold) : null;
  const upcomingVisits = visits.filter(visit => visit.visit_date >= new Date().toISOString().slice(0, 10) && (siteFilter === "all" || visit.site_id === siteFilter)).slice(0, 4);

  function setDraftValue(key: keyof ReadingDraft, value: string | boolean) {
    setDraft(previous => ({ ...previous, [key]: value } as ReadingDraft));
  }
  function openReadingForm() {
    setDraft(newReading(selectedAsset));
    setReadingOpen(value => !value);
    setError("");
  }
  async function saveReading(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const asset = assets.find(item => item.id === draft.asset_id);
    const auth = await supabase!.auth.getUser();
    if (!asset) { setError("Select an asset for this condition reading."); setBusy(false); return; }
    if (auth.error || !auth.data.user) { setError(auth.error?.message || "Your session could not be confirmed."); setBusy(false); return; }
    const result = await supabase!.from("asset_condition_readings").insert({
      site_id: asset.site_id, asset_id: asset.id, visit_id: draft.visit_id || null,
      observed_at: new Date(draft.observed_at).toISOString(), measure_name: draft.measure_name.trim(),
      value: Number(draft.value), unit: draft.unit.trim(), potential_failure_threshold: draft.potential_failure_threshold === "" ? null : Number(draft.potential_failure_threshold),
      functional_failure_threshold: draft.functional_failure_threshold === "" ? null : Number(draft.functional_failure_threshold),
      higher_is_worse: draft.higher_is_worse, notes: draft.notes.trim() || null, source: "Manual condition reading", recorded_by: auth.data.user.id
    });
    if (result.error) setError(result.error.message);
    else { setMessage("Condition reading saved. The P–F trend is updated."); setReadingOpen(false); await load(); }
    setBusy(false);
  }

  return <section className="reliability-analytics">
    <div className="analytics-head">
      <div><p className="eyebrow">ASSET & VISIT PERFORMANCE</p><h2>Reliability analysis</h2><p className="muted">Failure Pareto, condition trends, and upcoming site visits.</p></div>
      <div className="analytics-filters"><select aria-label="Filter dashboard analysis by site" value={siteFilter} onChange={e => setSiteFilter(e.target.value)}><option value="all">All sites</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select><select aria-label="Pareto time window" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">All history</option><option value="12m">Last 12 months</option></select></div>
    </div>
    {error && <div className="notice error wide">{error}</div>}
    {message && <div className="notice wide">{message}</div>}
    <div className="analytics-grid">
      <section className="panel pareto-panel">
        <div className="panel-head"><div><h2>Failure Pareto</h2><p>Ranked contribution with cumulative share</p></div><BarChart3 size={19}/></div>
        <div className="analytics-controls"><select aria-label="Pareto category" value={basis} onChange={e => setBasis(e.target.value as Basis)}><option value="failure_mode">Failure mode</option><option value="failure_cause">Failure cause</option><option value="asset">Asset</option></select><select aria-label="Pareto measure" value={measure} onChange={e => setMeasure(e.target.value as Measure)}><option value="downtime">Downtime minutes</option><option value="events">Event count</option></select></div>
        {pareto.length ? <div className="pareto-list">{pareto.map((item, index) => <div className="pareto-row" key={item.name}><div className="pareto-label"><span>{String(index + 1).padStart(2, "0")}</span><b title={item.name}>{item.name}</b><small>{measure === "events" ? item.value + " events" : item.value.toLocaleString() + " min"}</small></div><div className="pareto-track"><div className="pareto-bar" style={{ width: Math.max(3, item.percent) + "%" }}/><i className={item.cumulative <= 80 ? "pareto-cumulative under" : "pareto-cumulative"} style={{ left: item.cumulative + "%" }} title={"Cumulative " + item.cumulative.toFixed(1) + "%"} /></div><span className="pareto-share">{item.cumulative.toFixed(0)}%</span></div>)}<div className="pareto-legend"><span><i/> Category contribution</span><span><i/> Cumulative share · 80% reference</span></div></div> : <div className="analytics-empty"><Activity size={22}/><b>No failure data for this view</b><span>Log asset failures to build the Pareto ranking.</span><button type="button" className="secondary" onClick={() => onNavigate("reliability")}>Record a failure</button></div>}
        <button type="button" className="text-btn analytics-link" onClick={() => onNavigate("reliability")}>Open failure history →</button>
      </section>

      <section className="panel pf-panel">
        <div className="panel-head"><div><h2>P–F curve model</h2><p>Condition readings between potential and functional failure</p></div><TrendingUp size={19}/></div>
        <div className="analytics-controls"><select aria-label="P-F asset" value={selectedAsset} onChange={e => { setSelectedAsset(e.target.value); setSelectedMeasure(""); setDraft(newReading(e.target.value)); }}><option value="">Select asset…</option>{trendAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.asset_tag}</option>)}</select><select aria-label="Condition measure" value={activeMeasure} onChange={e => setSelectedMeasure(e.target.value)} disabled={!measureNames.length}><option value="">Select condition measure…</option>{measureNames.map(name => <option key={name} value={name}>{name}</option>)}</select></div>
        {series.length ? <><div className="pf-chart-wrap"><svg className="pf-chart" viewBox={"0 0 " + W + " " + H} role="img" aria-label={activeMeasure + " P-F condition trend"}>
          {[0, 0.5, 1].map(tick => { const val = chartMin + (chartMax - chartMin) * tick; const y = yAt(val); return <g key={tick}><line x1={left} y1={y} x2={W - right} y2={y} className="pf-gridline"/><text x={left - 8} y={y + 4} textAnchor="end" className="pf-axis-label">{val.toFixed(2)}</text></g>; })}
          {pThreshold != null && <g><line x1={left} y1={yAt(Number(pThreshold))} x2={W - right} y2={yAt(Number(pThreshold))} className="pf-threshold potential"/><text x={W - right - 2} y={yAt(Number(pThreshold)) - 5} textAnchor="end" className="pf-threshold-label">P · potential</text></g>}
          {fThreshold != null && <g><line x1={left} y1={yAt(Number(fThreshold))} x2={W - right} y2={yAt(Number(fThreshold))} className="pf-threshold functional"/><text x={W - right - 2} y={yAt(Number(fThreshold)) - 5} textAnchor="end" className="pf-threshold-label">F · functional</text></g>}
          {series.length > 1 && <path d={path} className="pf-series"/>}
          {series.map((reading, index) => <g key={reading.id}><circle cx={xAt(index)} cy={yAt(Number(reading.value))} r="4.5" className="pf-point"><title>{dayLabel(reading.observed_at)} · {reading.value} {reading.unit}</title></circle></g>)}
          <text x={left} y={H - 10} className="pf-axis-label">{dayLabel(series[0].observed_at)}</text><text x={W - right} y={H - 10} textAnchor="end" className="pf-axis-label">{dayLabel(series[series.length - 1].observed_at)}</text>
        </svg></div><div className="pf-summary"><div><span>Latest reading</span><b>{latestReading?.value} {latestReading?.unit}</b></div><div><span>Trend</span><b>{trend?.direction || "Need more readings"}</b></div><div><span>Estimated P–F interval</span><b>{trend?.pfDays == null ? "—" : formatDays(trend.pfDays)}</b></div></div><p className="pf-caveat">{trend?.estimate || "Add dated readings with P and F thresholds to estimate the condition trend."} Linear estimates are planning aids; use the OEM or engineering limit for decisions.</p></> : <div className="analytics-empty"><TrendingUp size={22}/><b>{selectedAsset ? "No condition readings yet" : "Choose an asset"}</b><span>Record the same condition measure over time and set its P and F thresholds.</span></div>}
        <div className="pf-actions"><button type="button" className="primary" onClick={openReadingForm} disabled={!trendAssets.length}><Plus size={15}/>{readingOpen ? "Close reading form" : "Add condition reading"}</button><span>{series.length} reading{series.length === 1 ? "" : "s"}</span></div>
        {readingOpen && <form className="condition-form" onSubmit={saveReading}>
          <div className="form-grid">
            <label className="span-2">Asset<select required value={draft.asset_id} onChange={e => { setDraftValue("asset_id", e.target.value); setDraftValue("visit_id", ""); }}><option value="">Select asset…</option>{trendAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.asset_tag}</option>)}</select></label>
            <label>Measure<input required value={draft.measure_name} onChange={e => setDraftValue("measure_name", e.target.value)} placeholder="Vibration, temperature…"/></label>
            <label>Value<input required type="number" step="any" value={draft.value} onChange={e => setDraftValue("value", e.target.value)}/></label>
            <label>Unit<input value={draft.unit} onChange={e => setDraftValue("unit", e.target.value)} placeholder="mm/s RMS"/></label>
            <label>Observed at<input required type="datetime-local" value={draft.observed_at} onChange={e => setDraftValue("observed_at", e.target.value)}/></label>
            <label>Potential failure (P)<input type="number" step="any" value={draft.potential_failure_threshold} onChange={e => setDraftValue("potential_failure_threshold", e.target.value)}/></label>
            <label>Functional failure (F)<input type="number" step="any" value={draft.functional_failure_threshold} onChange={e => setDraftValue("functional_failure_threshold", e.target.value)}/></label>
            <label className="span-2">Related site visit (optional)<select value={draft.visit_id} onChange={e => setDraftValue("visit_id", e.target.value)}><option value="">No linked visit</option>{visits.filter(visit => visit.asset_id === draft.asset_id).map(visit => <option key={visit.id} value={visit.id}>{visit.visit_date} · {visit.purpose || "Site visit"}</option>)}</select></label>
            <label className="span-2 condition-direction"><input type="checkbox" checked={draft.higher_is_worse} onChange={e => setDraftValue("higher_is_worse", e.target.checked)}/> Higher readings indicate worsening condition</label>
            <label className="span-2">Notes<textarea rows={2} value={draft.notes} onChange={e => setDraftValue("notes", e.target.value)} placeholder="Instrument, location, operating condition…"/></label>
          </div>
          <button type="submit" className="primary" disabled={busy || !draft.asset_id || !draft.measure_name.trim() || draft.value === ""}>{busy ? "Saving…" : "Save reading"}</button>
        </form>}
      </section>
    </div>

    <section className="panel visit-dashboard-panel">
      <div className="panel-head"><div><h2>Upcoming site visits</h2><p>{upcomingVisits.length} scheduled visit{upcomingVisits.length === 1 ? "" : "s"} in this site filter · linked to site and equipment</p></div><CalendarDays size={19}/></div>
      {upcomingVisits.length ? <div className="visit-dashboard-list">{upcomingVisits.map(visit => {
        const site = sites.find(item => item.id === visit.site_id);
        const asset = assets.find(item => item.id === visit.asset_id);
        return <div className="visit-dashboard-row" key={visit.id}><b>{dayLabel(visit.visit_date)}</b><span>{visit.purpose || "Site visit"}</span><small>{site?.name || "Site"}{asset ? " · " + asset.name : ""}</small></div>;
      })}</div> : <div className="empty">No upcoming visits in this filter. Schedule one in My Calendar.</div>}
      <button type="button" className="text-btn analytics-link" onClick={() => onNavigate("calendar")}>Open calendar →</button>
    </section>
  </section>;
}

function calculateTrend(series: Reading[], higherIsWorse: boolean, p: number | null, f: number | null) {
  const first = series[0], last = series[series.length - 1];
  const elapsedDays = (new Date(last.observed_at).getTime() - new Date(first.observed_at).getTime()) / DAY;
  if (elapsedDays <= 0) return { direction: "Need readings on different dates", pfDays: null as number | null, estimate: "Add readings on separate dates for a trend estimate." };
  const rawRate = (Number(last.value) - Number(first.value)) / elapsedDays;
  const worseningRate = higherIsWorse ? rawRate : -rawRate;
  if (worseningRate <= 0) return { direction: "Stable or improving", pfDays: null as number | null, estimate: "The entered readings do not show a worsening trend." };
  const transform = (value: number) => higherIsWorse ? value : -value;
  const latest = transform(Number(last.value));
  const potential = p == null ? null : transform(Number(p));
  const functional = f == null ? null : transform(Number(f));
  const distanceToP = potential == null ? null : (potential - latest) / worseningRate;
  const interval = potential == null || functional == null ? null : Math.abs(functional - potential) / worseningRate;
  const direction = distanceToP != null && distanceToP <= 0 ? "Potential-failure zone reached" : "Worsening";
  const estimate = distanceToP == null ? "Trend is worsening; add P and F thresholds for an interval estimate." :
    distanceToP <= 0 ? "The current measurement has reached or passed the potential-failure threshold." :
    "Linear trend estimates potential failure in about " + formatDays(distanceToP) + ".";
  return { direction, pfDays: interval, estimate };
}
function formatDays(days: number) { return days < 1 ? "< 1 day" : Math.round(days) + " days"; }
