import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, MapPin, Plus, Smartphone } from "lucide-react";
import { supabase } from "./lib/supabase";

type Site = { id: string; name: string; state: string | null; timezone: string | null };
type Asset = { id: string; site_id: string; name: string; asset_tag: string };
type Visit = {
  id: string; site_id: string; asset_id: string | null; visit_date: string; scheduled_start: string | null;
  scheduled_end: string | null; all_day: boolean; purpose: string | null; summary: string | null; location: string | null;
  created_at: string;
};
type VisitDraft = { site_id: string; asset_id: string; visit_date: string; start_time: string; duration: string; purpose: string; summary: string; location: string };

const today = () => new Date().toISOString().slice(0, 10);
const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const blankVisit = (): VisitDraft => ({ site_id: "", asset_id: "", visit_date: today(), start_time: "", duration: "60", purpose: "", summary: "", location: "" });

export default function CalendarPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [draft, setDraft] = useState<VisitDraft>(blankVisit());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    const [siteResult, assetResult, visitResult] = await Promise.all([
      supabase!.from("sites").select("id,name,state,timezone").order("name"),
      supabase!.from("assets").select("id,site_id,name,asset_tag").order("name"),
      supabase!.from("site_visits").select("id,site_id,asset_id,visit_date,scheduled_start,scheduled_end,all_day,purpose,summary,location,created_at").order("visit_date", { ascending: false })
    ]);
    if (siteResult.error) setError(siteResult.error.message);
    else setSites((siteResult.data || []) as Site[]);
    if (assetResult.error) setError(assetResult.error.message);
    else setAssets((assetResult.data || []) as Asset[]);
    if (visitResult.error) setError(visitResult.error.message);
    else setVisits((visitResult.data || []) as Visit[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const visibleVisits = useMemo(() => visits.filter(v => siteFilter === "all" || v.site_id === siteFilter), [visits, siteFilter]);
  const setDraftValue = (key: keyof VisitDraft, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const siteAssets = assets.filter(asset => asset.site_id === draft.site_id);

  async function saveVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    const user = await supabase!.auth.getUser();
    if (user.error || !user.data.user) {
      setError(user.error?.message || "Your session could not be confirmed."); setSaving(false); return;
    }
    const timed = Boolean(draft.start_time);
    let scheduledStart: string | null = null;
    let scheduledEnd: string | null = null;
    if (timed) {
      const start = new Date(draft.visit_date + "T" + draft.start_time);
      const end = new Date(start.getTime() + Math.max(15, Number(draft.duration) || 60) * 60000);
      scheduledStart = start.toISOString();
      scheduledEnd = end.toISOString();
    }
    const result = await supabase!.from("site_visits").insert({
      site_id: draft.site_id, asset_id: draft.asset_id || null, visit_date: draft.visit_date,
      scheduled_start: scheduledStart, scheduled_end: scheduledEnd, all_day: !timed,
      purpose: draft.purpose.trim() || null, summary: draft.summary.trim() || null,
      location: draft.location.trim() || null, created_by: user.data.user.id
    });
    if (result.error) setError(result.error.message);
    else {
      setDraft(blankVisit());
      setMessage("Site visit saved and added to your calendar.");
      await load();
    }
    setSaving(false);
  }

  function exportVisits(selected: Visit[], filename: string) {
    if (!selected.length) return;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Reliability Workspace//Site Visits//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const visit of selected) {
      const site = sites.find(item => item.id === visit.site_id);
      const asset = assets.find(item => item.id === visit.asset_id);
      const summary = [visit.purpose || "Site visit", site?.name, asset?.name].filter(Boolean).join(" · ");
      const description = [
        visit.summary ? "Visit notes: " + visit.summary : "",
        site ? "Site: " + site.name : "",
        site?.state ? "State: " + site.state : "",
        site?.timezone ? "Site time zone: " + site.timezone : "",
        asset ? "Asset: " + asset.name + (asset.asset_tag ? " (" + asset.asset_tag + ")" : "") : ""
      ].filter(Boolean).join("\\n");
      lines.push("BEGIN:VEVENT", "UID:" + visit.id + "@reliability-workspace", "DTSTAMP:" + icalUtc(new Date()),
        "SUMMARY:" + icalEscape(summary), "DESCRIPTION:" + icalEscape(description));
      if (visit.all_day || !visit.scheduled_start) {
        lines.push("DTSTART;VALUE=DATE:" + visit.visit_date.replace(/-/g, ""));
        lines.push("DTEND;VALUE=DATE:" + addDays(visit.visit_date, 1).replace(/-/g, ""));
      } else {
        const start = new Date(visit.scheduled_start);
        const end = visit.scheduled_end ? new Date(visit.scheduled_end) : new Date(start.getTime() + 60 * 60000);
        lines.push("DTSTART:" + icalUtc(start), "DTEND:" + icalUtc(end));
      }
      const location = [visit.location, site?.name].filter(Boolean).join(", ");
      if (location) lines.push("LOCATION:" + icalEscape(location));
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\\r\\n") + "\\r\\n"], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Calendar file prepared. On iPhone, open the downloaded .ics file and choose Add All to Calendar.");
  }

  return <div className="calendar-page">
    <div className="hero"><div><p className="eyebrow">VISITS & SCHEDULE</p><h1>My Calendar</h1><p className="muted">Plan site visits, link them to equipment, and add them to Apple Calendar on your iPhone.</p></div>
      <button type="button" className="primary" disabled={!visibleVisits.length} onClick={() => exportVisits(visibleVisits, "reliability-site-visits.ics")}><Smartphone size={16}/> Add visits to iPhone Calendar</button>
    </div>
    {error && <div className="notice error wide">{error}</div>}
    {message && <div className="notice wide">{message}</div>}
    <div className="calendar-layout">
      <form className="panel calendar-form" onSubmit={saveVisit}>
        <div className="panel-head"><div><h2>Schedule a site visit</h2><p>Saved visits appear here and in My Site Visits.</p></div><Plus size={18}/></div>
        <div className="form-grid">
          <label className="span-2">Site<select required value={draft.site_id} onChange={e => { setDraftValue("site_id", e.target.value); setDraftValue("asset_id", ""); }}><option value="">Select a site…</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}{site.state ? " · " + site.state : ""}</option>)}</select></label>
          <label className="span-2">Asset (optional)<select value={draft.asset_id} onChange={e => setDraftValue("asset_id", e.target.value)}><option value="">Site-wide visit</option>{siteAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.asset_tag}</option>)}</select></label>
          <label>Date<input required type="date" value={draft.visit_date} onChange={e => setDraftValue("visit_date", e.target.value)}/></label>
          <label>Start time (optional)<input type="time" value={draft.start_time} onChange={e => setDraftValue("start_time", e.target.value)}/></label>
          {draft.start_time && <label>Duration<select value={draft.duration} onChange={e => setDraftValue("duration", e.target.value)}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="240">4 hours</option><option value="480">Full day</option></select></label>}
          <label className={draft.start_time ? "" : "span-2"}>Location (optional)<input value={draft.location} onChange={e => setDraftValue("location", e.target.value)} placeholder="Building, address, or meeting point"/></label>
          <label className="span-2">Purpose<input value={draft.purpose} onChange={e => setDraftValue("purpose", e.target.value)} placeholder="Inspection, outage planning, follow-up…"/></label>
          <label className="span-2">Visit notes<textarea rows={3} value={draft.summary} onChange={e => setDraftValue("summary", e.target.value)} placeholder="Agenda, observations, or people to meet"/></label>
        </div>
        <button type="submit" className="primary" disabled={saving || !draft.site_id}><CalendarDays size={16}/>{saving ? "Saving…" : "Save visit"}</button>
      </form>
      <section className="panel calendar-agenda">
        <div className="panel-head"><div><h2>Site visit agenda</h2><p>{visibleVisits.length} saved visit{visibleVisits.length === 1 ? "" : "s"} · private to your account</p></div><CalendarDays size={19}/></div>
        <div className="calendar-toolbar"><select aria-label="Filter calendar by site" value={siteFilter} onChange={e => setSiteFilter(e.target.value)}><option value="all">All sites</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select><button type="button" className="secondary" disabled={!visibleVisits.length} onClick={() => exportVisits(visibleVisits, "reliability-site-visits.ics")}><Download size={14}/> Export .ics</button></div>
        {loading ? <div className="empty">Loading site visits…</div> : visibleVisits.length ? <div className="calendar-event-list">{visibleVisits.map(visit => {
          const site = sites.find(item => item.id === visit.site_id);
          const asset = assets.find(item => item.id === visit.asset_id);
          return <article className="calendar-event" key={visit.id}>
            <div className="calendar-date"><b>{new Date(visit.visit_date + "T12:00:00").toLocaleDateString(undefined, { day: "2-digit" })}</b><span>{new Date(visit.visit_date + "T12:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span></div>
            <div className="calendar-event-main"><h3>{visit.purpose || "Site visit"}</h3><p>{site?.name || "Site"}{asset ? " · " + asset.name : ""}</p><small>{visit.all_day || !visit.scheduled_start ? "All day" : new Date(visit.scheduled_start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{visit.location ? " · " + visit.location : ""}</small>{visit.summary && <small className="calendar-summary">{visit.summary}</small>}</div>
            <button type="button" className="icon calendar-event-export" onClick={() => exportVisits([visit], "site-visit-" + visit.visit_date + ".ics")} aria-label="Add this visit to iPhone Calendar"><Download size={16}/></button>
          </article>;
        })}</div> : <div className="library-empty"><div className="library-empty-icon"><CalendarDays size={24}/></div><h3>No site visits on the calendar</h3><p>Schedule a visit here, or save one in My Site Visits. This view includes the same linked visit records.</p></div>}
      </section>
    </div>
    <section className="calendar-ios-note"><Smartphone size={17}/><p><b>iPhone setup:</b> Tap “Add visits to iPhone Calendar,” open the .ics file, then tap <b>Add All</b>. This exports your visits and their site, asset, location, and notes.</p></section>
  </div>;
}

function icalUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\\.\\d{3}Z$/, "Z");
}
function icalEscape(value: string) {
  return value.replace(/\\\\/g, "\\\\\\\\").replace(/\\r?\\n/g, "\\\\n").replace(/,/g, "\\\\,").replace(/;/g, "\\\\;");
}
function addDays(value: string, days: number) {
  const date = new Date(value + "T12:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
