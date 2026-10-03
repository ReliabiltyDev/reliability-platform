import { useEffect, useState } from "react";
import type React from "react";
import { Activity, AlertTriangle, ArrowLeft, BarChart3, BookOpen, CalendarDays, ChevronRight, ClipboardCheck, ExternalLink, FileText, FileSpreadsheet, FileUp, Gauge, Image, LayoutDashboard, LogOut, Menu, MessageSquare, PackageSearch, Plus, Save, Search, ShieldCheck, Upload, UserPlus, Wrench, X } from "lucide-react";
import { supabase } from "./lib/supabase";
import SitesPage from "./SitesPage";
import ImportCenter from "./ImportCenter";
import { VisitsPage, NotesPage } from "./PersonalPages";
import TechnicalLibrary from "./TechnicalLibrary";
import CalendarPage from "./CalendarPage";
import ReliabilityPage from "./ReliabilityPage";
import ReliabilityAnalytics from "./ReliabilityAnalytics";

type Section={id:string;label:string;icon:React.ComponentType<{size?:number}>};
const sections:Section[]=[
{id:"dashboard",label:"Dashboard",icon:LayoutDashboard},{id:"assets",label:"Assets",icon:PackageSearch},{id:"sites",label:"Sites",icon:ShieldCheck},{id:"import",label:"Import Center",icon:FileSpreadsheet},{id:"reliability",label:"Reliability",icon:Activity},{id:"maintenance",label:"Maintenance",icon:Wrench},{id:"visits",label:"My Site Visits",icon:ClipboardCheck},{id:"notes",label:"My Notes",icon:FileText},{id:"calendar",label:"My Calendar",icon:CalendarDays},{id:"technical",label:"Technical Library",icon:Gauge},{id:"documents",label:"Documents",icon:FileText},{id:"maximo",label:"Maximo",icon:ShieldCheck}
];
type Site={id:string;name:string;state:string|null;timezone:string|null;code?:string}; type Asset={id:string;site_id:string;asset_tag:string;name:string;asset_class:string|null;criticality:number|null;status:string};

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
 const [active,setActive]=useState("dashboard"); const [open,setOpen]=useState(false); const [collapsed,setCollapsed]=useState(false); const [feedbackOpen,setFeedbackOpen]=useState(false); const current=sections.find(s=>s.id===active)!;
 return <div className={"app"+(collapsed?" sidebar-collapsed":"")}><aside className={"sidebar"+(open?" open":"")}><div className="brand"><div className="mark">R</div><div><strong>Reliability</strong><span>Engineering Platform</span></div><button type="button" className="icon sidebar-collapse-toggle" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} title={collapsed?"Expand sidebar":"Collapse sidebar"}><ChevronRight size={17}/></button><button className="icon mobile-close" onClick={()=>setOpen(false)} aria-label="Close navigation"><X/></button></div><nav>{sections.map(s=>{const I=s.icon;return <button className={active===s.id?"nav active":"nav"} key={s.id} title={collapsed?s.label:undefined} aria-label={collapsed?s.label:undefined} onClick={()=>{setActive(s.id);setOpen(false)}}><I size={19}/><span>{s.label}</span></button>})}</nav><div className="sidebar-bottom"><button className="nav" onClick={()=>supabase!.auth.signOut()} title={collapsed?"Sign out":undefined} aria-label={collapsed?"Sign out":undefined}><LogOut size={19}/><span>Sign out</span></button><div className="environment"><span className="dot"/>Connected workspace</div></div></aside><main className="main"><header><button className="icon menu-btn" onClick={()=>setOpen(true)}><Menu/></button><div className="crumb"><span>Reliability Platform</span><ChevronRight size={16}/><b>{current.label}</b></div><div className="header-actions"><button type="button" className="feedback-trigger" onClick={()=>setFeedbackOpen(true)}><MessageSquare size={16}/><span>Submit feedback</span></button><button className="icon"><Search/></button><div className="avatar">{(session.user.email||"RE").slice(0,2).toUpperCase()}</div></div></header><div className="content">{active==="dashboard"?<Dashboard onNavigate={setActive}/>:active==="assets"?<AssetsPage/>:active==="sites"?<SitesPage/>:active==="import"?<ImportCenter/>:active==="technical"?<TechnicalLibrary/>:active==="visits"?<VisitsPage/>:active==="calendar"?<CalendarPage/>:active==="reliability"?<ReliabilityPage/>:active==="notes"?<NotesPage/>:<SectionPage section={current}/>}</div></main>{feedbackOpen&&<FeedbackDialog email={session.user.email||""} section={current.label} onClose={()=>setFeedbackOpen(false)}/>}</div>
}


function FeedbackDialog({email,section,onClose}:{email:string;section:string;onClose:()=>void}){
 const [kind,setKind]=useState("Suggestion");
 const [title,setTitle]=useState("");
 const [details,setDetails]=useState("");
 function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  const subject="[Reliability Workspace] "+kind+": "+title.trim();
  const body=["Type: "+kind,"Submitted by: "+email,"Current section: "+section,"","Details:",details.trim()].join("\n");
  window.location.href="mailto:monarchbc@icloud.com?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  onClose();
 }
 return <div className="site-create-overlay feedback-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section className="panel feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
   <div className="panel-head"><div><h2 id="feedback-title">Submit suggestions & feedback</h2><p>Send a correction or idea to the workspace admin.</p></div><button type="button" className="icon" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
   <form className="feedback-form" onSubmit={submit}>
    <label>Type<select value={kind} onChange={event=>setKind(event.target.value)}><option>Suggestion</option><option>Correction</option><option>Bug report</option><option>Other</option></select></label>
    <label>Short summary<input value={title} onChange={event=>setTitle(event.target.value)} required placeholder="What should be changed?"/></label>
    <label>Details<textarea value={details} onChange={event=>setDetails(event.target.value)} required rows={5} placeholder="Describe what you saw and what you would like instead."/></label>
    <p className="feedback-submit-note">Your email app will open a draft to monarchbc@icloud.com with this section and your account email included. Review it, then send.</p>
    <div className="site-create-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary"><MessageSquare size={15}/> Continue to email</button></div>
   </form>
  </section>
 </div>;
}
function Dashboard({onNavigate}:{onNavigate:(section:string)=>void}){
 const [sites,setSites]=useState<Site[]>([]);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [error,setError]=useState("");

 useEffect(()=>{
  let live=true;
  (async()=>{
   const s=await supabase!.from("sites").select("id,name,state,timezone").order("name");
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
   <div><p className="eyebrow">RELIABILITY OVERVIEW</p><h1>Reliability Workspace</h1><p className="muted">Connected to your Supabase reliability workspace.</p></div>
   <button type="button" className="primary" onClick={()=>onNavigate("reliability")}><span>+</span> Log activity</button>
  </div>
  {error&&<div className="notice error wide">{error}</div>}
  <div className="grid metrics">
   <button type="button" className="metric metric-action" onClick={()=>onNavigate("sites")} aria-label="Open sites"><div className="metric-top"><span>Sites</span><ShieldCheck size={17}/></div><strong>{sites.length}</strong><small>Sites you can access</small></button>
   <button type="button" className="metric metric-action" onClick={()=>onNavigate("assets")} aria-label="Open assets"><div className="metric-top"><span>Assets</span><PackageSearch size={17}/></div><strong>{assets.length}</strong><small>Assets visible in workspace</small></button>
   <button type="button" className="metric metric-action" onClick={()=>onNavigate("assets")} aria-label="Open critical assets"><div className="metric-top"><span>Critical assets</span><AlertTriangle size={17}/></div><strong>{assets.filter(a=>(a.criticality||0)>=4).length}</strong><small>Criticality 4–5</small></button>
   <div className="metric"><div className="metric-top"><span>Workspace</span><BarChart3 size={17}/></div><strong>Live</strong><small>Supabase connected</small></div>
  </div>
  <div className="two-col">
   <section className="panel"><div className="panel-head"><div><h2>Sites</h2><p>Authorized operating locations</p></div></div>
    {sites.length>0 ? <div className="list">{sites.map(s=><Item key={s.id} title={s.name} detail={[s.state,s.timezone].filter(Boolean).join(" · ")||"Location not set"} tag="Active" onClick={()=>onNavigate("sites")}/>)}</div> : <Empty text="No site access has been assigned to this account yet."/>}
   </section>
   <section className="panel"><div className="panel-head"><div><h2>Assets</h2><p>Current asset records</p></div></div>
    {assets.length>0 ? <div className="list">{assets.slice(0,6).map(a=><Item key={a.id} title={a.name} detail={a.asset_tag+(a.asset_class?" · "+a.asset_class:"")} tag={a.status} onClick={()=>onNavigate("assets")}/>)}</div> : <Empty text="No assets are visible yet. Site membership controls access."/>}
   </section>
  </div>
  <ReliabilityAnalytics onNavigate={onNavigate}/>
  <section className="panel quick"><div className="panel-head"><div><h2>Workspace modules</h2><p>Open a workspace area to add records and review live reliability data.</p></div></div>
   <div className="quick-grid">
    <Quick title="Asset hierarchy" text="Site → area → line → machine → subsystem → component" onClick={()=>onNavigate("assets")}/>
    <Quick title="Failure management" text="Failures, modes, causes, downtime and RCA" onClick={()=>onNavigate("reliability")}/>
    <Quick title="Technical library" text="Specs, lubricants, documents and source references" onClick={()=>onNavigate("technical")}/>
    <Quick title="Calendar & site visits" text="Appointments linked to sites and assets, with iPhone calendar sync" onClick={()=>onNavigate("calendar")}/>
   </div>
  </section>
 </div>
}

function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
function Item({title,detail,tag,onClick}:{title:string;detail:string;tag:string;onClick:()=>void}){return <button type="button" className="list-row list-row-button" onClick={onClick}><span className="row-icon"><Activity size={17}/></span><span className="row-copy"><b>{title}</b><span>{detail}</span></span><span className="tag">{tag}</span><ChevronRight className="row-chevron" size={16}/></button>}
function Quick({title,text,onClick}:{title:string;text:string;onClick:()=>void}){return <button type="button" className="quick-card" onClick={onClick}><b>{title}</b><span>{text}</span><ChevronRight size={17}/></button>}
type Area={id:string;site_id:string;code:string;name:string};
type ProductionLine={id:string;area_id:string;code:string;name:string};

function AssetsPage(){
 const [assets,setAssets]=useState<AssetDetail[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [areas,setAreas]=useState<Area[]>([]);
 const [lines,setLines]=useState<ProductionLine[]>([]);
 const [siteFilter,setSiteFilter]=useState("all");
 const [query,setQuery]=useState("");
 const [selected,setSelected]=useState<AssetDetail|null>(null);
 const [editing,setEditing]=useState(false);
 const [error,setError]=useState("");
 async function load(){
  const [r,s,a,l]=await Promise.all([
   supabase!.from("assets").select("id,site_id,asset_tag,name,asset_class,manufacturer,model,serial_number,status,criticality,description,maximo_asset_id,installed_at,parent_asset_id,production_line_id").order("name"),
   supabase!.from("sites").select("id,name,state,timezone").order("name"),
   supabase!.from("areas").select("id,site_id,code,name").order("name"),
   supabase!.from("production_lines").select("id,area_id,code,name").order("name")
  ]);
  if(r.error){setError(r.error.message);return}
  if(s.error){setError(s.error.message);return}
  if(a.error){setError(a.error.message);return}
  if(l.error){setError(l.error.message);return}
  setAssets((r.data||[]) as AssetDetail[]);
  setSites((s.data||[]) as Site[]);
  setAreas((a.data||[]) as Area[]);
  setLines((l.data||[]) as ProductionLine[]);
  setError("");
 }
 useEffect(()=>{void load();const channel=supabase!.channel("shared-assets-live").on("postgres_changes",{event:"*",schema:"public",table:"assets"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"areas"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"production_lines"},()=>void load()).subscribe();return()=>{void supabase!.removeChannel(channel)}},[]);
 const filtered=assets.filter(a=>(siteFilter==="all"||a.site_id===siteFilter)&&[a.name,a.asset_tag,a.asset_class||"",a.manufacturer||"",a.model||""].join(" ").toLowerCase().includes(query.toLowerCase()));
 function startNewAsset(siteId:string,productionLineId:string|null=null){
  setSelected({id:"",site_id:siteId,asset_tag:"",name:"",asset_class:"",criticality:3,status:"active",parent_asset_id:null,production_line_id:productionLineId,manufacturer:"",model:"",serial_number:"",description:"",maximo_asset_id:"",installed_at:""});
  setEditing(true);
 }
 function selectAsset(asset:AssetDetail){setSelected(asset);setEditing(false)}
 if(selected) return <AssetDetailPage asset={selected} onBack={()=>{setSelected(null);setEditing(false)}} onSaved={async()=>{setSelected(null);setEditing(false);await load()}} editing={editing} setEditing={setEditing} sites={sites} areas={areas} lines={lines} assets={assets}/>;
 const locationLabel=(asset:AssetDetail)=>{
  const line=lines.find(x=>x.id===asset.production_line_id);
  const area=areas.find(x=>x.id===line?.area_id);
  const site=sites.find(x=>x.id===asset.site_id);
  return [site?.name,area?.name,line?.name].filter(Boolean).join(" / ")||"—";
 };
 return <div>
  <div className="hero"><div><p className="eyebrow">ASSET MANAGEMENT</p><h1>Assets</h1><p className="muted">Organize equipment by site, area, production line, and parent asset.</p></div><button className="primary" onClick={()=>startNewAsset(siteFilter==="all"?(sites[0]?.id||""):siteFilter)}><Plus size={17}/> Add asset</button></div>
  {error&&<div className="notice error wide">{error}</div>}
  <AssetHierarchyManager sites={sites} areas={areas} lines={lines} assets={assets} onAddAsset={startNewAsset} onSelectAsset={selectAsset} onRefresh={load}/>
  <div className="asset-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search assets, tags, manufacturers…"/></div><select className="site-filter" value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}><option value="all">All sites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name} · {s.state||"State not set"}</option>)}</select><div className="toolbar-note">{filtered.length} asset{filtered.length===1?"":"s"}</div></div>
  <section className="panel"><div className="asset-table-head"><span>Asset</span><span>Location</span><span>Class</span><span>Manufacturer / Model</span><span>Criticality</span><span>Status</span></div>
   {filtered.length?filtered.map(a=><button className="asset-row" key={a.id||"new"} onClick={()=>selectAsset(a)}><div className="asset-main"><div className="row-icon"><PackageSearch size={17}/></div><div><b>{a.name||"New asset"}</b><span>{a.asset_tag||"No asset tag"}</span></div></div><span>{locationLabel(a)}</span><span>{a.asset_class||"—"}</span><span>{[a.manufacturer,a.model].filter(Boolean).join(" · ")||"—"}</span><span><span className={a.criticality&&a.criticality>=4?"critical-tag":"tag"}>{a.criticality??"—"}</span></span><span className="tag">{a.status}</span></button>):<Empty text="No assets match your search."/>}
  </section>
 </div>
}

function AssetHierarchyManager({sites,areas,lines,assets,onAddAsset,onSelectAsset,onRefresh}:{sites:Site[];areas:Area[];lines:ProductionLine[];assets:AssetDetail[];onAddAsset:(siteId:string,lineId?:string|null)=>void;onSelectAsset:(asset:AssetDetail)=>void;onRefresh:()=>Promise<void>}){
 const [areaSiteId,setAreaSiteId]=useState(sites[0]?.id||"");
 const [areaCode,setAreaCode]=useState("");
 const [areaName,setAreaName]=useState("");
 const [lineAreaId,setLineAreaId]=useState(areas[0]?.id||"");
 const [lineCode,setLineCode]=useState("");
 const [lineName,setLineName]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{if(!areaSiteId&&sites[0])setAreaSiteId(sites[0].id)},[sites,areaSiteId]);
 useEffect(()=>{if(!lineAreaId&&areas[0])setLineAreaId(areas[0].id)},[areas,lineAreaId]);
 async function addArea(e:React.FormEvent){
  e.preventDefault();setError("");setBusy(true);
  const r=await supabase!.from("areas").insert({site_id:areaSiteId,code:areaCode.trim(),name:areaName.trim()}).select("id").single();
  if(r.error)setError(r.error.message);
  else{setAreaCode("");setAreaName("");setLineAreaId(r.data.id);await onRefresh()}
  setBusy(false);
 }
 async function addLine(e:React.FormEvent){
  e.preventDefault();setError("");setBusy(true);
  const r=await supabase!.from("production_lines").insert({area_id:lineAreaId,code:lineCode.trim(),name:lineName.trim()}).select("id").single();
  if(r.error)setError(r.error.message);
  else{setLineCode("");setLineName("");await onRefresh()}
  setBusy(false);
 }
 return <div className="hierarchy-manager">
  <section className="panel">
   <div className="panel-head"><div><h2>Build the location structure</h2><p>Add areas and production lines before assigning equipment.</p></div></div>
   <div className="hierarchy-forms">
    <form className="hierarchy-form" onSubmit={addArea}><h3>New area</h3><label>Site<select value={areaSiteId} onChange={e=>setAreaSiteId(e.target.value)} required><option value="">Select site…</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name} · {s.state||"State not set"}</option>)}</select></label><div className="form-grid"><label>Area code<input value={areaCode} onChange={e=>setAreaCode(e.target.value)} required placeholder="AREA-01"/></label><label>Area name<input value={areaName} onChange={e=>setAreaName(e.target.value)} required placeholder="Production area"/></label></div><button className="secondary" disabled={busy||!areaSiteId}>Add area</button></form>
    <form className="hierarchy-form" onSubmit={addLine}><h3>New production line</h3><label>Area<select value={lineAreaId} onChange={e=>setLineAreaId(e.target.value)} required><option value="">Select area…</option>{areas.map(a=><option key={a.id} value={a.id}>{sites.find(s=>s.id===a.site_id)?.name} / {a.name} · {a.code}</option>)}</select></label><div className="form-grid"><label>Line code<input value={lineCode} onChange={e=>setLineCode(e.target.value)} required placeholder="LINE-01"/></label><label>Line name<input value={lineName} onChange={e=>setLineName(e.target.value)} required placeholder="Production line"/></label></div><button className="secondary" disabled={busy||!lineAreaId}>Add line</button></form>
   </div>
   {error&&<div className="notice error wide">{error}</div>}
  </section>
  <section className="panel hierarchy-tree">
   <div className="panel-head"><div><h2>Equipment hierarchy</h2><p>Site → area → production line → parent asset → child asset</p></div></div>
   {sites.length?sites.map(site=>{
    const siteAreas=areas.filter(a=>a.site_id===site.id);
    const looseAssets=assets.filter(a=>a.site_id===site.id&&!a.production_line_id);
    const looseRoots=looseAssets.filter(a=>!a.parent_asset_id||!looseAssets.some(p=>p.id===a.parent_asset_id));
    return <details className="hierarchy-node" key={site.id} open><summary><b>{site.name}</b><span>{[site.state,site.timezone].filter(Boolean).join(" · ")||"Site"}</span></summary><div className="tree-branch">
     {siteAreas.length?siteAreas.map(area=>{
      const areaLines=lines.filter(l=>l.area_id===area.id);
      return <details className="hierarchy-node" key={area.id} open><summary><b>{area.name}</b><span>{area.code} · Area</span></summary><div className="tree-branch">
       {areaLines.length?areaLines.map(line=>{
        const lineAssets=assets.filter(a=>a.production_line_id===line.id);
        const roots=lineAssets.filter(a=>!a.parent_asset_id||!lineAssets.some(p=>p.id===a.parent_asset_id));
        return <details className="hierarchy-node" key={line.id} open><summary><b>{line.name}</b><span>{line.code} · Production line</span></summary><div className="tree-branch">
         <div className="tree-toolbar"><span>{lineAssets.length} asset{lineAssets.length===1?"":"s"}</span><button className="secondary" onClick={()=>onAddAsset(site.id,line.id)}><Plus size={14}/> Add asset</button></div>
         {roots.length?roots.map(asset=><AssetTreeNode key={asset.id} asset={asset} assets={lineAssets} onSelect={onSelectAsset}/>):<Empty text="No assets on this line yet."/>}
        </div></details>
       }):<Empty text="No production lines in this area yet."/>}
      </div></details>
     }):<Empty text="No areas at this site yet."/>}
     {looseRoots.length>0&&<div className="unassigned-assets"><b>Assets without a production line</b>{looseRoots.map(a=><AssetTreeNode key={a.id} asset={a} assets={looseAssets} onSelect={onSelectAsset}/>)}</div>}
    </div></details>
   }):<Empty text="Create a site first, then add its areas and lines."/>}
  </section>
 </div>
}

function AssetTreeNode({asset,assets,onSelect,ancestors=[]}:{asset:AssetDetail;assets:AssetDetail[];onSelect:(asset:AssetDetail)=>void;ancestors?:string[]}){
 const nextAncestors=[...ancestors,asset.id];
 const children=assets.filter(a=>a.parent_asset_id===asset.id&&!ancestors.includes(a.id));
 return <div className="asset-tree-node"><button type="button" className="tree-asset-row" onClick={()=>onSelect(asset)}><span><b>{asset.name}</b><small>{asset.asset_tag} · {asset.asset_class||"Equipment"}</small></span><span className="tag">{asset.criticality?"Criticality "+asset.criticality:asset.status}</span></button>{children.length>0&&<div className="asset-tree-children">{children.map(child=><AssetTreeNode key={child.id} asset={child} assets={assets} onSelect={onSelect} ancestors={nextAncestors}/>)}</div>}</div>
}

type AssetDetail=Asset & {manufacturer?:string|null;model?:string|null;serial_number?:string|null;description?:string|null;maximo_asset_id?:string|null;installed_at?:string|null;parent_asset_id?:string|null;production_line_id?:string|null};

function AssetDetailPage({asset,onBack,onSaved,editing,setEditing,sites,areas,lines,assets}:{asset:AssetDetail;onBack:()=>void;onSaved:()=>void;editing:boolean;setEditing:(v:boolean)=>void;sites:Site[];areas:Area[];lines:ProductionLine[];assets:AssetDetail[]}){
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
  {editing?<AssetForm form={form} setForm={setForm} sites={sites} areas={areas} lines={lines} assets={assets}/>:<div className="detail-grid">
   <section className="panel"><div className="panel-head"><div><h2>Asset information</h2><p>Core equipment identity</p></div></div><InfoGrid items={[["Site",sites.find(s=>s.id===form.site_id)?.name||form.site_id],["Asset tag",form.asset_tag],["Class",form.asset_class],["Manufacturer",form.manufacturer],["Model",form.model],["Serial number",form.serial_number],["Criticality",form.criticality],["Status",form.status],["Area",areas.find(a=>a.id===lines.find(l=>l.id===form.production_line_id)?.area_id)?.name],["Production line",lines.find(l=>l.id===form.production_line_id)?.name],["Parent asset",assets.find(a=>a.id===form.parent_asset_id)?.name],["Maximo asset ID",form.maximo_asset_id]]}/><div className="description"><b>Description</b><p>{form.description||"No description has been entered yet."}</p></div></section>
   <section className="panel"><div className="panel-head"><div><h2>Photos</h2><p>Equipment photos and nameplates</p></div>{form.id&&<label className="upload-btn"><Upload size={15}/> Add photo<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)void addPhoto(f);e.currentTarget.value=""}}/></label>}</div>
    {photos.length?<div className="photo-grid">{photos.map(p=><div className="photo-card" key={p.id}><img src={p.url||""} alt={p.caption||"Asset photo"}/></div>)}</div>:<div className="photo-empty"><Image size={28}/><span>No photos yet.</span><small>On iPad, use Add photo to choose from Photos or take a picture.</small></div>}
   </section>
  </div>}
 </div>
}

function AssetForm({form,setForm,sites,areas,lines,assets}:{form:AssetDetail;setForm:React.Dispatch<React.SetStateAction<AssetDetail>>;sites?:Site[];areas:Area[];lines:ProductionLine[];assets:AssetDetail[]}){
 const set=(key:keyof AssetDetail,value:any)=>setForm(x=>({...x,[key]:value}));
 const [areaId,setAreaId]=useState(lines.find(l=>l.id===form.production_line_id)?.area_id||"");
 useEffect(()=>{if(form.production_line_id)setAreaId(lines.find(l=>l.id===form.production_line_id)?.area_id||"")},[lines,form.production_line_id]);
 const availableAreas=areas.filter(a=>a.site_id===form.site_id);
 const availableLines=lines.filter(l=>l.area_id===areaId);
 const blockedParentIds=new Set<string>(form.id?[form.id]:[]);
 let changed=true;
 while(changed){changed=false;for(const a of assets){if(a.parent_asset_id&&blockedParentIds.has(a.parent_asset_id)&&!blockedParentIds.has(a.id)){blockedParentIds.add(a.id);changed=true}}}
 const parentOptions=assets.filter(a=>a.id!==form.id&&!blockedParentIds.has(a.id)&&a.site_id===form.site_id&&a.production_line_id===form.production_line_id);
 return <div className="detail-grid"><section className="panel form-panel"><div className="panel-head"><div><h2>Asset information</h2><p>Enter equipment identity and hierarchy placement.</p></div></div><div className="form-grid">
  <label>Site<select value={form.site_id} onChange={e=>{set("site_id",e.target.value);set("production_line_id",null);set("parent_asset_id",null);setAreaId("")}}><option value="">Select site…</option>{sites?.map(s=><option key={s.id} value={s.id}>{s.name} · {s.state||"State not set"}</option>)}</select></label>
  <label>Area<select value={areaId} onChange={e=>{setAreaId(e.target.value);set("production_line_id",null);set("parent_asset_id",null)}}><option value="">No area</option>{availableAreas.map(a=><option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}</select></label>
  <label>Production line<select value={form.production_line_id||""} onChange={e=>{set("production_line_id",e.target.value||null);set("parent_asset_id",null)}} disabled={!areaId}><option value="">No production line</option>{availableLines.map(l=><option key={l.id} value={l.id}>{l.name} · {l.code}</option>)}</select></label>
  <label>Parent asset<select value={form.parent_asset_id||""} onChange={e=>set("parent_asset_id",e.target.value||null)}><option value="">No parent (top-level asset)</option>{parentOptions.map(a=><option key={a.id} value={a.id}>{a.asset_tag} · {a.name}</option>)}</select><small>Only assets at the same site and production line can be parents.</small></label>
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
const LIBRARY_BUCKET="reliability-library";
type LibrarySite={id:string;name:string;state:string|null;timezone:string|null};
type LibraryAsset={id:string;site_id:string;name:string;asset_tag:string};
type LibraryDocument={id:string;site_id:string;asset_id:string|null;name:string;document_type:string;description:string|null;storage_path:string|null;source_system:string|null;source_reference:string|null;created_at:string};
type LibraryVersion={document_id:string;version_label:string;storage_path:string;file_size_bytes:number|null;revision_date:string|null;created_at:string};
const LIBRARY_TYPES=["manual","drawing","print","procedure","spreadsheet","photo","report","other"];
function TechnicalLibraryPage(){
 const [documents,setDocuments]=useState<LibraryDocument[]>([]);
 const [versions,setVersions]=useState<LibraryVersion[]>([]);
 const [sites,setSites]=useState<LibrarySite[]>([]);
 const [assets,setAssets]=useState<LibraryAsset[]>([]);
 const [query,setQuery]=useState("");
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [file,setFile]=useState<File|null>(null);
 const [form,setForm]=useState({site_id:"",asset_id:"",name:"",document_type:"manual",source_system:"",source_reference:"",version_label:"1",revision_date:"",description:""});
 async function load(){
  const [d,v,s,a]=await Promise.all([
   supabase!.from("documents").select("id,site_id,asset_id,name,document_type,description,storage_path,source_system,source_reference,created_at").not("site_id","is",null).order("created_at",{ascending:false}),
   supabase!.from("document_versions").select("document_id,version_label,storage_path,file_size_bytes,revision_date,created_at").order("created_at",{ascending:false}),
   supabase!.from("sites").select("id,name,state,timezone").order("name"),
   supabase!.from("assets").select("id,site_id,name,asset_tag").order("name")
  ]);
  if(d.error){setError(d.error.message);return}
  if(v.error){setError(v.error.message);return}
  if(s.error){setError(s.error.message);return}
  if(a.error){setError(a.error.message);return}
  setDocuments((d.data||[]) as LibraryDocument[]);
  setVersions((v.data||[]) as LibraryVersion[]);
  setSites((s.data||[]) as LibrarySite[]);
  setAssets((a.data||[]) as LibraryAsset[]);
 }
 useEffect(()=>{void load()},[]);
 const visible=documents.filter(d=>[d.name,d.document_type,d.source_system||"",d.source_reference||"",d.description||""].some(v=>v.toLowerCase().includes(query.toLowerCase())));
 const latestVersion=(docId:string)=>versions.find(v=>v.document_id===docId);
 const set=(key:string,value:string)=>setForm(prev=>({...prev,[key]:value}));
 async function upload(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setMessage("");
  if(!file){setError("Choose a file to upload.");return}
  if(!form.site_id){setError("Choose a site for this document.");return}
  setBusy(true);
  const user=await supabase!.auth.getUser();
  const documentId=crypto.randomUUID();
  const safeName=file.name.replace(/[\\/]+/g,"_").replace(/[^a-zA-Z0-9._-]+/g,"_");
  const path=form.site_id+"/"+documentId+"/"+safeName;
  const stored=await supabase!.storage.from(LIBRARY_BUCKET).upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
  if(stored.error){setError(stored.error.message);setBusy(false);return}
  const created=await supabase!.from("documents").insert({id:documentId,site_id:form.site_id,asset_id:form.asset_id||null,name:form.name.trim()||file.name,document_type:form.document_type,description:form.description.trim()||null,storage_path:path,source_system:form.source_system.trim()||null,source_reference:form.source_reference.trim()||null,created_by:user.data.user?.id}).select("id").single();
  if(created.error){await supabase!.storage.from(LIBRARY_BUCKET).remove([path]);setError(created.error.message);setBusy(false);return}
  const revision=await supabase!.from("document_versions").insert({document_id:documentId,version_label:form.version_label.trim()||"1",storage_path:path,file_size_bytes:file.size,revision_date:form.revision_date||null,uploaded_by:user.data.user?.id});
  if(revision.error){setError("The file was stored, but its revision record could not be saved: "+revision.error.message)}
  else setMessage("Document added to the Technical Library.");
  setFile(null);setForm(prev=>({...prev,asset_id:"",name:"",source_system:"",source_reference:"",version_label:"1",revision_date:"",description:""}));
  await load();setBusy(false);
 }
 async function openFile(doc:LibraryDocument){
  setError("");
  const path=latestVersion(doc.id)?.storage_path||doc.storage_path;
  if(!path){setError("No file is attached to this document.");return}
  const {data,error}=await supabase!.storage.from(LIBRARY_BUCKET).createSignedUrl(path,3600);
  if(error||!data){setError(error?.message||"Could not create a secure document link.");return}
  window.location.assign(data.signedUrl);
 }
 const formatBytes=(n:number|null)=>n==null?"—":n<1024?n+" B":n<1048576?(n/1024).toFixed(0)+" KB":(n/1048576).toFixed(1)+" MB";
 return <div className="library-page">
  <div className="hero"><div><p className="eyebrow">ENGINEERING REFERENCES</p><h1>Technical Library</h1><p className="muted">Store manuals, prints, procedures, specifications, and reliability references with their source and asset context.</p></div></div>
  {error&&<div className="notice error wide">{error}</div>}{message&&<div className="notice wide">{message}</div>}
  <div className="library-layout">
   <form className="panel library-upload" onSubmit={upload}><div className="panel-head"><div><h2>Import a reference</h2><p>Files are private and shared with authorized site members.</p></div><FileUp size={19}/></div>
    <label>Site<select value={form.site_id} onChange={e=>{set("site_id",e.target.value);set("asset_id","")}} required><option value="">Choose a site</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name} · {s.state||"State not set"}</option>)}</select></label>
    <label>Asset (optional)<select value={form.asset_id} onChange={e=>set("asset_id",e.target.value)}><option value="">Site-wide reference</option>{assets.filter(a=>a.site_id===form.site_id).map(a=><option key={a.id} value={a.id}>{a.name} · {a.asset_tag}</option>)}</select></label>
    <label>Document name<input value={form.name} onChange={e=>set("name",e.target.value)} placeholder={file?.name||"e.g. Compressor service manual"}/></label>
    <div className="form-grid"><label>Type<select value={form.document_type} onChange={e=>set("document_type",e.target.value)}>{LIBRARY_TYPES.map(t=><option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}</select></label><label>Source<input value={form.source_system} onChange={e=>set("source_system",e.target.value)} placeholder="OEM, standard, internal…"/></label></div>
    <div className="form-grid"><label>Source reference<input value={form.source_reference} onChange={e=>set("source_reference",e.target.value)} placeholder="Document number or URL"/></label><label>Revision<input value={form.version_label} onChange={e=>set("version_label",e.target.value)} required placeholder="1, Rev A…"/></label></div>
    <label>Revision date<input type="date" value={form.revision_date} onChange={e=>set("revision_date",e.target.value)}/></label>
    <label>Notes<textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="Equipment coverage, standard, or context"/></label>
    <label className="file-picker">File<input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} key={file?.name||"empty"} required/><span>{file?file.name:"Choose any reliability reference file"}</span></label>
    <button className="primary" disabled={busy||!form.site_id||!file}><Upload size={16}/>{busy?"Uploading…":"Add to library"}</button>
   </form>
   <section className="panel library-catalog"><div className="panel-head"><div><h2>Library</h2><p>{visible.length} reference{visible.length===1?"":"s"}</p></div><BookOpen size={19}/></div>
    <div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search documents, sources, references…"/></div>
    {visible.length? <div className="library-list">{visible.map(doc=>{const site=sites.find(s=>s.id===doc.site_id);const asset=assets.find(a=>a.id===doc.asset_id);const ver=latestVersion(doc.id);return <article className="library-item" key={doc.id}><div className="library-item-head"><div><span className="tag">{doc.document_type}</span><h3>{doc.name}</h3></div><button type="button" className="secondary" onClick={()=>void openFile(doc)}><ExternalLink size={15}/> Open</button></div><p>{doc.source_system||"Source not recorded"}{doc.source_reference?" · "+doc.source_reference:""}</p><small>{site?.name||"Site"}{asset?" · "+asset.name:" · Site-wide"}{ver?" · Rev "+ver.version_label:""}{ver?" · "+formatBytes(ver.file_size_bytes):""}</small></article>})}</div>:<div className="empty">No references yet. Import a manual, drawing, print, or other reliability source.</div>}
   </section>
  </div>
 </div>
}

function SectionPage({section}:{section:Section}){const I=section.icon;return <div className="empty-page"><div className="page-icon"><I size={28}/></div><p className="eyebrow">MODULE</p><h1>{section.label}</h1><p className="muted">The navigation is live. This module will be connected to its Supabase records and workflows as we build the platform layer by layer.</p><div className="panel roadmap"><h2>Connected foundation</h2><p>Authentication is live, the database is already structured, and access is controlled by site membership. The next records will plug into this shell without rebuilding the application.</p></div></div>}
