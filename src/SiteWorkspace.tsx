import { useEffect, useState } from "react";
import { Activity, ArrowLeft, BookOpen, CalendarDays, ExternalLink, FileText, Gauge, PackageSearch, Wrench } from "lucide-react";
import { supabase } from "./lib/supabase";

type Site = { id: string; name: string; state: string | null; timezone: string | null; active: boolean };
type SiteData = {
 areas: any[];
 lines: any[];
 assets: any[];
 components: any[];
 photos: any[];
 notes: any[];
 documents: any[];
 versions: any[];
 failures: any[];
 projects: any[];
 actions: any[];
 visits: any[];
 maximoAssets: any[];
 workOrders: any[];
 specifications: any[];
 kpis: any[];
 kpiValues: any[];
 lubricants: any[];
};
type TabId = "overview" | "hierarchy" | "notes" | "documents" | "maintenance" | "reliability";

const EMPTY_DATA: SiteData = {
 areas: [], lines: [], assets: [], components: [], photos: [], notes: [], documents: [], versions: [],
 failures: [], projects: [], actions: [], visits: [], maximoAssets: [], workOrders: [],
 specifications: [], kpis: [], kpiValues: [], lubricants: []
};

function inFilter(column: string, ids: string[]) {
 return ids.length ? column + ".in.(" + ids.join(",") + ")" : "";
}

async function fetchRows(table: string, columns: string, filters: string[], orderColumn?: string, ascending = false) {
 let query = (supabase as any).from(table).select(columns);
 if (filters.length) query = query.or(filters.join(","));
 else query = query.limit(0);
 if (orderColumn) query = query.order(orderColumn, { ascending });
 const { data, error } = await query;
 if (error) throw new Error(table + ": " + error.message);
 return data || [];
}

export default function SiteWorkspace({ site, onBack }: { site: Site; onBack: () => void }) {
 const [data, setData] = useState<SiteData>(EMPTY_DATA);
 const [tab, setTab] = useState<TabId>("overview");
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [message, setMessage] = useState("");
 const [noteTitle, setNoteTitle] = useState("");
 const [noteBody, setNoteBody] = useState("");
 const [noteType, setNoteType] = useState("engineering");
 const [noteAsset, setNoteAsset] = useState("");
 const [savingNote, setSavingNote] = useState(false);

 async function load(silent = false) {
  if (!silent) setLoading(true);
  setError("");
  try {
   const [areas, assets, visits, maximoAssets, workOrders, kpis] = await Promise.all([
    fetchRows("areas", "id,site_id,code,name,description", ["site_id.eq." + site.id], "name", true),
    fetchRows("assets", "id,site_id,production_line_id,parent_asset_id,asset_tag,name,asset_class,manufacturer,model,criticality,status,description", ["site_id.eq." + site.id], "name", true),
    fetchRows("site_visits", "id,site_id,visit_date,purpose,summary,created_by,created_at", ["site_id.eq." + site.id], "visit_date"),
    fetchRows("maximo_assets", "id,site_id,maximo_asset_id,asset_tag,description,status,location,parent_asset_id", ["site_id.eq." + site.id], "asset_tag", true),
    fetchRows("maximo_work_orders", "id,site_id,maximo_work_order_id,maximo_asset_id,description,status,work_type,priority,reported_date,target_start,actual_start,actual_finish", ["site_id.eq." + site.id], "reported_date"),
    fetchRows("kpi_definitions", "id,site_id,name,code,description,unit,active", ["site_id.eq." + site.id, "site_id.is.null"], "name", true)
   ]);

   const assetIds = assets.map((row: any) => row.id);
   const [lines, components, photos, failures, projects] = await Promise.all([
    fetchRows("production_lines", "id,area_id,code,name,description", [inFilter("area_id", areas.map((row: any) => row.id))].filter(Boolean), "name", true),
    fetchRows("asset_components", "id,asset_id,component_type,name,manufacturer,model,part_number,serial_number,description", [inFilter("asset_id", assetIds)].filter(Boolean), "name", true),
    fetchRows("asset_photos", "id,asset_id,caption,storage_path,created_at", [inFilter("asset_id", assetIds)].filter(Boolean), "created_at"),
    fetchRows("failure_events", "id,asset_id,occurred_at,detected_at,restored_at,status,failure_mode,failure_cause,symptom,corrective_action,downtime_minutes,production_loss,maximo_work_order_id", [inFilter("asset_id", assetIds)].filter(Boolean), "occurred_at"),
    fetchRows("reliability_projects", "id,site_id,asset_id,name,description,status,owner_id,start_date,target_date,completed_date,created_at", ["site_id.eq." + site.id, inFilter("asset_id", assetIds)].filter(Boolean), "created_at")
   ]);

   const projectIds = projects.map((row: any) => row.id);
   const failureIds = failures.map((row: any) => row.id);
   const visitIds = visits.map((row: any) => row.id);
   const componentIds = components.map((row: any) => row.id);
   const kpiIds = kpis.map((row: any) => row.id);
   const relatedFilters = [
    "site_id.eq." + site.id,
    inFilter("asset_id", assetIds),
    inFilter("project_id", projectIds),
    inFilter("failure_event_id", failureIds)
   ].filter(Boolean);
   const [notes, documents, actions, specifications, kpiValues] = await Promise.all([
    fetchRows("notes", "id,site_id,asset_id,failure_event_id,project_id,visit_id,note_type,title,body,created_at", [...relatedFilters, inFilter("visit_id", visitIds)].filter(Boolean), "created_at"),
    fetchRows("documents", "id,site_id,asset_id,project_id,failure_event_id,name,document_type,description,storage_path,source_system,source_reference,created_at", relatedFilters, "created_at"),
    fetchRows("corrective_actions", "id,project_id,failure_event_id,title,description,owner_id,due_date,completed_at,status,created_at", [inFilter("project_id", projectIds), inFilter("failure_event_id", failureIds)].filter(Boolean), "due_date", true),
    fetchRows("technical_specifications", "id,asset_id,component_id,specification_name,specification_value,unit,source_type,source_document_id,source_page,notes", [inFilter("asset_id", assetIds), inFilter("component_id", componentIds)].filter(Boolean), "specification_name", true),
    fetchRows("kpi_values", "id,kpi_id,asset_id,period_start,period_end,value,target,source", [inFilter("kpi_id", kpiIds), inFilter("asset_id", assetIds)].filter(Boolean), "period_end")
   ]);

   const documentIds = documents.map((row: any) => row.id);
   const [versions, lubricants] = await Promise.all([
    fetchRows("document_versions", "id,document_id,version_label,storage_path,file_size_bytes,revision_date,created_at", [inFilter("document_id", documentIds)].filter(Boolean), "created_at"),
    fetchRows("lubricants", "id,manufacturer,product_name,lubricant_type,viscosity_grade,base_oil,nlgi_grade,notes,source_document_id", [inFilter("source_document_id", documentIds)].filter(Boolean), "product_name", true)
   ]);

   setData({ areas, lines, assets, components, photos, notes, documents, versions, failures, projects, actions, visits, maximoAssets, workOrders, specifications, kpis, kpiValues, lubricants });
  } catch (cause) {
   setError(cause instanceof Error ? cause.message : "Site records could not be loaded.");
  } finally {
   if (!silent) setLoading(false);
  }
 }

 useEffect(() => { void load(); }, [site.id]);

 async function addNote(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");
  setMessage("");
  setSavingNote(true);
  const user = await supabase!.auth.getUser();
  if (user.error || !user.data.user) {
   setError(user.error?.message || "Your session could not be confirmed.");
   setSavingNote(false);
   return;
  }
  const result = await supabase!.from("notes").insert({
   site_id: site.id,
   asset_id: noteAsset || null,
   title: noteTitle.trim() || null,
   body: noteBody.trim(),
   note_type: noteType,
   author_id: user.data.user.id
  });
  if (result.error) setError(result.error.message);
  else {
   setMessage("Note added to " + site.name + ".");
   setNoteTitle("");
   setNoteBody("");
   setNoteAsset("");
   await load(true);
  }
  setSavingNote(false);
 }

 async function openDocument(document: any) {
  const version = data.versions.find((row: any) => row.document_id === document.id);
  const path = version?.storage_path || document.storage_path;
  if (!path) {
   setError("This reference has no file attached.");
   return;
  }
  const result = await supabase!.storage.from("reliability-library").createSignedUrl(path, 3600);
  if (result.error || !result.data) setError(result.error?.message || "Could not open the file.");
  else window.location.assign(result.data.signedUrl);
 }

 const tabItems: { id: TabId; label: string; count?: number }[] = [
  { id: "overview", label: "Overview" },
  { id: "hierarchy", label: "Hierarchy", count: data.assets.length },
  { id: "notes", label: "Notes", count: data.notes.length },
  { id: "documents", label: "Documents", count: data.documents.length },
  { id: "maintenance", label: "Maintenance", count: data.actions.length + data.workOrders.length + data.visits.length },
  { id: "reliability", label: "Reliability", count: data.failures.length + data.projects.length + data.kpiValues.length }
 ];

 const renderAsset = (asset: any) => {
  const parent = data.assets.find((row: any) => row.id === asset.parent_asset_id);
  const components = data.components.filter((row: any) => row.asset_id === asset.id);
  const photoCount = data.photos.filter((row: any) => row.asset_id === asset.id).length;
  return <article className="site-asset-item" key={asset.id}>
   <div className="site-asset-heading">
    <div className="row-icon"><PackageSearch size={17}/></div>
    <div className="row-copy"><b>{asset.name}</b><span>{asset.asset_tag || "No asset tag"}{asset.asset_class ? " · " + asset.asset_class : ""}{parent ? " · Parent: " + parent.name : ""}</span></div>
    <span className={asset.criticality >= 4 ? "critical-tag" : "tag"}>{asset.criticality ? "Criticality " + asset.criticality : asset.status}</span>
   </div>
   {(components.length > 0 || photoCount > 0) && <div className="site-asset-related">
    {components.map((component: any) => <span className="site-component-pill" key={component.id}>{component.name}{component.part_number ? " · " + component.part_number : ""}</span>)}
    {photoCount > 0 && <span className="site-component-pill">{photoCount} photo{photoCount === 1 ? "" : "s"}</span>}
   </div>}
  </article>;
 };

 const documentsSorted = [...data.documents].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
 const notesSorted = [...data.notes].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

 return <div className="site-workspace">
  <button type="button" className="back-btn" onClick={onBack}><ArrowLeft size={16}/> All sites</button>
  <div className="site-workspace-heading">
   <div><p className="eyebrow">SITE WORKSPACE</p><h1>{site.name}</h1><p className="muted">{[site.state, site.timezone].filter(Boolean).join(" · ") || "Location details not set"}</p></div>
   <span className="tag">{site.active ? "Active" : "Inactive"}</span>
  </div>
  {error && <div className="notice error wide">{error}</div>}
  {message && <div className="notice wide">{message}</div>}
  <div className="site-tabs" role="tablist" aria-label={site.name + " sections"}>
   {tabItems.map(item => <button type="button" key={item.id} className={tab === item.id ? "site-tab active" : "site-tab"} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}{item.count !== undefined && <span>{item.count}</span>}</button>)}
  </div>
  {loading ? <div className="panel site-loading">Loading site records…</div> : <>
   {tab === "overview" && <div className="site-tab-content">
    <div className="site-summary-grid">
     <Summary label="Assets" value={data.assets.length} icon={<PackageSearch size={17}/>} />
     <Summary label="Notes" value={data.notes.length} icon={<FileText size={17}/>} />
     <Summary label="Documents" value={data.documents.length} icon={<BookOpen size={17}/>} />
     <Summary label="Work orders" value={data.workOrders.length} icon={<Wrench size={17}/>} />
     <Summary label="Failures" value={data.failures.length} icon={<Activity size={17}/>} />
     <Summary label="Visits" value={data.visits.length} icon={<CalendarDays size={17}/>} />
    </div>
    <div className="two-col site-overview-grid">
     <section className="panel"><div className="panel-head"><div><h2>Site details</h2><p>Shared operating location</p></div><Gauge size={19}/></div><div className="site-info-grid"><div><span>State</span><b>{site.state || "Not set"}</b></div><div><span>Time zone</span><b>{site.timezone || "Not set"}</b></div><div><span>Status</span><b>{site.active ? "Active" : "Inactive"}</b></div><div><span>Areas and lines</span><b>{data.areas.length} areas · {data.lines.length} lines</b></div></div></section>
     <section className="panel"><div className="panel-head"><div><h2>Recent records</h2><p>Latest notes and references for this site</p></div><FileText size={19}/></div>
      {notesSorted.length || documentsSorted.length ? <div className="site-recent-list">
       {[...notesSorted.slice(0, 3).map((row: any) => ({ key: "note-" + row.id, kind: "Note", title: row.title || "Untitled note", detail: row.body, date: row.created_at, target: "notes" as TabId })), ...documentsSorted.slice(0, 3).map((row: any) => ({ key: "doc-" + row.id, kind: "Document", title: row.name, detail: row.source_system || row.document_type, date: row.created_at, target: "documents" as TabId }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(item => <button type="button" className="site-recent-item" key={item.key} onClick={() => setTab(item.target)}><span className="tag">{item.kind}</span><span><b>{item.title}</b><small>{item.detail || "No additional details"}</small></span><small>{new Date(item.date).toLocaleDateString()}</small></button>)}
      </div> : <div className="empty">Notes, manuals, and other records added to this site will appear here.</div>}
     </section>
    </div>
   </div>}

   {tab === "hierarchy" && <div className="site-tab-content">
    <section className="panel"><div className="panel-head"><div><h2>Equipment hierarchy</h2><p>Areas, production lines, assets, and components at {site.name}</p></div><PackageSearch size={19}/></div>
     {data.areas.length || data.assets.length ? <div className="site-hierarchy">
      {data.areas.map((area: any) => <details className="site-hierarchy-node" key={area.id} open><summary><b>{area.name}</b><span>{area.code}</span></summary>
       {data.lines.filter((line: any) => line.area_id === area.id).map((line: any) => <details className="site-hierarchy-node site-hierarchy-line" key={line.id} open><summary><b>{line.name}</b><span>{line.code}</span></summary>
        {data.assets.filter((asset: any) => asset.production_line_id === line.id).map(renderAsset)}
        {!data.assets.some((asset: any) => asset.production_line_id === line.id) && <div className="empty">No assets assigned to this line yet.</div>}
       </details>)}
       {!data.lines.some((line: any) => line.area_id === area.id) && <div className="empty">No production lines in this area yet.</div>}
      </details>)}
      {data.assets.filter((asset: any) => !asset.production_line_id).length > 0 && <section className="site-unassigned"><h3>Assets without a production line</h3>{data.assets.filter((asset: any) => !asset.production_line_id).map(renderAsset)}</section>}
     </div> : <div className="empty">No hierarchy records have been added to this site yet.</div>}
    </section>
   </div>}

   {tab === "notes" && <div className="site-tab-content two-col site-notes-layout">
    <form className="panel site-note-form" onSubmit={addNote}><div className="panel-head"><div><h2>Add a note</h2><p>Attach it to this site or one of its assets.</p></div><FileText size={19}/></div>
     <label>Asset (optional)<select value={noteAsset} onChange={event => setNoteAsset(event.target.value)}><option value="">Site-wide note</option>{data.assets.map((asset: any) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.asset_tag || "No tag"}</option>)}</select></label>
     <label>Type<select value={noteType} onChange={event => setNoteType(event.target.value)}><option value="engineering">Engineering</option><option value="site_visit">Site visit</option><option value="maintenance">Maintenance</option><option value="general">General</option><option value="rCA">RCA</option></select></label>
     <label>Title<input value={noteTitle} onChange={event => setNoteTitle(event.target.value)} placeholder="Optional note title"/></label>
     <label>Note<textarea rows={7} required value={noteBody} onChange={event => setNoteBody(event.target.value)} placeholder="Write the site note…"/></label>
     <button className="primary" type="submit" disabled={savingNote || !noteBody.trim()}>{savingNote ? "Saving…" : "Add note"}</button>
    </form>
    <section className="panel"><div className="panel-head"><div><h2>Site notes</h2><p>{data.notes.length} linked note{data.notes.length === 1 ? "" : "s"}</p></div></div>
     {notesSorted.length ? <div className="site-record-list">{notesSorted.map((note: any) => <article className="site-record" key={note.id}><div className="site-record-head"><div><span className="tag">{note.note_type}</span><h3>{note.title || "Untitled note"}</h3></div><small>{new Date(note.created_at).toLocaleString()}</small></div><p>{note.body}</p>{note.asset_id && <small>{data.assets.find((asset: any) => asset.id === note.asset_id)?.name || "Linked asset"}</small>}</article>)}</div> : <div className="empty">No notes are attached to this site yet.</div>}
    </section>
   </div>}

   {tab === "documents" && <div className="site-tab-content">
    <section className="panel"><div className="panel-head"><div><h2>Documents and references</h2><p>Manuals, prints, procedures, specifications, and reliability sources for this site</p></div><BookOpen size={19}/></div>
     {documentsSorted.length ? <div className="site-record-list">{documentsSorted.map((document: any) => {
      const latest = data.versions.find((row: any) => row.document_id === document.id);
      const asset = data.assets.find((row: any) => row.id === document.asset_id);
      const hasFile = Boolean(latest?.storage_path || document.storage_path);
      return <article className="site-record" key={document.id}><div className="site-record-head"><div><span className="tag">{document.document_type}</span><h3>{document.name}</h3></div><button type="button" className="secondary" disabled={!hasFile} onClick={() => void openDocument(document)}>{hasFile ? <><ExternalLink size={14}/> Open file</> : "No file"}</button></div><p>{document.description || "No description"}{asset ? " · " + asset.name : ""}</p><small>{[document.source_system, document.source_reference, latest?.version_label ? "Rev " + latest.version_label : ""].filter(Boolean).join(" · ") || "Source not recorded"}</small></article>;
     })}</div> : <div className="empty">No documents are attached yet. Add manuals, prints, or other reliability references to this site in the Technical Library.</div>}
    </section>
   </div>}

   {tab === "maintenance" && <div className="site-tab-content site-data-grid">
    <RecordPanel title="Corrective actions" icon={<Wrench size={18}/>} items={data.actions.map((row: any) => ({ title: row.title, detail: [row.status, row.due_date ? "Due " + row.due_date : "", row.description].filter(Boolean).join(" · ") }))} empty="No corrective actions are linked to this site yet."/>
    <RecordPanel title="Maximo work orders" icon={<Wrench size={18}/>} items={data.workOrders.map((row: any) => ({ title: row.maximo_work_order_id, detail: [row.work_type, row.status, row.priority ? "Priority " + row.priority : "", row.description].filter(Boolean).join(" · ") }))} empty="No imported work orders are attached to this site."/>
    <RecordPanel title="Site visits" icon={<CalendarDays size={18}/>} items={data.visits.map((row: any) => ({ title: row.purpose || "Site visit", detail: [row.visit_date, row.summary].filter(Boolean).join(" · ") }))} empty="No site visits are linked to this site yet."/>
   </div>}

   {tab === "reliability" && <div className="site-tab-content site-data-grid">
    <RecordPanel title="Failure events" icon={<Activity size={18}/>} items={data.failures.map((row: any) => ({ title: row.failure_mode || row.symptom || "Failure event", detail: [row.occurred_at ? new Date(row.occurred_at).toLocaleDateString() : "", row.status, row.failure_cause, row.downtime_minutes ? row.downtime_minutes + " min downtime" : ""].filter(Boolean).join(" · ") }))} empty="No failure events are linked to this site's assets."/>
    <RecordPanel title="Reliability projects" icon={<Gauge size={18}/>} items={data.projects.map((row: any) => ({ title: row.name, detail: [row.status, row.target_date ? "Target " + row.target_date : "", row.description].filter(Boolean).join(" · ") }))} empty="No reliability projects are attached to this site."/>
    <RecordPanel title="KPI values" icon={<Gauge size={18}/>} items={data.kpiValues.map((row: any) => { const definition = data.kpis.find((item: any) => item.id === row.kpi_id); return { title: definition?.name || "KPI", detail: [row.value + (definition?.unit ? " " + definition.unit : ""), row.period_start && row.period_end ? row.period_start + " – " + row.period_end : "", row.target != null ? "Target " + row.target : ""].filter(Boolean).join(" · ") }; })} empty="No KPI values are recorded for this site."/>
    <RecordPanel title="Technical specifications" icon={<BookOpen size={18}/>} items={data.specifications.map((row: any) => ({ title: row.specification_name + ": " + row.specification_value + (row.unit ? " " + row.unit : ""), detail: [data.assets.find((asset: any) => asset.id === row.asset_id)?.name, row.source_type, row.source_page ? "Page " + row.source_page : "", row.notes].filter(Boolean).join(" · ") }))} empty="No specifications are attached to this site's assets."/>
    <RecordPanel title="Lubricants" icon={<BookOpen size={18}/>} items={data.lubricants.map((row: any) => ({ title: [row.manufacturer, row.product_name].filter(Boolean).join(" "), detail: [row.lubricant_type, row.viscosity_grade, row.base_oil, row.nlgi_grade ? "NLGI " + row.nlgi_grade : "", row.notes].filter(Boolean).join(" · ") }))} empty="No lubricant references are linked to this site's documents."/>
   </div>}
  </>}
 </div>;
}

function Summary({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
 return <div className="site-summary-card"><div><span>{label}</span>{icon}</div><b>{value}</b></div>;
}

function RecordPanel({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: { title: string; detail: string }[]; empty: string }) {
 return <section className="panel"><div className="panel-head"><div><h2>{title}</h2><p>{items.length} record{items.length === 1 ? "" : "s"}</p></div>{icon}</div>{items.length ? <div className="site-record-list">{items.map((item, index) => <article className="site-record compact" key={title + index}><h3>{item.title}</h3><p>{item.detail || "No additional details"}</p></article>)}</div> : <div className="empty">{empty}</div>}</section>;
}
