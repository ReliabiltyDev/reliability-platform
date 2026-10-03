import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Activity, BookOpen, Calculator, ChevronDown, ChevronRight, ExternalLink, FilePlus2, FileText, Gauge, Link2, Plus, RefreshCw, ShieldCheck, Upload, Wrench, X } from "lucide-react";
import { supabase } from "./lib/supabase";

const LIBRARY_BUCKET = "reliability-library";
const GATES_MANUAL = "https://www.gates.com/content/dam/gates/home/knowledge-center/resource-library/operating-manuals/SonicTensionMeter_Manual_Mar2018_HIRES_NOBLEED.pdf";
const NIST_TORQUE = "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8";
const LIBRARY_TYPES = ["manual", "drawing", "print", "procedure", "spreadsheet", "photo", "report", "other"];
const TECHNIQUE_CATEGORIES = ["inspection", "lubrication", "belt_drive", "fastening", "alignment", "measurement", "cleaning", "other"];

type Site = { id: string; name: string; state: string | null; timezone: string | null };
type Asset = { id: string; site_id: string; name: string; asset_tag: string };
type LibraryDocument = {
 id: string; site_id: string; asset_id: string | null; name: string; document_type: string;
 description: string | null; storage_path: string | null; source_system: string | null;
 source_reference: string | null; created_at: string;
};
type LibraryVersion = { id: string; document_id: string; version_label: string; storage_path: string; file_size_bytes: number | null; revision_date: string | null; created_at: string };
type Technique = {
 id: string; site_id: string; asset_id: string | null; title: string; category: string; interval: string | null;
 safety_notes: string | null; tools: string | null; procedure_steps: string[]; measurement_specs: MeasurementSpec[];
 torque_specs: TorqueSpec[]; belt_tension: BeltTension | null; source_document_id: string | null;
 source_reference: string | null; source_page: string | null; created_at: string; updated_at: string;
};
type MeasurementSpec = { name: string; target: string; unit: string; method: string };
type TorqueSpec = { fastener: string; value: string; unit: string; notes: string };
type BeltTension = { belt_type: string; method: string; target: string; unit: string; span_length: string; notes: string };
type TechniqueDraft = {
 site_id: string; asset_id: string; title: string; category: string; interval: string; safety_notes: string; tools: string;
 steps: string; measurements: MeasurementSpec[]; torque: TorqueSpec[]; belt: BeltTension;
 source_document_id: string; source_reference: string; source_page: string;
};
type IntakeKind = "file" | "link" | "note";
type LibraryTab = "references" | "techniques" | "calculators";

const newMeasurement = (): MeasurementSpec => ({ name: "", target: "", unit: "", method: "" });
const newTorque = (): TorqueSpec => ({ fastener: "", value: "", unit: "N·m", notes: "" });
const blankBelt = (): BeltTension => ({ belt_type: "", method: "", target: "", unit: "", span_length: "", notes: "" });
const emptyDraft = (): TechniqueDraft => ({
 site_id: "", asset_id: "", title: "", category: "inspection", interval: "", safety_notes: "", tools: "",
 steps: "", measurements: [newMeasurement()], torque: [newTorque()], belt: blankBelt(),
 source_document_id: "", source_reference: "", source_page: ""
});

export default function TechnicalLibrary() {
 const [sites, setSites] = useState<Site[]>([]);
 const [assets, setAssets] = useState<Asset[]>([]);
 const [documents, setDocuments] = useState<LibraryDocument[]>([]);
 const [versions, setVersions] = useState<LibraryVersion[]>([]);
 const [techniques, setTechniques] = useState<Technique[]>([]);
 const [tab, setTab] = useState<LibraryTab>("references");
 const [query, setQuery] = useState("");
 const [siteFilter, setSiteFilter] = useState("all");
 const [typeFilter, setTypeFilter] = useState("all");
 const [techCategoryFilter, setTechCategoryFilter] = useState("all");
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [message, setMessage] = useState("");
 const [intakeOpen, setIntakeOpen] = useState(false);
 const [techniqueOpen, setTechniqueOpen] = useState(false);
 const [editingTechnique, setEditingTechnique] = useState<Technique | null>(null);
 const [savingTechnique, setSavingTechnique] = useState(false);

 async function load(showLoading = true) {
  if (showLoading) setLoading(true);
  setError("");
  const [siteResult, assetResult, documentResult, versionResult, techniqueResult] = await Promise.all([
   supabase!.from("sites").select("id,name,state,timezone").order("name"),
   supabase!.from("assets").select("id,site_id,name,asset_tag").order("name"),
   supabase!.from("documents").select("id,site_id,asset_id,name,document_type,description,storage_path,source_system,source_reference,created_at").not("site_id", "is", null).order("created_at", { ascending: false }),
   supabase!.from("document_versions").select("id,document_id,version_label,storage_path,file_size_bytes,revision_date,created_at").order("created_at", { ascending: false }),
   supabase!.from("maintenance_techniques").select("id,site_id,asset_id,title,category,interval,safety_notes,tools,procedure_steps,measurement_specs,torque_specs,belt_tension,source_document_id,source_reference,source_page,created_at,updated_at").order("updated_at", { ascending: false })
  ]);
  const firstError = siteResult.error || assetResult.error || documentResult.error || versionResult.error || techniqueResult.error;
  if (firstError) setError(firstError.message);
  else {
   setSites((siteResult.data || []) as Site[]);
   setAssets((assetResult.data || []) as Asset[]);
   setDocuments((documentResult.data || []) as LibraryDocument[]);
   setVersions((versionResult.data || []) as LibraryVersion[]);
   setTechniques((techniqueResult.data || []) as Technique[]);
  }
  setLoading(false);
 }
 useEffect(() => { void load(); }, []);

 const latestVersion = (documentId: string) => versions.find(version => version.document_id === documentId);
 const filteredDocuments = useMemo(() => documents.filter(document => {
  const matchesSite = siteFilter === "all" || document.site_id === siteFilter;
  const matchesType = typeFilter === "all" || document.document_type === typeFilter;
  const site = sites.find(item => item.id === document.site_id)?.name || "";
  const asset = assets.find(item => item.id === document.asset_id)?.name || "";
  const searchable = [document.name, document.document_type, document.description || "", document.source_system || "", document.source_reference || "", site, asset].join(" ").toLowerCase();
  return matchesSite && matchesType && searchable.includes(query.trim().toLowerCase());
 }), [documents, sites, assets, siteFilter, typeFilter, query]);
 const filteredTechniques = useMemo(() => techniques.filter(technique => {
  const matchesSite = siteFilter === "all" || technique.site_id === siteFilter;
  const matchesCategory = techCategoryFilter === "all" || technique.category === techCategoryFilter;
  const site = sites.find(item => item.id === technique.site_id)?.name || "";
  const asset = assets.find(item => item.id === technique.asset_id)?.name || "";
  const searchable = [
   technique.title, technique.category, technique.interval || "", technique.tools || "", technique.safety_notes || "",
   technique.source_reference || "", site, asset, ...technique.procedure_steps,
   ...technique.measurement_specs.flatMap(item => [item.name, item.target, item.unit, item.method]),
   ...technique.torque_specs.flatMap(item => [item.fastener, item.value, item.unit, item.notes]),
   technique.belt_tension?.belt_type || "", technique.belt_tension?.target || "", technique.belt_tension?.notes || ""
  ].join(" ").toLowerCase();
  return matchesSite && matchesCategory && searchable.includes(query.trim().toLowerCase());
 }), [techniques, sites, assets, siteFilter, techCategoryFilter, query]);

 async function openDocument(document: LibraryDocument) {
  setError("");
  const path = latestVersion(document.id)?.storage_path || document.storage_path;
  if (path) {
   const result = await supabase!.storage.from(LIBRARY_BUCKET).createSignedUrl(path, 3600);
   if (result.error || !result.data) { setError(result.error?.message || "Could not create a secure file link."); return; }
   window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
   return;
  }
  const url = toHttpUrl(document.source_reference);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
  else setError("This reference has no attached file or web link.");
 }

 async function addRevision(document: LibraryDocument, file: File) {
  setError(""); setMessage("");
  const user = await supabase!.auth.getUser();
  if (user.error || !user.data.user) { setError(user.error?.message || "Your session could not be confirmed."); return; }
  const safeName = file.name.replace(/[\\/]+/g, "_").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = document.site_id + "/" + document.id + "/" + crypto.randomUUID() + "-" + safeName;
  const uploaded = await supabase!.storage.from(LIBRARY_BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploaded.error) { setError(uploaded.error.message); return; }
  const previous = latestVersion(document.id);
  const revision = await supabase!.from("document_versions").insert({
   document_id: document.id, version_label: String((Number(previous?.version_label) || 0) + 1),
   storage_path: path, file_size_bytes: file.size, uploaded_by: user.data.user.id
  });
  if (revision.error) {
   await supabase!.storage.from(LIBRARY_BUCKET).remove([path]);
   setError(revision.error.message);
   return;
  }
  setMessage("A new revision was added to " + document.name + ".");
  await load(false);
 }

 async function saveTechnique(draft: TechniqueDraft, id?: string) {
  setError(""); setMessage(""); setSavingTechnique(true);
  const auth = await supabase!.auth.getUser();
  if (auth.error || !auth.data.user) { setError(auth.error?.message || "Your session could not be confirmed."); setSavingTechnique(false); return; }
  const measurements = draft.measurements.filter(item => item.name.trim() || item.target.trim()).map(item => ({
   name: item.name.trim(), target: item.target.trim(), unit: item.unit.trim(), method: item.method.trim()
  }));
  const torque = draft.torque.filter(item => item.fastener.trim() || item.value.trim()).map(item => ({
   fastener: item.fastener.trim(), value: item.value.trim(), unit: item.unit.trim(), notes: item.notes.trim()
  }));
  const belt = Object.values(draft.belt).some(value => value.trim()) ? {
   belt_type: draft.belt.belt_type.trim(), method: draft.belt.method.trim(), target: draft.belt.target.trim(),
   unit: draft.belt.unit.trim(), span_length: draft.belt.span_length.trim(), notes: draft.belt.notes.trim()
  } : null;
  const payload = {
   site_id: draft.site_id, asset_id: draft.asset_id || null, title: draft.title.trim(), category: draft.category,
   interval: draft.interval.trim() || null, safety_notes: draft.safety_notes.trim() || null, tools: draft.tools.trim() || null,
   procedure_steps: draft.steps.split(/\r?\n/).map(step => step.trim()).filter(Boolean),
   measurement_specs: measurements, torque_specs: torque, belt_tension: belt,
   source_document_id: draft.source_document_id || null, source_reference: draft.source_reference.trim() || null,
   source_page: draft.source_page.trim() || null,
   ...(id ? {} : { created_by: auth.data.user.id }), updated_at: new Date().toISOString()
  };
  const result = id
   ? await supabase!.from("maintenance_techniques").update(payload).eq("id", id)
   : await supabase!.from("maintenance_techniques").insert(payload);
  if (result.error) setError(result.error.message);
  else {
   setMessage(id ? "Maintenance technique updated." : "Maintenance technique saved to the library.");
   setTechniqueOpen(false); setEditingTechnique(null); await load(false);
  }
  setSavingTechnique(false);
 }

 function editTechnique(technique: Technique) {
  setEditingTechnique(technique);
  setTechniqueOpen(true);
 }

 const tabItems: { id: LibraryTab; label: string; count?: number }[] = [
  { id: "references", label: "References", count: documents.length },
  { id: "techniques", label: "Maintenance techniques", count: techniques.length },
  { id: "calculators", label: "Calculators" }
 ];

 return <div className="technical-library">
  <div className="hero library-hero">
   <div><p className="eyebrow">ENGINEERING REFERENCES</p><h1>Technical Library</h1><p className="muted">A shared reference desk for manuals, prints, procedures, maintenance settings, and calculations.</p></div>
   {tab === "references" ? <button type="button" className="primary library-top-action" onClick={() => { setMessage(""); setError(""); setIntakeOpen(true); }}><FilePlus2 size={16}/> Import reference</button> :
    tab === "techniques" ? <button type="button" className="primary library-top-action" onClick={() => { setEditingTechnique(null); setError(""); setTechniqueOpen(true); }}><Plus size={16}/> Add technique</button> : null}
  </div>
  {error && <div className="notice error wide">{error}</div>}
  {message && <div className="notice wide">{message}</div>}
  <div className="library-tabs" role="tablist" aria-label="Technical Library sections">
   {tabItems.map(item => <button type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "library-tab active" : "library-tab"} key={item.id} onClick={() => { setTab(item.id); setError(""); setMessage(""); }}>
    {item.label}{item.count !== undefined && <span>{item.count}</span>}
   </button>)}
  </div>

  {tab !== "calculators" && <div className="library-filterbar">
   <label className="library-search"><BookOpen size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === "references" ? "Search manuals, prints, sources, equipment…" : "Search procedures, specs, tools, equipment…"}/></label>
   <select aria-label="Filter by site" value={siteFilter} onChange={event => setSiteFilter(event.target.value)}><option value="all">All sites</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select>
   {tab === "references" ? <select aria-label="Filter by reference type" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">All types</option>{LIBRARY_TYPES.map(type => <option key={type} value={type}>{label(type)}</option>)}</select> :
    <select aria-label="Filter by technique category" value={techCategoryFilter} onChange={event => setTechCategoryFilter(event.target.value)}><option value="all">All categories</option>{TECHNIQUE_CATEGORIES.map(category => <option key={category} value={category}>{label(category)}</option>)}</select>}
   <span className="library-result-count">{loading ? "Loading…" : tab === "references" ? filteredDocuments.length + " reference" + (filteredDocuments.length === 1 ? "" : "s") : filteredTechniques.length + " technique" + (filteredTechniques.length === 1 ? "" : "s")}</span>
  </div>}

  {tab === "references" && <section className="panel library-catalog library-catalog-primary">
   <div className="panel-head"><div><h2>Reference catalog</h2><p>Site and equipment-linked manuals, drawings, web sources, and reliability notes</p></div><BookOpen size={19}/></div>
   {loading ? <div className="empty">Loading references…</div> : filteredDocuments.length ? <div className="reference-list">{filteredDocuments.map(document => {
    const site = sites.find(item => item.id === document.site_id);
    const asset = assets.find(item => item.id === document.asset_id);
    const version = latestVersion(document.id);
    const hasFile = Boolean(version?.storage_path || document.storage_path);
    const hasUrl = Boolean(toHttpUrl(document.source_reference));
    return <article className="reference-item" key={document.id}>
     <div className="reference-icon">{hasFile ? <FileText size={19}/> : hasUrl ? <Link2 size={19}/> : <BookOpen size={19}/>}</div>
     <div className="reference-main">
      <div className="reference-titleline"><span className="tag">{label(document.document_type)}</span><h3>{document.name}</h3></div>
      <p>{document.description || "No summary added."}</p>
      <small>{[site?.name, asset?.name || "Site-wide", document.source_system || "Source not recorded", document.source_reference || "", version ? "Rev " + version.version_label : ""].filter(Boolean).join(" · ")}</small>
     </div>
     <div className="reference-actions">
      <button type="button" className="secondary" disabled={!hasFile && !hasUrl} onClick={() => void openDocument(document)}>{hasFile ? <><ExternalLink size={14}/> Open file</> : hasUrl ? <><ExternalLink size={14}/> Open source</> : "No file"}</button>
      <label className="upload-btn"><RefreshCw size={14}/> Add revision<input type="file" onChange={event => { const file = event.target.files?.[0]; if (file) void addRevision(document, file); event.currentTarget.value = ""; }}/></label>
     </div>
    </article>;
   })}</div> : <div className="library-empty"><div className="library-empty-icon"><BookOpen size={24}/></div><h3>No references match yet</h3><p>Import a manual or print, save an external source link, or add a technical note. Link each record to a site and optional asset.</p><button type="button" className="primary" onClick={() => setIntakeOpen(true)}><FilePlus2 size={15}/> Import first reference</button></div>}
  </section>}

  {tab === "techniques" && <section className="panel library-catalog library-catalog-primary">
   <div className="panel-head"><div><h2>Maintenance techniques</h2><p>Step-by-step procedures with sourced torque, tension, and measurement targets</p></div><Wrench size={19}/></div>
   {loading ? <div className="empty">Loading techniques…</div> : filteredTechniques.length ? <div className="technique-list">{filteredTechniques.map(technique => <TechniqueCard key={technique.id} technique={technique} site={sites.find(site => site.id === technique.site_id)} asset={assets.find(asset => asset.id === technique.asset_id)} source={documents.find(document => document.id === technique.source_document_id)} onEdit={() => editTechnique(technique)} onOpenSource={() => {
    const linked = documents.find(document => document.id === technique.source_document_id);
    if (linked) void openDocument(linked);
    else { const url = toHttpUrl(technique.source_reference); if (url) window.open(url, "_blank", "noopener,noreferrer"); }
   }}/>)}</div> : <div className="library-empty"><div className="library-empty-icon"><Wrench size={24}/></div><h3>No maintenance techniques match yet</h3><p>Record a manufacturer-backed method, its tools and steps, measurements, torque settings, and belt tension guidance.</p><button type="button" className="primary" onClick={() => { setEditingTechnique(null); setTechniqueOpen(true); }}><Plus size={15}/> Add a technique</button></div>}
  </section>}

  {tab === "calculators" && <div className="calculator-workspace">
   <section className="panel calculator-panel"><div className="panel-head"><div><h2>Torque converter</h2><p>Convert an existing torque specification between common units.</p></div><Gauge size={19}/></div><TorqueConverter/><p className="calculator-caution">Conversion only: this does not recommend or calculate a fastener tightening value. Use the current equipment or fastener specification.</p><a className="source-link" href={NIST_TORQUE} target="_blank" rel="noreferrer">NIST torque conversion factors <ExternalLink size={13}/></a></section>
   <section className="panel calculator-panel"><div className="panel-head"><div><h2>Belt span tension</h2><p>Convert between a measured vibration frequency and its ideal string-model tension.</p></div><Activity size={19}/></div><BeltCalculator/><p className="calculator-caution">This is an estimate, not a target-tension selector. Belt stiffness and the maker’s method affect readings. Confirm target values in the belt/drive maker’s current guidance.</p><a className="source-link" href={GATES_MANUAL} target="_blank" rel="noreferrer">Gates Sonic Tension Meter manual <ExternalLink size={13}/></a></section>
   <section className="panel calculator-panel measurement-calculator"><div className="panel-head"><div><h2>Measurement converter</h2><p>Convert common field measurements without changing the stored source value.</p></div><Calculator size={19}/></div><MeasurementConverter/><a className="source-link" href="https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors" target="_blank" rel="noreferrer">NIST SI conversion factors <ExternalLink size={13}/></a></section>
  </div>}

  {intakeOpen && <ReferenceEditor sites={sites} assets={assets} onClose={() => setIntakeOpen(false)} onSaved={async () => { setIntakeOpen(false); setTab("references"); setMessage("Reference added to the Technical Library."); await load(false); }}/>}
  {techniqueOpen && <TechniqueEditor sites={sites} assets={assets} documents={documents} existing={editingTechnique} saving={savingTechnique} onClose={() => { setTechniqueOpen(false); setEditingTechnique(null); }} onSave={draft => saveTechnique(draft, editingTechnique?.id)}/>}
 </div>;
}

function ReferenceEditor({ sites, assets, onClose, onSaved }: { sites: Site[]; assets: Asset[]; onClose: () => void; onSaved: () => Promise<void> }) {
 const [kind, setKind] = useState<IntakeKind>("file");
 const [file, setFile] = useState<File | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const [form, setForm] = useState({ site_id: "", asset_id: "", name: "", document_type: "manual", source_system: "", source_reference: "", version_label: "1", revision_date: "", description: "" });
 const set = (key: string, value: string) => setForm(previous => ({ ...previous, [key]: value }));
 async function submit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError("");
  if (!form.site_id) { setError("Select a site."); return; }
  if (kind === "file" && !file) { setError("Choose the file to import."); return; }
  if (kind === "link" && !toHttpUrl(form.source_reference)) { setError("Enter a complete http or https source URL."); return; }
  setBusy(true);
  const auth = await supabase!.auth.getUser();
  if (auth.error || !auth.data.user) { setError(auth.error?.message || "Your session could not be confirmed."); setBusy(false); return; }
  const documentId = crypto.randomUUID();
  let path: string | null = null;
  if (file) {
   const safeName = file.name.replace(/[\\/]+/g, "_").replace(/[^a-zA-Z0-9._-]+/g, "_");
   path = form.site_id + "/" + documentId + "/" + safeName;
   const uploaded = await supabase!.storage.from(LIBRARY_BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
   if (uploaded.error) { setError(uploaded.error.message); setBusy(false); return; }
  }
  const result = await supabase!.from("documents").insert({
   id: documentId, site_id: form.site_id, asset_id: form.asset_id || null, name: form.name.trim(),
   document_type: form.document_type, description: form.description.trim() || null, storage_path: path,
   source_system: form.source_system.trim() || null, source_reference: form.source_reference.trim() || null,
   created_by: auth.data.user.id
  }).select("id").single();
  if (result.error) {
   if (path) await supabase!.storage.from(LIBRARY_BUCKET).remove([path]);
   setError(result.error.message); setBusy(false); return;
  }
  if (file && path) {
   const version = await supabase!.from("document_versions").insert({
    document_id: documentId, version_label: form.version_label.trim() || "1", storage_path: path,
    file_size_bytes: file.size, revision_date: form.revision_date || null, uploaded_by: auth.data.user.id
   });
   if (version.error) {
    setError("The reference was saved, but its version record failed: " + version.error.message);
    setBusy(false); await onSaved(); return;
   }
  }
  setBusy(false); await onSaved();
 }
 return <div className="library-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
  <section className="panel library-modal" role="dialog" aria-modal="true" aria-labelledby="reference-editor-title">
   <div className="panel-head"><div><h2 id="reference-editor-title">Import a reference</h2><p>Attach a file, source link, or written technical note to a site.</p></div><button type="button" className="icon" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
   <div className="intake-kind-picker" role="tablist" aria-label="Reference type">
    <button type="button" className={kind === "file" ? "active" : ""} onClick={() => setKind("file")}><Upload size={15}/> File</button>
    <button type="button" className={kind === "link" ? "active" : ""} onClick={() => setKind("link")}><Link2 size={15}/> Web source</button>
    <button type="button" className={kind === "note" ? "active" : ""} onClick={() => setKind("note")}><FileText size={15}/> Technical note</button>
   </div>
   <form className="library-editor-form" onSubmit={submit}>
    <div className="form-grid">
     <label>Site<select value={form.site_id} onChange={event => { set("site_id", event.target.value); set("asset_id", ""); }} required><option value="">Choose a site</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name} · {site.state || "State not set"}</option>)}</select></label>
     <label>Asset (optional)<select value={form.asset_id} onChange={event => set("asset_id", event.target.value)}><option value="">Site-wide reference</option>{assets.filter(asset => asset.site_id === form.site_id).map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.asset_tag}</option>)}</select></label>
    </div>
    <label>Reference name<input value={form.name} onChange={event => set("name", event.target.value)} required placeholder={file?.name || "e.g. Pump overhaul instructions"}/></label>
    <div className="form-grid">
     <label>Type<select value={form.document_type} onChange={event => set("document_type", event.target.value)}>{LIBRARY_TYPES.map(type => <option key={type} value={type}>{label(type)}</option>)}</select></label>
     <label>Source or manufacturer<input value={form.source_system} onChange={event => set("source_system", event.target.value)} placeholder="OEM, API, SMRP, internal standard…"/></label>
    </div>
    <label>{kind === "link" ? "Source URL" : "Source URL, document number, or reference"}<input type={kind === "link" ? "url" : "text"} value={form.source_reference} onChange={event => set("source_reference", event.target.value)} required={kind === "link"} placeholder={kind === "link" ? "https://…" : "Document number or optional URL"}/></label>
    {kind === "file" && <div className="form-grid"><label>Revision<input value={form.version_label} onChange={event => set("version_label", event.target.value)} placeholder="A, 1, Rev 2…"/></label><label>Revision date<input type="date" value={form.revision_date} onChange={event => set("revision_date", event.target.value)}/></label></div>}
    <label>Summary or technical information<textarea rows={kind === "note" ? 7 : 4} value={form.description} onChange={event => set("description", event.target.value)} placeholder={kind === "note" ? "Record the reliability information and its context…" : "Coverage, equipment applicability, or source notes"}/></label>
    {kind === "file" && <label className="library-file-picker"><span>Choose a file {file && <b>{file.name}</b>}</span><input type="file" onChange={event => setFile(event.target.files?.[0] || null)} required/></label>}
    {error && <div className="notice error">{error}</div>}
    <div className="library-modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={busy || !sites.length}>{busy ? "Saving…" : "Save reference"}</button></div>
   </form>
  </section>
 </div>;
}

function TechniqueEditor({ sites, assets, documents, existing, saving, onClose, onSave }: {
 sites: Site[]; assets: Asset[]; documents: LibraryDocument[]; existing: Technique | null; saving: boolean;
 onClose: () => void; onSave: (draft: TechniqueDraft) => void;
}) {
 const [draft, setDraft] = useState<TechniqueDraft>(() => existing ? toDraft(existing) : emptyDraft());
 const set = (key: keyof TechniqueDraft, value: any) => setDraft(previous => ({ ...previous, [key]: value }));
 const setMeasurement = (index: number, key: keyof MeasurementSpec, value: string) => setDraft(previous => ({ ...previous, measurements: previous.measurements.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row) }));
 const setTorque = (index: number, key: keyof TorqueSpec, value: string) => setDraft(previous => ({ ...previous, torque: previous.torque.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row) }));
 const setBelt = (key: keyof BeltTension, value: string) => setDraft(previous => ({ ...previous, belt: { ...previous.belt, [key]: value } }));
 const selectedDocuments = documents.filter(document => document.site_id === draft.site_id);
 return <div className="library-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
  <section className="panel technique-modal" role="dialog" aria-modal="true" aria-labelledby="technique-editor-title">
   <div className="panel-head"><div><h2 id="technique-editor-title">{existing ? "Edit maintenance technique" : "Add maintenance technique"}</h2><p>Record the method, acceptance measurements, and source for the selected equipment.</p></div><button type="button" className="icon" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
   <div className="technique-safety-banner"><ShieldCheck size={17}/><span>Use torque, belt tension, and measurement targets from the current equipment maker or approved engineering reference. Saved values are not independently validated.</span></div>
   <form className="technique-editor-form" onSubmit={event => { event.preventDefault(); onSave(draft); }}>
    <div className="form-grid">
     <label>Site<select value={draft.site_id} onChange={event => { set("site_id", event.target.value); set("asset_id", ""); set("source_document_id", ""); }} required><option value="">Choose a site</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
     <label>Asset (optional)<select value={draft.asset_id} onChange={event => set("asset_id", event.target.value)}><option value="">Site-wide technique</option>{assets.filter(asset => asset.site_id === draft.site_id).map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.asset_tag}</option>)}</select></label>
    </div>
    <div className="form-grid">
     <label>Technique title<input value={draft.title} onChange={event => set("title", event.target.value)} required placeholder="e.g. Inspect and tension drive belt"/></label>
     <label>Category<select value={draft.category} onChange={event => set("category", event.target.value)}>{TECHNIQUE_CATEGORIES.map(category => <option key={category} value={category}>{label(category)}</option>)}</select></label>
    </div>
    <div className="form-grid"><label>Maintenance interval<input value={draft.interval} onChange={event => set("interval", event.target.value)} placeholder="e.g. Every 2,000 operating hours"/></label><label>Tools and equipment<input value={draft.tools} onChange={event => set("tools", event.target.value)} placeholder="Torque wrench, tension meter…"/></label></div>
    <label>Safety precautions<textarea rows={3} value={draft.safety_notes} onChange={event => set("safety_notes", event.target.value)} placeholder="Isolation, PPE, stored energy, and site-specific steps"/></label>
    <label>Procedure steps<textarea rows={6} value={draft.steps} onChange={event => set("steps", event.target.value)} placeholder={"One step per line\n1. Isolate and verify the equipment\n2. Inspect the belt and pulleys"} /></label>

    <div className="technique-editor-section">
     <div className="technique-editor-section-head"><div><h3>Measurement targets</h3><p>Record limits, units, and measurement method.</p></div><button type="button" className="secondary" onClick={() => set("measurements", [...draft.measurements, newMeasurement()])}><Plus size={14}/> Add measurement</button></div>
     {draft.measurements.map((row, index) => <div className="technique-spec-row" key={"measurement-" + index}>
      <label>Parameter<input value={row.name} onChange={event => setMeasurement(index, "name", event.target.value)} placeholder="Shaft runout"/></label>
      <label>Target or range<input value={row.target} onChange={event => setMeasurement(index, "target", event.target.value)} placeholder="≤ 0.05"/></label>
      <label>Unit<input value={row.unit} onChange={event => setMeasurement(index, "unit", event.target.value)} placeholder="mm"/></label>
      <label>Method<input value={row.method} onChange={event => setMeasurement(index, "method", event.target.value)} placeholder="Dial indicator at coupling"/></label>
      {draft.measurements.length > 1 && <button type="button" className="icon technique-remove-row" aria-label="Remove measurement" onClick={() => set("measurements", draft.measurements.filter((_, rowIndex) => rowIndex !== index))}><X size={15}/></button>}
     </div>)}
    </div>

    <div className="technique-editor-section">
     <div className="technique-editor-section-head"><div><h3>Torque specifications</h3><p>Enter the published value and the exact location/fastener.</p></div><button type="button" className="secondary" onClick={() => set("torque", [...draft.torque, newTorque()])}><Plus size={14}/> Add torque spec</button></div>
     {draft.torque.map((row, index) => <div className="technique-spec-row torque-spec-row" key={"torque-" + index}>
      <label>Fastener or location<input value={row.fastener} onChange={event => setTorque(index, "fastener", event.target.value)} placeholder="Bearing housing bolts"/></label>
      <label>Torque value<input value={row.value} onChange={event => setTorque(index, "value", event.target.value)} placeholder="85"/></label>
      <label>Units<select value={row.unit} onChange={event => setTorque(index, "unit", event.target.value)}><option>N·m</option><option>lbf·ft</option><option>lbf·in</option><option>kgf·m</option></select></label>
      <label>Application notes<input value={row.notes} onChange={event => setTorque(index, "notes", event.target.value)} placeholder="Lubricated threads, sequence…"/></label>
      {draft.torque.length > 1 && <button type="button" className="icon technique-remove-row" aria-label="Remove torque specification" onClick={() => set("torque", draft.torque.filter((_, rowIndex) => rowIndex !== index))}><X size={15}/></button>}
     </div>)}
    </div>

    <div className="technique-editor-section">
     <div className="technique-editor-section-head"><div><h3>Belt tension</h3><p>Keep the method and source alongside the target or range.</p></div><Activity size={17}/></div>
     <div className="form-grid">
      <label>Belt type<input value={draft.belt.belt_type} onChange={event => setBelt("belt_type", event.target.value)} placeholder="V-belt, synchronous, Poly Chain…"/></label>
      <label>Measurement method<input value={draft.belt.method} onChange={event => setBelt("method", event.target.value)} placeholder="Frequency, force gauge, maker chart…"/></label>
      <label>Target or range<input value={draft.belt.target} onChange={event => setBelt("target", event.target.value)} placeholder="e.g. 35–42"/></label>
      <label>Units<input value={draft.belt.unit} onChange={event => setBelt("unit", event.target.value)} placeholder="Hz, N, lbf, mm deflection…"/></label>
      <label>Free span length<input value={draft.belt.span_length} onChange={event => setBelt("span_length", event.target.value)} placeholder="Optional; include units"/></label>
      <label>Notes<input value={draft.belt.notes} onChange={event => setBelt("notes", event.target.value)} placeholder="Cold belt, per strand, retension after run-in…"/></label>
     </div>
    </div>

    <div className="technique-editor-section">
     <div className="technique-editor-section-head"><div><h3>Source and review trail</h3><p>Link the manual, print, standard, or source information.</p></div><Link2 size={17}/></div>
     <div className="form-grid">
      <label>Technical Library reference<select value={draft.source_document_id} onChange={event => set("source_document_id", event.target.value)}><option value="">No linked reference</option>{selectedDocuments.map(document => <option key={document.id} value={document.id}>{document.name}</option>)}</select></label>
      <label>Source page or section<input value={draft.source_page} onChange={event => set("source_page", event.target.value)} placeholder="Page 42, Table 3, §5.2…"/></label>
     </div>
     <label>External source URL or document number<input value={draft.source_reference} onChange={event => set("source_reference", event.target.value)} placeholder="OEM URL, standard number, Maximo WO, etc."/></label>
    </div>

    <div className="library-modal-actions"><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving || !draft.site_id}>{saving ? "Saving…" : existing ? "Save changes" : "Save technique"}</button></div>
   </form>
  </section>
 </div>;
}

function TechniqueCard({ technique, site, asset, source, onEdit, onOpenSource }: { technique: Technique; site?: Site; asset?: Asset; source?: LibraryDocument; onEdit: () => void; onOpenSource: () => void }) {
 const hasSource = Boolean(source || toHttpUrl(technique.source_reference));
 return <article className="technique-card">
  <div className="technique-card-head">
   <div className="technique-card-title"><span className="tag">{label(technique.category)}</span><h3>{technique.title}</h3><small>{[site?.name, asset?.name || "Site-wide", technique.interval].filter(Boolean).join(" · ")}</small></div>
   <div className="technique-card-actions"><span className={hasSource ? "source-status sourced" : "source-status"}>{hasSource ? "Source linked" : "Source needed"}</span><button type="button" className="secondary" onClick={onEdit}>Edit</button></div>
  </div>
  {!hasSource && <div className="technique-unsourced-note">Add the current manufacturer or engineering reference before treating recorded settings as approved values.</div>}
  {technique.safety_notes && <div className="technique-safety-note"><ShieldCheck size={15}/><span>{technique.safety_notes}</span></div>}
  {technique.tools && <p className="technique-meta"><b>Tools:</b> {technique.tools}</p>}
  {technique.procedure_steps.length > 0 && <details className="technique-detail-section"><summary>Procedure <span>{technique.procedure_steps.length} steps</span><ChevronDown size={15}/></summary><ol>{technique.procedure_steps.map((step, index) => <li key={index}>{step}</li>)}</ol></details>}
  {technique.measurement_specs.length > 0 && <details className="technique-detail-section"><summary>Measurements <span>{technique.measurement_specs.length} targets</span><ChevronDown size={15}/></summary><div className="technique-spec-list">{technique.measurement_specs.map((item, index) => <div className="technique-spec-item" key={index}><b>{item.name || "Measurement"}</b><span>{[item.target, item.unit].filter(Boolean).join(" ") || "Target not set"}</span><small>{item.method}</small></div>)}</div></details>}
  {technique.torque_specs.length > 0 && <details className="technique-detail-section"><summary>Torque specifications <span>{technique.torque_specs.length} settings</span><ChevronDown size={15}/></summary><div className="technique-spec-list">{technique.torque_specs.map((item, index) => <div className="technique-spec-item" key={index}><b>{item.fastener || "Fastener or location"}</b><span>{[item.value, item.unit].filter(Boolean).join(" ") || "Value not set"}</span><small>{item.notes}</small></div>)}</div></details>}
  {technique.belt_tension && <details className="technique-detail-section"><summary>Belt tension <span>{technique.belt_tension.target || "Target not set"} {technique.belt_tension.unit}</span><ChevronDown size={15}/></summary><div className="technique-spec-list"><div className="technique-spec-item"><b>{technique.belt_tension.belt_type || "Belt type not set"}</b><span>{[technique.belt_tension.method, technique.belt_tension.span_length ? "Span " + technique.belt_tension.span_length : ""].filter(Boolean).join(" · ")}</span><small>{technique.belt_tension.notes}</small></div></div></details>}
  <div className="technique-source-row"><span><Link2 size={14}/>{source?.name || technique.source_reference || "No source attached"}</span>{hasSource && <button type="button" className="text-btn" onClick={onOpenSource}>{source ? "Open reference" : "Open source"} <ChevronRight size={14}/></button>}</div>
 </article>;
}

function TorqueConverter() {
 const [value, setValue] = useState("100");
 const [unit, setUnit] = useState("N·m");
 const factors: Record<string, number> = { "N·m": 1, "lbf·ft": 1.355818, "lbf·in": 0.1129848 };
 const numeric = Number(value);
 const nM = Number.isFinite(numeric) ? numeric * factors[unit] : NaN;
 return <div className="calculator-input-stack">
  <div className="form-grid"><label>Value<input type="number" inputMode="decimal" value={value} onChange={event => setValue(event.target.value)}/></label><label>Input units<select value={unit} onChange={event => setUnit(event.target.value)}>{Object.keys(factors).map(item => <option key={item}>{item}</option>)}</select></label></div>
  <div className="calculator-results">
   <div><span>Newton meters</span><b>{formatNumber(nM)} N·m</b></div>
   <div><span>Pound-force feet</span><b>{formatNumber(nM / factors["lbf·ft"])} lbf·ft</b></div>
   <div><span>Pound-force inches</span><b>{formatNumber(nM / factors["lbf·in"])} lbf·in</b></div>
  </div>
 </div>;
}

function BeltCalculator() {
 const [mode, setMode] = useState<"tension" | "frequency">("tension");
 const [mass, setMass] = useState("35");
 const [span, setSpan] = useState("500");
 const [frequency, setFrequency] = useState("60");
 const [target, setTarget] = useState("250");
 const [targetUnit, setTargetUnit] = useState("N");
 const [centerDistance, setCenterDistance] = useState("");
 const [largePulley, setLargePulley] = useState("");
 const [smallPulley, setSmallPulley] = useState("");
 const massValue = Number(mass), spanValue = Number(span);
 const f = Number(frequency), targetValue = Number(target);
 const tensionN = mode === "tension" && massValue > 0 && spanValue > 0 && f > 0 ? 4 * massValue * spanValue * spanValue * f * f * 1e-9 : NaN;
 const targetN = targetUnit === "lbf" ? targetValue * 4.448222 : targetValue;
 const targetHz = mode === "frequency" && massValue > 0 && spanValue > 0 && targetN > 0 ? Math.sqrt(targetN * 1e9 / (4 * massValue * spanValue * spanValue)) : NaN;
 const cd = Number(centerDistance), big = Number(largePulley), small = Number(smallPulley);
 const calculatedSpan = cd > 0 && big > 0 && small > 0 && cd * cd > (big - small) * (big - small) ? Math.sqrt((cd * cd - (big - small) * (big - small)) / 4) : NaN;
 return <div className="belt-calculator">
  <div className="calculator-mode" role="tablist" aria-label="Belt calculation"><button type="button" className={mode === "tension" ? "active" : ""} onClick={() => setMode("tension")}>Frequency → tension</button><button type="button" className={mode === "frequency" ? "active" : ""} onClick={() => setMode("frequency")}>Target tension → frequency</button></div>
  <div className="form-grid"><label>Linear mass per belt span (g/m)<input type="number" min="0" step="any" value={mass} onChange={event => setMass(event.target.value)}/><small>Use the belt maker’s mass constant for this belt.</small></label><label>Free span length (mm)<input type="number" min="0" step="any" value={span} onChange={event => setSpan(event.target.value)}/></label></div>
  {mode === "tension" ? <label>Measured natural frequency (Hz)<input type="number" min="0" step="any" value={frequency} onChange={event => setFrequency(event.target.value)}/></label> : <div className="form-grid"><label>Target tension<input type="number" min="0" step="any" value={target} onChange={event => setTarget(event.target.value)}/></label><label>Target units<select value={targetUnit} onChange={event => setTargetUnit(event.target.value)}><option>N</option><option>lbf</option></select></label></div>}
  {mode === "tension" ? <div className="calculator-result-large"><span>Estimated ideal-string tension, per belt</span><b>{formatNumber(tensionN)} N <small>({formatNumber(tensionN / 4.448222)} lbf)</small></b></div> : <div className="calculator-result-large"><span>Estimated natural frequency for entered tension</span><b>{formatNumber(targetHz)} Hz</b></div>}
  <details className="span-calculator"><summary>Calculate free span from pulley dimensions <ChevronDown size={14}/></summary><div className="form-grid"><label>Center distance (mm)<input type="number" min="0" step="any" value={centerDistance} onChange={event => setCenterDistance(event.target.value)}/></label><label>Large pulley diameter (mm)<input type="number" min="0" step="any" value={largePulley} onChange={event => setLargePulley(event.target.value)}/></label><label>Small pulley diameter (mm)<input type="number" min="0" step="any" value={smallPulley} onChange={event => setSmallPulley(event.target.value)}/></label></div><div className="span-result">Calculated span: <b>{formatNumber(calculatedSpan)} mm</b><button type="button" className="text-btn" disabled={!Number.isFinite(calculatedSpan)} onClick={() => setSpan(String(Number(calculatedSpan.toFixed(2))))}>Use span</button></div></details>
  <div className="formula-note"><b>Model:</b> T = 4 × m × L² × f², with mass in g/m and span in mm (converted to N). A single span is calculated; use the right belt mass and maker procedure.</div>
 </div>;
}

const MEASUREMENT_UNITS: Record<string, { unit: string; factor: number }[]> = {
 length: [{ unit: "mm", factor: .001 }, { unit: "cm", factor: .01 }, { unit: "m", factor: 1 }, { unit: "in", factor: .0254 }, { unit: "ft", factor: .3048 }],
 pressure: [{ unit: "kPa", factor: 1 }, { unit: "bar", factor: 100 }, { unit: "psi", factor: 6.894757 }, { unit: "MPa", factor: 1000 }],
 force: [{ unit: "N", factor: 1 }, { unit: "kN", factor: 1000 }, { unit: "lbf", factor: 4.448222 }]
};
function MeasurementConverter() {
 const [category, setCategory] = useState("length");
 const [value, setValue] = useState("25.4");
 const [from, setFrom] = useState("mm");
 const [to, setTo] = useState("in");
 const units = category === "temperature" ? ["°C", "°F"] : MEASUREMENT_UNITS[category].map(item => item.unit);
 function changeCategory(next: string) {
  setCategory(next);
  const nextUnits = next === "temperature" ? ["°C", "°F"] : MEASUREMENT_UNITS[next].map(item => item.unit);
  setFrom(nextUnits[0]); setTo(nextUnits[1] || nextUnits[0]);
 }
 const numeric = Number(value);
 let result = NaN;
 if (Number.isFinite(numeric)) {
  if (category === "temperature") {
   const celsius = from === "°F" ? (numeric - 32) * 5 / 9 : numeric;
   result = to === "°F" ? celsius * 9 / 5 + 32 : celsius;
  } else {
   const sourceFactor = MEASUREMENT_UNITS[category].find(item => item.unit === from)?.factor || 1;
   const targetFactor = MEASUREMENT_UNITS[category].find(item => item.unit === to)?.factor || 1;
   result = numeric * sourceFactor / targetFactor;
  }
 }
 return <div className="calculator-input-stack">
  <div className="form-grid"><label>Measurement<select value={category} onChange={event => changeCategory(event.target.value)}><option value="length">Length</option><option value="pressure">Pressure</option><option value="force">Force</option><option value="temperature">Temperature</option></select></label><label>Value<input type="number" step="any" value={value} onChange={event => setValue(event.target.value)}/></label></div>
  <div className="form-grid"><label>From<select value={from} onChange={event => setFrom(event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label><label>To<select value={to} onChange={event => setTo(event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label></div>
  <div className="calculator-result-large"><span>Converted measurement</span><b>{formatNumber(result)} {to}</b></div>
 </div>;
}

function toDraft(technique: Technique): TechniqueDraft {
 return {
  site_id: technique.site_id, asset_id: technique.asset_id || "", title: technique.title, category: technique.category,
  interval: technique.interval || "", safety_notes: technique.safety_notes || "", tools: technique.tools || "",
  steps: technique.procedure_steps.join("\n"),
  measurements: technique.measurement_specs.length ? technique.measurement_specs : [newMeasurement()],
  torque: technique.torque_specs.length ? technique.torque_specs : [newTorque()],
  belt: technique.belt_tension || blankBelt(), source_document_id: technique.source_document_id || "",
  source_reference: technique.source_reference || "", source_page: technique.source_page || ""
 };
}
function toHttpUrl(value: string | null | undefined) {
 if (!value) return null;
 try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null; }
 catch { return null; }
}
function label(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase()); }
function formatNumber(value: number) { return Number.isFinite(value) ? new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 }).format(value) : "—"; }
