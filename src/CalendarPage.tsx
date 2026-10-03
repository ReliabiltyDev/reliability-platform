import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, MapPin, Plus, Smartphone, X } from "lucide-react";
import { supabase } from "./lib/supabase";

type Site = { id: string; name: string; state: string | null; timezone: string | null };
type Asset = { id: string; site_id: string; name: string; asset_tag: string };
type Visit = {
  id: string; site_id: string; asset_id: string | null; visit_date: string; scheduled_start: string | null;
  scheduled_end: string | null; all_day: boolean; purpose: string | null; summary: string | null; location: string | null;
  created_at: string;
};
type VisitDraft = { site_id: string; asset_id: string; visit_date: string; start_time: string; duration: string; purpose: string; summary: string; location: string };
type CalendarView = "day" | "week" | "month" | "year";
const today = () => dateKey(new Date());
const blankVisit = (): VisitDraft => ({ site_id: "", asset_id: "", visit_date: today(), start_time: "", duration: "60", purpose: "", summary: "", location: "" });

export default function CalendarPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [draft, setDraft] = useState<VisitDraft>(blankVisit());
  const [view, setView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [siteFilter, setSiteFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);

  async function load() {
    setLoading(true); setError("");
    const [siteResult, assetResult, visitResult] = await Promise.all([
      supabase!.from("sites").select("id,name,state,timezone").order("name"),
      supabase!.from("assets").select("id,site_id,name,asset_tag").order("name"),
      supabase!.from("site_visits").select("id,site_id,asset_id,visit_date,scheduled_start,scheduled_end,all_day,purpose,summary,location,created_at").order("visit_date", { ascending: true })
    ]);
    if (siteResult.error) setError(siteResult.error.message); else setSites((siteResult.data || []) as Site[]);
    if (assetResult.error) setError(assetResult.error.message); else setAssets((assetResult.data || []) as Asset[]);
    if (visitResult.error) setError(visitResult.error.message); else setVisits((visitResult.data || []) as Visit[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const visibleVisits = useMemo(() => visits.filter(v => siteFilter === "all" || v.site_id === siteFilter), [visits, siteFilter]);
  const setDraftValue = (key: keyof VisitDraft, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const siteAssets = assets.filter(asset => asset.site_id === draft.site_id);
  const period = getPeriod(view, anchorDate);
  const inPeriod = visibleVisits.filter(visit => visit.visit_date >= period.start && visit.visit_date <= period.end);
  const caption = periodCaption(view, anchorDate);

  function movePeriod(direction: number) {
    setAnchorDate(previous => {
      const next = new Date(previous);
      if (view === "day") next.setDate(next.getDate() + direction);
      if (view === "week") next.setDate(next.getDate() + direction * 7);
      if (view === "month") return new Date(next.getFullYear(), next.getMonth() + direction, 1, 12);
      if (view === "year") return new Date(next.getFullYear() + direction, next.getMonth(), 1, 12);
      return next;
    });
  }

  async function saveVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const user = await supabase!.auth.getUser();
    if (user.error || !user.data.user) { setError(user.error?.message || "Your session could not be confirmed."); setSaving(false); return; }
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
      purpose: draft.purpose.trim(), summary: draft.summary.trim() || null,
      location: draft.location.trim() || null, created_by: user.data.user.id
    });
    if (result.error) setError(result.error.message);
    else {
      setAnchorDate(parseDate(draft.visit_date));
      setDraft(blankVisit());
      setCreateOpen(false);
      setMessage("Appointment saved and linked to its site visit.");
      await load();
    }
    setSaving(false);
  }

  function exportVisits(selected: Visit[], filename: string) {
    if (!selected.length) return;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Reliability Workspace//Appointments//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
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
      ].filter(Boolean).join("\n");
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
    const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Calendar file prepared. Open the .ics file on iPhone, then tap Add All to Calendar.");
  }

  return <div className="calendar-page">
    <div className="hero calendar-hero">
      <div><p className="eyebrow">VISITS & SCHEDULE</p><h1>My Calendar</h1><p className="muted">Schedule appointments, link them to a site and asset, and add them to Apple Calendar.</p></div>
      <div className="calendar-top-actions"><button type="button" className="secondary" disabled={!visibleVisits.length} onClick={() => exportVisits(visibleVisits, "reliability-appointments.ics")}><Smartphone size={15}/> Export to iPhone</button><button type="button" className="primary" onClick={() => { setDraft(blankVisit()); setCreateOpen(true); setError(""); }}><Plus size={16}/> New appointment</button></div>
    </div>
    {error && <div className="notice error wide">{error}</div>}
    {message && <div className="notice wide">{message}</div>}

    <section className="panel calendar-board">
      <div className="calendar-board-toolbar">
        <div className="calendar-period-nav"><button className="icon" type="button" onClick={() => movePeriod(-1)} aria-label="Previous period"><ChevronLeft size={18}/></button><button className="icon" type="button" onClick={() => movePeriod(1)} aria-label="Next period"><ChevronRight size={18}/></button><button type="button" className="secondary calendar-today" onClick={() => setAnchorDate(new Date())}>Today</button><h2>{caption}</h2></div>
        <div className="calendar-board-filters"><select aria-label="Filter appointments by site" value={siteFilter} onChange={e => setSiteFilter(e.target.value)}><option value="all">All sites</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select><div className="calendar-view-switch" role="tablist" aria-label="Calendar view">{(["day", "week", "month", "year"] as CalendarView[]).map(item => <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div>
      </div>
      {loading ? <div className="empty">Loading calendar…</div> : <>
        {view === "month" && <MonthView date={anchorDate} visits={inPeriod} sites={sites} assets={assets} onSelect={setSelectedVisit} onDay={date => { setAnchorDate(date); setView("day"); }}/>}
        {view === "week" && <WeekView date={anchorDate} visits={inPeriod} sites={sites} assets={assets} onSelect={setSelectedVisit} onDay={date => { setAnchorDate(date); setView("day"); }}/>}
        {view === "day" && <DayView date={anchorDate} visits={inPeriod} sites={sites} assets={assets} onSelect={setSelectedVisit} onNew={() => { setDraft({ ...blankVisit(), visit_date: dateKey(anchorDate) }); setCreateOpen(true); }}/>}
        {view === "year" && <YearView date={anchorDate} visits={inPeriod} sites={sites} assets={assets} onMonth={date => { setAnchorDate(date); setView("month"); }} onSelect={setSelectedVisit}/>}
      </>}
      <div className="calendar-board-footer"><span>{inPeriod.length} appointment{inPeriod.length === 1 ? "" : "s"} in this view</span><span>Appointments are saved as linked site visit records.</span></div>
    </section>

    <section className="calendar-ios-note"><Smartphone size={17}/><p><b>iPhone calendar:</b> Export creates an .ics file with appointment times, sites, assets, locations, and visit notes. Open it on iPhone and choose <b>Add All</b>. Re-export after edits to refresh the imported events.</p></section>

    {createOpen && <div className="site-create-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
      <section className="panel calendar-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-title">
        <div className="panel-head"><div><h2 id="appointment-title">New appointment</h2><p>Appointments are linked to a site visit and can include an asset.</p></div><button type="button" className="icon" onClick={() => setCreateOpen(false)} aria-label="Close"><X size={18}/></button></div>
        <form className="calendar-form" onSubmit={saveVisit}>
          <div className="form-grid">
            <label className="span-2">Site<select required value={draft.site_id} onChange={e => { setDraftValue("site_id", e.target.value); setDraftValue("asset_id", ""); }}><option value="">Select a site…</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}{site.state ? " · " + site.state : ""}</option>)}</select></label>
            <label className="span-2">Asset (optional)<select value={draft.asset_id} onChange={e => setDraftValue("asset_id", e.target.value)}><option value="">Site-wide appointment</option>{siteAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.asset_tag}</option>)}</select></label>
            <label className="span-2">Appointment title<input required value={draft.purpose} onChange={e => setDraftValue("purpose", e.target.value)} placeholder="Inspection, outage planning, follow-up…"/></label>
            <label>Date<input required type="date" value={draft.visit_date} onChange={e => setDraftValue("visit_date", e.target.value)}/></label>
            <label>Start time<input type="time" value={draft.start_time} onChange={e => setDraftValue("start_time", e.target.value)}/></label>
            {draft.start_time && <label>Duration<select value={draft.duration} onChange={e => setDraftValue("duration", e.target.value)}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="240">4 hours</option><option value="480">Full day</option></select></label>}
            <label className={draft.start_time ? "" : "span-2"}>Location (optional)<input value={draft.location} onChange={e => setDraftValue("location", e.target.value)} placeholder="Building, address, or meeting point"/></label>
            <label className="span-2">Agenda and visit notes<textarea rows={3} value={draft.summary} onChange={e => setDraftValue("summary", e.target.value)} placeholder="Agenda, observations, or people to meet"/></label>
          </div>
          <div className="site-create-actions"><button type="button" className="secondary" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="primary" disabled={saving || !draft.site_id || !draft.purpose.trim()}><CalendarDays size={16}/>{saving ? "Saving…" : "Save appointment"}</button></div>
        </form>
      </section>
    </div>}

    {selectedVisit && <VisitDetails visit={selectedVisit} site={sites.find(item => item.id === selectedVisit.site_id)} asset={assets.find(item => item.id === selectedVisit.asset_id)} onClose={() => setSelectedVisit(null)} onExport={() => exportVisits([selectedVisit], "appointment-" + selectedVisit.visit_date + ".ics")}/>}
  </div>;
}

function MonthView({ date, visits, sites, assets, onSelect, onDay }: { date: Date; visits: Visit[]; sites: Site[]; assets: Asset[]; onSelect: (visit: Visit) => void; onDay: (date: Date) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  return <div className="calendar-month-wrap"><div className="calendar-weekday-row">{weekdays.map(day => <span key={day}>{day}</span>)}</div><div className="calendar-month-grid">{days.map(day => {
    const dayVisits = visits.filter(visit => visit.visit_date === dateKey(day));
    return <div key={dateKey(day)} className={"calendar-month-cell" + (day.getMonth() !== date.getMonth() ? " outside" : "") + (dateKey(day) === today() ? " today" : "")}>
      <button type="button" className="calendar-date-number" onClick={() => onDay(day)}>{day.getDate()}</button>
      <EventChips visits={dayVisits} sites={sites} assets={assets} onSelect={onSelect} limit={3}/>
      {dayVisits.length > 3 && <small className="calendar-more">+{dayVisits.length - 3} more</small>}
    </div>;
  })}</div></div>;
}

function WeekView({ date, visits, sites, assets, onSelect, onDay }: { date: Date; visits: Visit[]; sites: Site[]; assets: Asset[]; onSelect: (visit: Visit) => void; onDay: (date: Date) => void }) {
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  return <div className="calendar-week-view">{days.map(day => {
    const dayVisits = visits.filter(visit => visit.visit_date === dateKey(day));
    return <section className={"calendar-week-day" + (dateKey(day) === today() ? " today" : "")} key={dateKey(day)}>
      <button type="button" className="calendar-week-heading" onClick={() => onDay(day)}><span>{weekdays[day.getDay()]}</span><b>{day.getDate()}</b></button>
      <EventChips visits={dayVisits} sites={sites} assets={assets} onSelect={onSelect}/>
    </section>;
  })}</div>;
}

function DayView({ date, visits, sites, assets, onSelect, onNew }: { date: Date; visits: Visit[]; sites: Site[]; assets: Asset[]; onSelect: (visit: Visit) => void; onNew: () => void }) {
  const dayVisits = visits.filter(visit => visit.visit_date === dateKey(date));
  const allDay = dayVisits.filter(visit => visit.all_day || !visit.scheduled_start);
  const timed = dayVisits.filter(visit => !visit.all_day && visit.scheduled_start).sort((a, b) => (a.scheduled_start || "").localeCompare(b.scheduled_start || ""));
  return <div className="calendar-day-view">
    {allDay.length > 0 && <div className="calendar-all-day"><b>All day</b>{allDay.map(visit => <EventChip key={visit.id} visit={visit} site={sites.find(item => item.id === visit.site_id)} asset={assets.find(item => item.id === visit.asset_id)} onSelect={onSelect}/>)}</div>}
    <div className="calendar-day-agenda">{Array.from({ length: 17 }, (_, index) => index + 6).map(hour => {
      const hourVisits = timed.filter(visit => new Date(visit.scheduled_start!).getHours() === hour);
      return <div className="calendar-hour-row" key={hour}><span>{new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric" })}</span><div>{hourVisits.map(visit => <EventChip key={visit.id} visit={visit} site={sites.find(item => item.id === visit.site_id)} asset={assets.find(item => item.id === visit.asset_id)} onSelect={onSelect} showTime/>)}</div></div>;
    })}</div>
    {dayVisits.length === 0 && <div className="calendar-day-empty"><CalendarDays size={22}/><span>No appointments today.</span><button type="button" className="secondary" onClick={onNew}>Schedule one</button></div>}
  </div>;
}

function YearView({ date, visits, sites, assets, onMonth, onSelect }: { date: Date; visits: Visit[]; sites: Site[]; assets: Asset[]; onMonth: (date: Date) => void; onSelect: (visit: Visit) => void }) {
  return <div className="calendar-year-grid">{Array.from({ length: 12 }, (_, month) => {
    const first = new Date(date.getFullYear(), month, 1, 12);
    const start = startOfWeek(first);
    const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
    const monthVisits = visits.filter(visit => Number(visit.visit_date.slice(5, 7)) === month + 1);
    return <section className="calendar-year-month" key={month}>
      <button type="button" className="calendar-year-month-title" onClick={() => onMonth(first)}>{first.toLocaleDateString(undefined, { month: "long" })}<span>{monthVisits.length || ""}</span></button>
      <div className="calendar-mini-weekdays">{weekdays.map((day, index) => <span key={index}>{day[0]}</span>)}</div>
      <div className="calendar-mini-days">{days.map(day => {
        const dayVisits = visits.filter(visit => visit.visit_date === dateKey(day));
        return <button type="button" key={dateKey(day)} className={"calendar-mini-day" + (day.getMonth() !== month ? " outside" : "") + (dayVisits.length ? " has-events" : "") + (dateKey(day) === today() ? " today" : "")} onClick={() => dayVisits.length ? onSelect(dayVisits[0]) : onMonth(first)} title={dayVisits.map(visit => visit.purpose || "Site visit").join(", ")}>{day.getDate()}</button>;
      })}</div>
      {monthVisits.slice(0, 2).map(visit => <button type="button" className="calendar-year-event" key={visit.id} onClick={() => onSelect(visit)}>{dayLabel(visit.visit_date)} · {visit.purpose || "Site visit"}</button>)}
      {monthVisits.length > 2 && <small className="calendar-more">+{monthVisits.length - 2} more</small>}
    </section>;
  })}</div>;
}

function EventChips({ visits, sites, assets, onSelect, limit }: { visits: Visit[]; sites: Site[]; assets: Asset[]; onSelect: (visit: Visit) => void; limit?: number }) {
  return <div className="calendar-event-chips">{visits.slice(0, limit || visits.length).map(visit => <EventChip key={visit.id} visit={visit} site={sites.find(item => item.id === visit.site_id)} asset={assets.find(item => item.id === visit.asset_id)} onSelect={onSelect}/>)}</div>;
}
function EventChip({ visit, site, asset, onSelect, showTime = false }: { visit: Visit; site?: Site; asset?: Asset; onSelect: (visit: Visit) => void; showTime?: boolean }) {
  const time = visit.scheduled_start ? new Date(visit.scheduled_start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
  return <button type="button" className="calendar-event-chip" onClick={() => onSelect(visit)} title={[visit.purpose, site?.name, asset?.name].filter(Boolean).join(" · ")}><b>{showTime && time ? time + " " : ""}{visit.purpose || "Site visit"}</b><small>{site?.name || "Site"}{asset ? " · " + asset.name : ""}</small></button>;
}

function VisitDetails({ visit, site, asset, onClose, onExport }: { visit: Visit; site?: Site; asset?: Asset; onClose: () => void; onExport: () => void }) {
  return <div className="site-create-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="panel calendar-modal" role="dialog" aria-modal="true" aria-labelledby="visit-detail-title">
    <div className="panel-head"><div><p className="eyebrow">SITE APPOINTMENT</p><h2 id="visit-detail-title">{visit.purpose || "Site visit"}</h2></div><button type="button" className="icon" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
    <div className="calendar-visit-detail"><p><CalendarDays size={16}/>{new Date(visit.visit_date + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "full" })}{visit.scheduled_start ? " · " + new Date(visit.scheduled_start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : " · All day"}</p><p><MapPin size={16}/>{visit.location || site?.name || "Location not set"}</p><p><b>Site:</b> {site?.name || "Site"}{site?.timezone ? " · " + site.timezone : ""}</p>{asset && <p><b>Asset:</b> {asset.name} · {asset.asset_tag}</p>}{visit.summary && <p className="calendar-detail-notes">{visit.summary}</p>}</div>
    <div className="site-create-actions"><button type="button" className="secondary" onClick={onClose}>Close</button><button type="button" className="primary" onClick={onExport}><Download size={15}/> Export .ics</button></div>
  </section></div>;
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dateKey(date: Date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"); }
function parseDate(value: string) { return new Date(value + "T12:00:00"); }
function startOfWeek(date: Date) { const value = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12); value.setDate(value.getDate() - value.getDay()); return value; }
function getPeriod(view: CalendarView, date: Date) {
  if (view === "day") return { start: dateKey(date), end: dateKey(date) };
  if (view === "week") { const start = startOfWeek(date); const end = new Date(start); end.setDate(start.getDate() + 6); return { start: dateKey(start), end: dateKey(end) }; }
  if (view === "year") return { start: date.getFullYear() + "-01-01", end: date.getFullYear() + "-12-31" };
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12); const start = startOfWeek(first);
  const end = new Date(start); end.setDate(start.getDate() + 41); return { start: dateKey(start), end: dateKey(end) };
}
function periodCaption(view: CalendarView, date: Date) {
  if (view === "year") return String(date.getFullYear());
  if (view === "month") return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (view === "day") return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const start = startOfWeek(date); const end = new Date(start); end.setDate(start.getDate() + 6);
  return start.getMonth() === end.getMonth() ? start.toLocaleDateString(undefined, { month: "long", day: "numeric" }) + "–" + end.toLocaleDateString(undefined, { day: "numeric", year: "numeric" }) : start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + "–" + end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function dayLabel(value: string) { return parseDate(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function icalUtc(date: Date) { return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function icalEscape(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
function addDays(value: string, days: number) { const date = parseDate(value); date.setDate(date.getDate() + days); return dateKey(date); }
