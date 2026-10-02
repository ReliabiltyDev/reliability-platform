import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
 async function load(){const r=await supabase!.from("sites").select("id,name,state,timezone,active").order("name");if(r.error)setError(r.error.message);else setSites(r.data||[])}
 useEffect(()=>{void load()},[]);
 async function add(){
  setError("");setMessage("");
  const user=await supabase!.auth.getUser();
  const code="SITE-"+crypto.randomUUID().slice(0,8).toUpperCase();
  const r=await supabase!.from("sites").insert({code,name:form.name.trim(),state:form.state.trim(),timezone:form.timezone}).select().single();
  if(r.error){setError(r.error.message);return}
  const membership=await supabase!.from("site_memberships").insert({user_id:user.data.user?.id,site_id:r.data.id});
  if(membership.error){setError("Site created, but workspace access could not be added: "+membership.error.message);return}
  setMessage("Site created and added to your access.");
  setForm({name:"",state:"",timezone:"America/Chicago"});
  await load()
 }
 return <div><div className="hero"><div><p className="eyebrow">SHARED WORKSPACE</p><h1>Sites</h1><p className="muted">Sites are shared. Authorized users see the same equipment and references within each site.</p></div></div>{error&&<div className="notice error wide">{error}</div>}{message&&<div className="notice wide">{message}</div>}<div className="two-col"><section className="panel"><div className="panel-head"><div><h2>Add a site</h2><p>Set the location details for an operating site.</p></div></div><div className="form-grid"><label>Site name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Plant name" required/></label><label>State<input value={form.state} onChange={e=>setForm({...form,state:e.target.value})} placeholder="Illinois" required/></label><label>Time zone<select value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})} required>{US_TIME_ZONE_GROUPS.map(group=><optgroup key={group.label} label={group.label}>{group.options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</optgroup>)}</select></label></div><button className="primary" disabled={!form.name.trim()||!form.state.trim()||!form.timezone} onClick={()=>void add()}><Plus size={16}/> Create site</button></section><section className="panel"><div className="panel-head"><div><h2>Accessible sites</h2><p>Shared site records</p></div></div>{sites.length?<div className="list">{sites.map(s=><div className="list-row" key={s.id}><div className="row-copy"><b>{s.name}</b><span>{s.state||"State not set"} · {s.timezone||"Time zone not set"}</span></div><span className="tag">Shared</span></div>)}</div>:<div className="empty">No sites yet.</div>}</section></div></div>
}
