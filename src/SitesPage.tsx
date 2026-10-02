import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ChevronRight, Plus, ShieldCheck, X } from "lucide-react";
import SiteWorkspace from "./SiteWorkspace";
import { supabase } from "./lib/supabase";

const US_TIME_ZONE_GROUPS = [
 { label: "Eastern", options: [
  ["America/New_York", "New York — most Eastern states"],
  ["America/Detroit", "Detroit — Michigan"],
  ["America/Kentucky/Louisville", "Louisville — Kentucky"],
  ["America/Kentucky/Monticello", "Monticello — Kentucky"],
  ["America/Indiana/Indianapolis", "Indianapolis — Indiana"],
  ["America/Indiana/Vincennes", "Vincennes — Indiana"],
  ["America/Indiana/Winamac", "Winamac — Indiana"],
  ["America/Indiana/Marengo", "Marengo — Indiana"],
  ["America/Indiana/Petersburg", "Petersburg — Indiana"],
  ["America/Indiana/Vevay", "Vevay — Indiana"],
 ]},
 { label: "Central", options: [
  ["America/Chicago", "Chicago — most Central states"],
  ["America/Indiana/Knox", "Knox — Indiana"],
  ["America/Indiana/Tell_City", "Tell City — Indiana"],
  ["America/Menominee", "Menominee — Michigan"],
  ["America/North_Dakota/Center", "Center — North Dakota"],
  ["America/North_Dakota/New_Salem", "New Salem — North Dakota"],
  ["America/North_Dakota/Beulah", "Beulah — North Dakota"],
 ]},
 { label: "Mountain", options: [
  ["America/Denver", "Denver — most Mountain states"],
  ["America/Boise", "Boise — Idaho"],
  ["America/Phoenix", "Phoenix — Arizona"],
 ]},
 { label: "Pacific", options: [
  ["America/Los_Angeles", "Los Angeles — Pacific states"],
 ]},
 { label: "Alaska", options: [
  ["America/Anchorage", "Anchorage — most of Alaska"],
  ["America/Juneau", "Juneau"],
  ["America/Sitka", "Sitka"],
  ["America/Metlakatla", "Metlakatla"],
  ["America/Yakutat", "Yakutat"],
  ["America/Nome", "Nome"],
  ["America/Adak", "Adak — Aleutian Islands"],
 ]},
 { label: "Hawaii", options: [
  ["Pacific/Honolulu", "Honolulu — Hawaii"],
 ]},
 { label: "U.S. territories and outlying islands", options: [
  ["America/Puerto_Rico", "San Juan — Puerto Rico"],
  ["America/St_Thomas", "St. Thomas — U.S. Virgin Islands"],
  ["Pacific/Pago_Pago", "Pago Pago — American Samoa"],
  ["Pacific/Guam", "Hagåtña — Guam"],
  ["Pacific/Saipan", "Saipan — Northern Mariana Islands"],
  ["Pacific/Midway", "Midway Atoll"],
  ["Pacific/Wake", "Wake Island"],
 ]},
] as const;

export default function SitesPage(){
 const [sites,setSites]=useState<any[]>([]);
 const [form,setForm]=useState({name:"",state:"",timezone:"America/Chicago"});
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [selectedSite,setSelectedSite]=useState<any|null>(null);
 const [createOpen,setCreateOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 async function load(){const r=await supabase!.from("sites").select("id,name,state,timezone,active").order("name");if(r.error)setError(r.error.message);else setSites(r.data||[])}
 useEffect(()=>{void load()},[]);
 async function add(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setError("");setMessage("");setBusy(true);
  const auth=await supabase!.auth.getUser();
  if(auth.error||!auth.data.user){setError(auth.error?.message||"Your session could not be confirmed.");setBusy(false);return}
  const code="SITE-"+crypto.randomUUID().slice(0,8).toUpperCase();
  const created=await supabase!.from("sites").insert({code,name:form.name.trim(),state:form.state.trim(),timezone:form.timezone}).select("id,name,state,timezone,active").single();
  if(created.error){setError(created.error.message);setBusy(false);return}
  const membership=await supabase!.from("site_memberships").insert({user_id:auth.data.user.id,site_id:created.data.id});
  if(membership.error){setError("Site created, but workspace access could not be added: "+membership.error.message);await load();setBusy(false);return}
  setMessage("Site created and added to Accessible sites.");
  setForm({name:"",state:"",timezone:"America/Chicago"});
  setCreateOpen(false);
  await load();
  setBusy(false);
 }
 useEffect(()=>{if(!createOpen)return;const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setCreateOpen(false)};window.addEventListener("keydown",closeOnEscape);return()=>window.removeEventListener("keydown",closeOnEscape)},[createOpen]);
 if(selectedSite) return <SiteWorkspace site={selectedSite} onBack={()=>setSelectedSite(null)}/>;
 return <div className="sites-page">
  <div className="hero sites-hero">
   <div><p className="eyebrow">SHARED WORKSPACE</p><h1>Sites</h1><p className="muted">Open a site workspace to see its hierarchy, notes, documents, maintenance, and reliability records.</p></div>
   <button type="button" className="primary sites-create-trigger" onClick={()=>{setError("");setMessage("");setCreateOpen(true)}}><Plus size={16}/> Create site</button>
  </div>
  {error&&<div className="notice error wide">{error}</div>}
  {message&&<div className="notice wide">{message}</div>}
  <section className="panel accessible-sites-panel">
   <div className="panel-head"><div><h2>Accessible sites</h2><p>Select a site to open its complete workspace.</p></div><span className="sites-count">{sites.length} available</span></div>
   {sites.length?<div className="site-entry-list">{sites.map(site=><button type="button" className="site-entry" key={site.id} onClick={()=>setSelectedSite(site)}>
    <span className="site-entry-icon"><ShieldCheck size={20}/></span>
    <span className="row-copy"><b>{site.name}</b><span>{[site.state||"State not set",site.timezone||"Time zone not set"].join(" · ")}</span></span>
    <span className={site.active?"tag":"site-inactive-tag"}>{site.active?"Active":"Inactive"}</span>
    <ChevronRight className="row-chevron" size={18}/>
   </button>)}</div>:<div className="site-entry-empty"><div className="site-entry-icon"><ShieldCheck size={20}/></div><div><b>No accessible sites yet</b><span>Create a site to add it to this workspace.</span></div></div>}
  </section>
  {createOpen&&<div className="site-create-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setCreateOpen(false)}}>
   <section className="panel site-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-site-title">
    <div className="panel-head"><div><h2 id="create-site-title">Create site</h2><p>Add a site to the accessible workspace.</p></div><button type="button" className="icon" onClick={()=>setCreateOpen(false)} aria-label="Close"><X size={18}/></button></div>
    <form className="site-create-form" onSubmit={add}>
     <label>Site name<input value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Plant name" required/></label>
     <label>State<input value={form.state} onChange={event=>setForm({...form,state:event.target.value})} placeholder="Illinois" required/></label>
     <label>Time zone<select value={form.timezone} onChange={event=>setForm({...form,timezone:event.target.value})} required>{US_TIME_ZONE_GROUPS.map(group=><optgroup key={group.label} label={group.label}>{group.options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</optgroup>)}</select></label>
     <div className="site-create-actions"><button type="button" className="secondary" onClick={()=>setCreateOpen(false)}>Cancel</button><button className="primary" type="submit" disabled={busy||!form.name.trim()||!form.state.trim()||!form.timezone}><Plus size={15}/>{busy?"Creating…":"Create site"}</button></div>
    </form>
   </section>
  </div>}
 </div>;
}
