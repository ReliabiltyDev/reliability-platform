import { useState } from "react";
import type React from "react";
import { Activity, AlertTriangle, BarChart3, CalendarDays, ChevronRight, ClipboardCheck, FileText, Gauge, LayoutDashboard, Menu, PackageSearch, Search, Settings, ShieldCheck, Wrench, X } from "lucide-react";

type Section={id:string;label:string;icon:React.ComponentType<{size?:number}>};
const sections:Section[]=[
{id:"dashboard",label:"Dashboard",icon:LayoutDashboard},
{id:"assets",label:"Assets",icon:PackageSearch},
{id:"reliability",label:"Reliability",icon:Activity},
{id:"maintenance",label:"Maintenance",icon:Wrench},
{id:"visits",label:"Site Visits",icon:ClipboardCheck},
{id:"calendar",label:"Calendar",icon:CalendarDays},
{id:"technical",label:"Technical Library",icon:Gauge},
{id:"documents",label:"Documents",icon:FileText},
{id:"maximo",label:"Maximo",icon:ShieldCheck},
];
const cards=[["Availability","96.4%","Target 95%","up"],["MTBF","182 h","Last 30 days","up"],["MTTR","4.8 h","Last 30 days","down"],["Open Failures","7","2 critical","alert"]];
function App(){
 const [active,setActive]=useState("dashboard"); const [open,setOpen]=useState(false);
 const current=sections.find(s=>s.id===active)!;
 return <div className="app">
  <aside className={open?"sidebar open":"sidebar"}><div className="brand"><div className="mark">R</div><div><strong>Reliability</strong><span>Engineering Platform</span></div><button className="icon mobile-close" onClick={()=>setOpen(false)}><X/></button></div>
   <nav>{sections.map(s=>{const I=s.icon;return <button className={active===s.id?"nav active":"nav"} key={s.id} onClick={()=>{setActive(s.id);setOpen(false)}}><I size={19}/><span>{s.label}</span></button>})}</nav>
   <div className="sidebar-bottom"><button className="nav"><Settings size={19}/><span>Settings</span></button><div className="environment"><span className="dot"/>Demo environment</div></div>
  </aside>
  <main className="main"><header><button className="icon menu-btn" onClick={()=>setOpen(true)}><Menu/></button><div className="crumb"><span>Reliability Platform</span><ChevronRight size={16}/><b>{current.label}</b></div><div className="header-actions"><button className="icon"><Search/></button><div className="avatar">RE</div></div></header>
   <div className="content">{active==="dashboard"?<Dashboard/>:<SectionPage section={current}/>}</div>
  </main>
 </div>
}
function Dashboard(){return <><div className="hero"><div><p className="eyebrow">RELIABILITY OVERVIEW</p><h1>Good morning.</h1><p className="muted">A single place for assets, failures, maintenance, engineering knowledge, and decisions.</p></div><button className="primary"><span>+</span> Log activity</button></div>
 <div className="grid metrics">{cards.map(([name,value,sub,state])=><div className="metric" key={name}><div className="metric-top"><span>{name}</span>{state==="alert"?<AlertTriangle size={17}/>:<BarChart3 size={17}/>}</div><strong>{value}</strong><small>{sub}</small></div>)}</div>
 <div className="two-col"><section className="panel"><div className="panel-head"><div><h2>Reliability focus</h2><p>Items needing engineering attention</p></div><button className="text-btn">View all</button></div><div className="list"><Item icon={<AlertTriangle/>} title="Demo Press" detail="Repeated gearbox temperature alarm" tag="Investigate"/><Item icon={<Wrench/>} title="Open corrective actions" detail="3 actions due this week" tag="3 open"/><Item icon={<Activity/>} title="Availability trend" detail="Stable over the last 30 days" tag="96.4%"/></div></section>
 <section className="panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Latest engineering records</p></div></div><div className="timeline"><div><b>Site visit logged</b><span>Demo Production Area · Today</span></div><div><b>Failure event opened</b><span>Demo Press · Yesterday</span></div><div><b>Technical note added</b><span>Gearbox lubrication · 2 days ago</span></div></div></section></div>
 <section className="panel quick"><div className="panel-head"><div><h2>Start here</h2><p>Common reliability workflows</p></div></div><div className="quick-grid"><Quick title="Find an asset" text="Search the equipment hierarchy"/><Quick title="Log a failure" text="Capture symptoms and downtime"/><Quick title="Create an RCA" text="Turn a recurring problem into a project"/><Quick title="Search technical data" text="Find specifications and source documents"/></div></section></>}
function Item({icon,title,detail,tag}:{icon:React.ReactNode;title:string;detail:string;tag:string}){return <div className="list-row"><div className="row-icon">{icon}</div><div className="row-copy"><b>{title}</b><span>{detail}</span></div><span className="tag">{tag}</span></div>}
function Quick({title,text}:{title:string;text:string}){return <button className="quick-card"><b>{title}</b><span>{text}</span><ChevronRight size={17}/></button>}
function SectionPage({section}:{section:Section}){const I=section.icon;return <div className="empty-page"><div className="page-icon"><I size={28}/></div><p className="eyebrow">MODULE</p><h1>{section.label}</h1><p className="muted">This module is part of the platform foundation. Its data model and workflows will be connected to Supabase next.</p><div className="panel roadmap"><h2>Foundation ready</h2><p>The application is now structured around the reliability workflows we defined: assets, failures, maintenance, visits, technical knowledge, documents, Maximo data, and analytics.</p></div></div>}
export default App;