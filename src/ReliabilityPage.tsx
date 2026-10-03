import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { AlertTriangle, ClipboardCheck, Plus } from "lucide-react";
import { supabase } from "./lib/supabase";

type Site = { id: string; name: string };
type Asset = { id: string; site_id: string; name: string; asset_tag: string; criticality: number | null };
type Failure = {
  id: string; asset_id: string; occurred_at: string; status: string; failure_mode: string | null;
  failure_cause: string | null; symptom: string | null; corrective_action: string | null; downtime_minutes: number | null;
};
const dateTimeNow = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16);
};
const initialForm = () => ({ site_id: "", asset_id: "", occurred_at: dateTimeNow(), failure_mode: "", failure_cause: "", symptom: "", corrective_action: "", downtime_minutes: "", status: "open" });

export default function ReliabilityPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [form, setForm] = useState(initialForm);
  const [siteFilter, setSiteFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    const [s, a, f] = await Promise.all([
      supabase!.from("sites").select("id,name").order("name"),
      supabase!.from("assets").select("id,site_id,name,asset_tag,criticality").order("name"),
      supabase!.from("failure_events").select("id,asset_id,occurred_at,status,failure_mode,failure_cause,symptom,corrective_action,downtime_minutes").order("occurred_at", { ascending: false })
    ]);
    if (s.error) setError(s.error.message); else setSites((s.data || []) as Site[]);
    if (a.error) setError(a.error.message); else setAssets((a.data || []) as Asset[]);
    if (f.error) setError(f.error.message); else setFailures((f.data || []) as Failure[]);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => failures.filter(failure => {
    const asset = assets.find(item => item.id === failure.asset_id);
    const matchesSite = siteFilter === "all" || asset?.site_id === siteFilter;
    const text = [failure.failure_mode || "", failure.failure_cause || "", failure.symptom || "", asset?.name || "", asset?.asset_tag || ""].join(" ").toLowerCase();
    return matchesSite && text.includes(query.trim().toLowerCase());
  }), [failures, assets, siteFilter, query]);
  const availableAssets = assets.filter(asset => asset.site_id === form.site_id);
  const setValue = (key: keyof ReturnType<typeof initialForm>, value: string) => setForm(previous => ({ ...previous, [key]: value }));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const user = await supabase!.auth.getUser();
    if (user.error || !user.data.user) { setError(user.error?.message || "Your session could not be confirmed."); setSaving(false); return; }
    const result = await supabase!.from("failure_events").insert({
      asset_id: form.asset_id, occurred_at: new Date(form.occurred_at).toISOString(),
      status: form.status, failure_mode: form.failure_mode.trim() || null, failure_cause: form.failure_cause.trim() || null,
      symptom: form.symptom.trim() || null, corrective_action: form.corrective_action.trim() || null,
      downtime_minutes: form.downtime_minutes ? Math.max(0, Number(form.downtime_minutes)) : null,
      reported_by: user.data.user.id
    });
    if (result.error) setError(result.error.message);
    else { setMessage("Failure event recorded. Dashboard Pareto analysis is updated."); setForm(initialForm()); await load(); }
    setSaving(false);
  }

  return <div className="reliability-page">
    <div className="hero"><div><p className="eyebrow">FAILURE & CONDITION TRACKING</p><h1>Reliability</h1><p className="muted">Record asset failures and corrective work. Every event feeds the dashboard Pareto view.</p></div></div>
    {error && <div className="notice error wide">{error}</div>}
    {message && <div className="notice wide">{message}</div>}
    <div className="reliability-page-grid">
      <form className="panel reliability-form" onSubmit={save}>
        <div className="panel-head"><div><h2>Log a failure event</h2><p>Attach the event to the site’s asset record.</p></div><AlertTriangle size={19}/></div>
        {!assets.length && <div className="notice">Create an asset before recording a failure event.</div>}
        <div className="form-grid">
          <label className="span-2">Site<select required value={form.site_id} onChange={e => { setValue("site_id", e.target.value); setValue("asset_id", ""); }}><option value="">Select site…</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label className="span-2">Asset<select required value={form.asset_id} onChange={e => setValue("asset_id", e.target.value)}><option value="">Select asset…</option>{availableAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.asset_tag}</option>)}</select></label>
          <label className="span-2">Occurred at<input required type="datetime-local" value={form.occurred_at} onChange={e => setValue("occurred_at", e.target.value)}/></label>
          <label>Failure mode<input value={form.failure_mode} onChange={e => setValue("failure_mode", e.target.value)} placeholder="Bearing wear, leakage…"/></label>
          <label>Cause<input value={form.failure_cause} onChange={e => setValue("failure_cause", e.target.value)} placeholder="Contamination, misalignment…"/></label>
          <label>Downtime (minutes)<input type="number" min="0" step="1" value={form.downtime_minutes} onChange={e => setValue("downtime_minutes", e.target.value)}/></label>
          <label>Status<select value={form.status} onChange={e => setValue("status", e.target.value)}><option value="open">Open</option><option value="investigating">Investigating</option><option value="contained">Contained</option><option value="closed">Closed</option></select></label>
          <label className="span-2">Symptom<textarea rows={3} value={form.symptom} onChange={e => setValue("symptom", e.target.value)} placeholder="Observed condition or impact"/></label>
          <label className="span-2">Corrective action<textarea rows={3} value={form.corrective_action} onChange={e => setValue("corrective_action", e.target.value)} placeholder="Repair, adjustment, or follow-up"/></label>
        </div>
        <button className="primary" disabled={saving || !form.asset_id}><Plus size={16}/>{saving ? "Saving…" : "Save failure event"}</button>
      </form>
      <section className="panel failure-history">
        <div className="panel-head"><div><h2>Failure history</h2><p>{filtered.length} event{filtered.length === 1 ? "" : "s"} in view</p></div><ClipboardCheck size={19}/></div>
        <div className="failure-toolbar"><input aria-label="Search failure history" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search mode, cause, asset…"/><select aria-label="Filter failures by site" value={siteFilter} onChange={e => setSiteFilter(e.target.value)}><option value="all">All sites</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
        {filtered.length ? <div className="failure-list">{filtered.map(failure => {
          const asset = assets.find(item => item.id === failure.asset_id);
          const site = sites.find(item => item.id === asset?.site_id);
          return <article className="failure-item" key={failure.id}><div className="failure-item-icon"><AlertTriangle size={16}/></div><div><h3>{failure.failure_mode || "Unclassified failure"}</h3><p>{asset?.name || "Asset"} · {site?.name || "Site"} · {new Date(failure.occurred_at).toLocaleDateString()}</p><small>{failure.failure_cause || "Cause not recorded"}{failure.downtime_minutes != null ? " · " + failure.downtime_minutes + " min downtime" : ""} · {failure.status}</small>{failure.symptom && <small>{failure.symptom}</small>}{failure.corrective_action && <small>Action: {failure.corrective_action}</small>}</div></article>;
        })}</div> : <div className="library-empty"><div className="library-empty-icon"><AlertTriangle size={23}/></div><h3>No failure events yet</h3><p>Log a failure event to start a site and asset reliability history.</p></div>}
      </section>
    </div>
  </div>;
}
