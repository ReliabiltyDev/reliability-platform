import { useEffect, useState } from "react";
import type React from "react";
import { Activity, AlertTriangle, ArrowLeft, BarChart3, CalendarDays, ChevronRight, ClipboardCheck, FileText, FileSpreadsheet, Gauge, Image, LayoutDashboard, LogOut, Menu, PackageSearch, Plus, Save, Search, ShieldCheck, Upload, UserPlus, Wrench, X } from "lucide-react";
import { supabase } from "./lib/supabase";
import SitesPage from "./SitesPage";
import ImportCenter from "./ImportCenter";
import { VisitsPage, NotesPage } from "./PersonalPages";

type Section={id:string;label:string;icon:React.ComponentType<{size?:number}>};
const sections:Section[]=[
{id:"dashboard",label:"Dashboard",icon:LayoutDashboard},{id:"assets",label:"Assets",icon:PackageSearch},{id:"sites",label:"Sites",icon:ShieldCheck},{id:"import",label:"Import Center",icon:FileSpreadsheet},{id:"reliability",label:"Reliability",icon:Activity},{id:"maintenance",label:"Maintenance",icon:Wrench},{id:"visits",label:"My Site Visits",icon:ClipboardCheck},{id:"notes",label:"My Notes",icon:FileText},{id:"calendar",label:"My Calendar",icon:CalendarDays},{id:"technical",label:"Technical Library",icon:Gauge},{id:"documents",label:"Documents",icon:FileText},{id:"maximo",label:"Maximo",icon:ShieldCheck}
];
type Site={id:string;code:string;name:string}; type Asset={id:string;site_id:string;asset_tag:string;name:string;asset_class:string|null;criticality:number|null;status:string};

export default function App(){
 const [session,setSession]=useState<any>(null); const [loading,setLoading]=useState(true);
 useEffect(()=>{ if(!supabase){setLoading(false);return} supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)}); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>data.subscription.unsubscribe(); },[]);
 if(loading) return <div className="center"><div className="loader"/><span>Loading Reliability Platform…</span></div>;
 if(!supabase) return <div className="center"><h2>Configuration needed</h2><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the app environment.</p></div>;
 if(!session) return <AuthScreen/>;
 return <AuthenticatedApp session={session}/>;
}

function AuthScreen(){
 const [mode,setMode]=useState<"signin"|"signup">("signin"); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setMessage(""); if(mode==="signin"){const r=await supabase!.auth.signInWithPassword({email,password});if(r.error)setError(r.error.message)}else{const redirectTo = `${window.location.origin}${(import.meta as any).env.BASE_URL}`; const r=await supabase!.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:redirectTo}});if(r.error)setError(r.error.message);else setMessage(r.data.session?"Account created.":"Account created. Check your email if confirmation is required.")}setBusy(false)}
 return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="mark">R</div><div><strong>Reliability</strong><span>Engineering Platform</span></div></div><p className="eyebrow">SECURE WORKSPACE</p><h1>{mode==="signin"?"Welcome back":"Create your account"}</h1><p className="muted">{mode==="signin"?"Sign in to access your reliability workspace.":"Create a development account to begin."}</p><form onSubmit={submit}>{mode==="signup"&&<label>Name<input value={name} onChange={e=>setName(e.target.value)} required placeholder="Your name"/></label>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="••••••••"/></label>{error&&<div className="notice error">{error}</div>}{message&&<div className="notice">{message}</div>}<button className="primary full" disabled={busy}>{busy?"Working…":mode==="signin"?"Sign in":"Create account"}</button></form><button className="switch" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setError("");setMessage("")}}>{mode==="signin"?<><UserPlus size={15}/> Create an account</>:<>Already have an account? Sign in</>}</button></div></div>
}

function AuthenticatedApp({session}:{session:any}){
 useEffect(()=>{ void supabase!.rpc("bootstrap_demo_workspace"); },[session.user.id]);
 const [active,setActive]=useState("dashboard"); const [open,setOpen]=useState(false); const current=sections.find(s=>s.id===active)!;
 return <div className="app"><aside className={open?"sidebar open":"sidebar"}><div className="brand"><div className="mark">R</div><div><strong>Reliability</strong><span>Engineering Platform</span></div><button className="icon mobile-close" onClick={()=>setOpen(false)}><X/></button></div><nav>{sections.map(s=>{const I=s.icon;return <button className={active===s.id?"nav active":"nav"} key={s.id} onClick={()=>{setActive(s.id);setOpen(false)}}><I size={19}/><span>{s.label}</span></button>})}</nav><div className="sidebar-bottom"><button className="nav" onClick={()=>supabase!.auth.signOut()}><LogOut size={19}/><span>Sign out</span></button><div className="environment"><span className="dot"/>Connected workspace</div></div></aside><main className="main"><header><button className="icon menu-btn" onClick={()=>setOpen(true)}><Menu/></button><div className="crumb"><span>Reliability Platform</span><ChevronRight size={16}/><b>{current.label}</b></div><div className="header-actions"><button className="icon"><Search/></button><div className="avatar">{(session.user.email||"RE").slice(0,2).toUpperCase()}</div></div></header><div className="content">{active==="dashboard"?<Dashboard/>:active==="assets"?<AssetsPage/>:active==="sites"?<SitesPage/>:active==="import"?<ImportCenter/>:active==="visits"?<VisitsPage/>:active==="notes"?<NotesPage/>:<SectionPage section={current}/>}</div></main></div>
}

function Dashboard(){
 const [sites,setSites]=useState<Site[]>([]);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [error,setError]=useState("");

 useEffect(()=>{
  let live=true;
  (async()=>{
   const s=await supabase!.from("sites").select("id,code,name").order("name");
   if(s.error){if(live)setError(s.error.message);return}
   const a=await supabase!.from("assets").select("id,site_id,asset_tag,name,asset_class,criticality,status").order("name").limit(50);
   if(live){
    setSites(s.data||[]);
    setAssets(a.data||[]);
    if(a.error)setError(a.error.message);
   }
  })();
  return()=>{live=false};
 },[]);

 return <div>
  <div className="hero">
   <div><p className="eyebrow">RELIABILITY OVERVIEW</p><h1>Good morning.</h1><p className="muted">Connected to your Supabase reliability workspace.</p></div>
   <button className="primary"><span>+</span> Log activity</button>
  </div>
  {error&&<div className="notice error wide">{error}</div>}
  <div className="grid metrics">
   <div className="metric"><div className="metric-top"><span>Sites</span><ShieldCheck size={17}/></div><strong>{sites.length}</strong><small>Sites you can access</small></div>
   <div className="metric"><div className="metric-top"><span>Assets</span><PackageSearch size={17}/></div><strong>{assets.length}</strong><small>Assets visible in workspace</small></div>
   <div className="metric"><div className="metric-top"><span>Critical assets</span><AlertTriangle size={17}/></div><strong>{assets.filter(a=>(a.criticality||0)>=4).length}</strong><small>Criticality 4–5</small></div>
   <div className="metric"><div className="metric-top"><span>Workspace</span><BarChart3 size={17}/></div><strong>Live</strong><small>Supabase connected</small></div>
  </div>
  <div className="two-col">
   <section className="panel"><div className="panel-head"><div><h2>Sites</h2><p>Authorized operating locations</p></div></div>
    {sites.length>0 ? <div className="list">{sites.map(s=><Item key={s.id} title={s.name} detail={s.code} tag="Active"/>)}</div> : <Empty text="No site access has been assigned to this account yet."/>}
   </section>
   <section className="panel"><div className="panel-head"><div><h2>Assets</h2><p>Current asset records</p></div></div>
    {assets.length>0 ? <div className="list">{assets.slice(0,6).map(a=><Item key={a.id} title={a.name} detail={a.asset_tag+(a.asset_class?" · "+a.asset_class:"")} tag={a.status}/>)}</div> : <Empty text="No assets are visible yet. Site membership controls access."/>}
   </section>
  </div>
  <section className="panel quick"><div className="panel-head"><div><h2>Next build layer</h2><p>The live application will expand from this connected foundation.</p></div></div>
   <div className="quick-grid">
    <Quick title="Asset hierarchy" text="Site → area → line → machine → subsystem → component"/>
    <Quick title="Failure management" text="Failures, modes, causes, downtime and RCA"/>
    <Quick title="Technical library" text="Specs, lubricants, documents and source references"/>
    <Quick title="Maximo bridge" text="CSV/Excel import first, API integration later"/>
   </div>
  </section>
 </div>
}

function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
function Item({title,detail,tag}:{title:string;detail:string;tag:string}){return <div className="list-row"><div className="row-icon"><Activity size={17}/></div><div className="row-copy"><b>{title}</b><span>{detail}</span></div><span className="tag">{tag}</span></div>}
function Quick({title,text}:{title:string;text:string}){return <button className="quick-card"><b>{title}</b><span>{text}</span><ChevronRight size={17}/></button>}
function AssetsPage(){
 const [assets,setAssets]=useState<AssetDetail[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [siteFilter,setSiteFilter]=useState("all");
 const [query,setQuery]=useState("");
 const [selected,setSelected]=useState<AssetDetail|null>(null);
 const [editing,setEditing]=useState(false);
 const [error,setError]=useState("");
 async function load(){
  const [r,s]=await Promise.all([
   supabase!.from("assets").select("id,site_id,asset_tag,name,asset_class,manufacturer,model,serial_number,status,criticality,description,maximo_asset_id,installed_at,parent_asset_id,production_line_id").order("name"),
   supabase!.from("sites").select("id,code,name").order("name")
  ]);
  if(r.error){setError(r.error.message);return}
  if(s.error){setError(s.error.message);return}
  setAssets((r.data||[]) as AssetDetail[]);
  setSites((s.data||[]) as Site[]);
 }
 useEffect(()=>{void load();const channel=supabase!.channel("shared-assets-live").on("postgres_changes",{event:"*",schema:"public",table:"assets"},()=>void load()).subscribe();return()=>{void supabase!.removeChannel(channel)}},[]);
 const filtered=assets.filter(a=>(siteFilter==="all"||a.site_id===siteFilter)&&[a.name,a.asset_tag,a.asset_class||"",a.manufacturer||"",a.model||""].join(" ").toLowerCase().includes(query.toLowerCase()));
 if(selected) return <AssetDetailPage asset={selected} onBack={()=>{setSelected(null);setEditing(false)}} onSaved={async()=>{setSelected(null);setEditing(false);await load()}} editing={editing} setEditing={setEditing} sites={sites}/>;
 return <div>
  <div className="hero"><div><p className="eyebrow">ASSET MANAGEMENT</p><h1>Assets</h1><p className="muted">Build and maintain the equipment hierarchy that everything else in the platform connects to.</p></div><button className="primary" onClick={()=>{setSelected({id:"",site_id:siteFilter==="all"?(sites[0]?.id||""):siteFilter,asset_tag:"",name:"",asset_class:"",manufacturer:"",model:"",serial_number:"",status:"active",criticality:3,description:"",maximo_asset_id:"",installed_at:"",parent_asset_id:null,production_line_id:null});setEditing(true)}}><Plus size={17}/> Add asset</button></div>
  {error&&<div className="notice error wide">{error}</div>}
  <div className="asset-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search assets, tags, manufacturers…"/></div><select className="site-filter" value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}><option value="all">All sites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}</select><div className="toolbar-note">{filtered.length} asset{filtered.length===1?"":"s"}</div></div>
  <section className="panel"><div className="asset-table-head"><span>Asset</span><span>Site</span><span>Class</span><span>Manufacturer / Model</span><span>Criticality</span><span>Status</span></div>
   {filtered.length?filtered.map(a=><button className="asset-row" key={a.id||"new"} onClick={()=>{setSelected(a);setEditing(false)}}><div className="asset-main"><div className="row-icon"><PackageSearch size={17}/></div><div><b>{a.name||"New asset"}</b><span>{a.asset_tag||"No asset tag"}</span></div></div><span>{sites.find(s=>s.id===a.site_id)?.name||"—"}</span><span>{a.asset_class||"—"}</span><span>{[a.manufacturer,a.model].filter(Boolean).join(" · ")||"—"}</span><span><span className={a.criticality&&a.criticality>=4?"critical-tag":"tag"}>{a.criticality??"—"}</span></span><span className="tag">{a.status}</span></button>):<Empty text="No assets match your search."/>}
  </section>
  <section className="panel hierarchy-callout"><div className="row-icon"><PackageSearch size={20}/></div><div><h2>Asset hierarchy</h2><p>Site → area → production line → machine → subsystem → component</p></div></section>
 </div>
}

type AssetDetail=Asset & {manufacturer?:string|null;model?:string|null;serial_number?:string|null;description?:string|null;maximo_asset_id?:string|null;installed_at?:string|null;parent_asset_id?:string|null;production_line_id?:string|null};

function AssetDetailPage({asset,onBack,onSaved,editing,setEditing,sites}:{asset:AssetDetail;onBack:()=>void;onSaved:()=>void;editing:boolean;setEditing:(v:boolean)=>void;sites:Site[]}){
 const [form,setForm]=useState(asset); const [photos,setPhotos]=useState<any[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 useEffect(()=>{setForm(asset); if(asset.id) void loadPhotos()},[asset.id]);
 async function loadPhotos(){const r=await supabase!.from("asset_photos").select("id,storage_path,caption,created_at").eq("asset_id",asset.id).order("created_at",{ascending:false});if(r.error){setError(r.error.message);return}const rows=await Promise.all((r.data||[]).map(async p=>{const s=await supabase!.storage.from("asset-photos").createSignedUrl(p.storage_path,3600);return {...p,url:s.data?.signedUrl}}));setPhotos(rows)}
 async function save(){
  setBusy(true);setError("");
  const payload={site_id:form.site_id,asset_tag:form.asset_tag,name:form.name,asset_class:form.asset_class||null,manufacturer:form.manufacturer||null,model:form.model||null,serial_number:form.serial_number||null,status:form.status,criticality:form.criticality||null,description:form.description||null,maximo_asset_id:form.maximo_asset_id||null,installed_at:form.installed_at||null,parent_asset_id:form.parent_asset_id||null,production_line_id:form.production_line_id||null};
  const r=form.id?await supabase!.from("assets").update(payload).eq("id",form.id).select().single():await supabase!.from("assets").insert(payload).select().single();
  if(r.error)setError(r.error.message);else await onSaved();setBusy(false);
 }
 async function addPhoto(file:File){
  if(!form.id)return;
  setBusy(true);setError("");
  const path=form.id+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const up=await supabase!.storage.from("asset-photos").upload(path,file,{upsert:false});
  if(up.error){setError(up.error.message);setBusy(false);return}
  const user=await supabase!.auth.getUser();
  const row=await supabase!.from("asset_photos").insert({asset_id:form.id,storage_path:path,created_by:user.data.user?.id}).select().single();
  if(row.error){await supabase!.storage.from("asset-photos").remove([path]);setError(row.error.message)}else await loadPhotos();
  setBusy(false);
 }
 return <div>
  <button className="back-btn" onClick={onBack}><ArrowLeft size={16}/> Back to assets</button>
  <div className="detail-hero"><div><p className="eyebrow">ASSET RECORD</p><h1>{form.name||"New asset"}</h1><p className="muted">{form.asset_tag||"Assign an asset tag"}{form.asset_class?" · "+form.asset_class:""}</p></div><div className="detail-actions">{form.id&&!editing&&<button className="secondary" onClick={()=>setEditing(true)}>Edit asset</button>}{editing&&<button className="primary" disabled={busy} onClick={save}><Save size={16}/>{busy?"Saving…":"Save asset"}</button>}</div></div>
  {error&&<div className="notice error wide">{error}</div>}
  {editing?<AssetForm form={form} setForm={setForm} sites={sites}/>:<div className="detail-grid">
   <section className="panel"><div className="panel-head"><div><h2>Asset information</h2><p>Core equipment identity</p></div></div><InfoGrid items={[["Site",sites.find(s=>s.id===form.site_id)?.name||form.site_id],["Asset tag",form.asset_tag],["Class",form.asset_class],["Manufacturer",form.manufacturer],["Model",form.model],["Serial number",form.serial_number],["Criticality",form.criticality],["Status",form.status],["Maximo asset ID",form.maximo_asset_id]]}/><div className="description"><b>Description</b><p>{form.description||"No description has been entered yet."}</p></div></section>
   <section className="panel"><div className="panel-head"><div><h2>Photos</h2><p>Equipment photos and nameplates</p></div>{form.id&&<label className="upload-btn"><Upload size={15}/> Add photo<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)void addPhoto(f);e.currentTarget.value=""}}/></label>}</div>
    {photos.length?<div className="photo-grid">{photos.map(p=><div className="photo-card" key={p.id}><img src={p.url||""} alt={p.caption||"Asset photo"}/></div>)}</div>:<div className="photo-empty"><Image size={28}/><span>No photos yet.</span><small>On iPad, use Add photo to choose from Photos or take a picture.</small></div>}
   </section>
  </div>}
 </div>
}

function AssetForm({form,setForm,sites}:{form:AssetDetail;setForm:React.Dispatch<React.SetStateAction<AssetDetail>>;sites?:Site[]}){
 const set=(key:keyof AssetDetail,value:any)=>setForm(x=>({...x,[key]:value}));
 return <div className="detail-grid"><section className="panel form-panel"><div className="panel-head"><div><h2>Asset information</h2><p>Enter the equipment record</p></div></div><div className="form-grid">
  <label>Site<select value={form.site_id} onChange={e=>set("site_id",e.target.value)}><option value="">Select site…</option>{sites?.map(s=><option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}</select></label>
  <label>Asset tag<input value={form.asset_tag} onChange={e=>set("asset_tag",e.target.value)} placeholder="e.g. P-101"/></label>
  <label>Name<input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Equipment name"/></label>
  <label>Asset class<input value={form.asset_class||""} onChange={e=>set("asset_class",e.target.value)} placeholder="Press, motor, gearbox…"/></label>
  <label>Manufacturer<input value={form.manufacturer||""} onChange={e=>set("manufacturer",e.target.value)}/></label>
  <label>Model<input value={form.model||""} onChange={e=>set("model",e.target.value)}/></label>
  <label>Serial number<input value={form.serial_number||""} onChange={e=>set("serial_number",e.target.value)}/></label>
  <label>Criticality<select value={form.criticality||""} onChange={e=>set("criticality",e.target.value?Number(e.target.value):null)}><option value="">Not set</option><option value="1">1 — Low</option><option value="2">2</option><option value="3">3</option><option value="4">4 — High</option><option value="5">5 — Critical</option></select></label>
  <label>Status<select value={form.status} onChange={e=>set("status",e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="retired">Retired</option></select></label>
  <label className="span-2">Maximo asset ID<input value={form.maximo_asset_id||""} onChange={e=>set("maximo_asset_id",e.target.value)}/></label>
  <label className="span-2">Description<textarea value={form.description||""} onChange={e=>set("description",e.target.value)} rows={5} placeholder="Describe the equipment, duty, configuration, or other engineering context."/></label>
 </div></section></div>
}
function InfoGrid({items}:{items:[string,any][]}){return <div className="info-grid">{items.map(([k,v])=><div key={k}><span>{k}</span><b>{v||"—"}</b></div>)}</div>}
function SectionPage({section}:{section:Section}){const I=section.icon;return <div className="empty-page"><div className="page-icon"><I size={28}/></div><p className="eyebrow">MODULE</p><h1>{section.label}</h1><p className="muted">The navigation is live. This module will be connected to its Supabase records and workflows as we build the platform layer by layer.</p><div className="panel roadmap"><h2>Connected foundation</h2><p>Authentication is live, the database is already structured, and access is controlled by site membership. The next records will plug into this shell without rebuilding the application.</p></div></div>}