import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://reliabiltydev.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return notFound();

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!projectUrl || !serviceKey) return new Response("Calendar feed unavailable", { status: 503, headers: corsHeaders });

  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const service = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const tokenResult = await service.from("calendar_feed_tokens").select("user_id").eq("token_hash", tokenHash).is("revoked_at", null).maybeSingle();
    if (tokenResult.error || !tokenResult.data) return notFound();

    const visitResult = await service.from("site_visits")
      .select("id,site_id,asset_id,visit_date,scheduled_start,scheduled_end,all_day,purpose,summary,location,updated_at,sites(name,state,timezone),assets(name,asset_tag)")
      .eq("created_by", tokenResult.data.user_id)
      .order("visit_date", { ascending: true });
    if (visitResult.error) return new Response("Calendar feed unavailable", { status: 503, headers: corsHeaders });

    const now = new Date();
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Reliability Workspace//Private Calendar Feed//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Reliability Site Visits",
      "X-PUBLISHED-TTL:PT15M",
      "REFRESH-INTERVAL;VALUE=DURATION:PT15M"
    ];
    for (const visit of visitResult.data || []) {
      const site = relation(visit.sites);
      const asset = relation(visit.assets);
      const title = [visit.purpose || "Site visit", site?.name, asset?.name].filter(Boolean).join(" · ");
      const details = [
        visit.summary ? "Visit notes: " + visit.summary : "",
        site?.name ? "Site: " + site.name : "",
        site?.state ? "State: " + site.state : "",
        site?.timezone ? "Site time zone: " + site.timezone : "",
        asset?.name ? "Asset: " + asset.name + (asset.asset_tag ? " (" + asset.asset_tag + ")" : "") : ""
      ].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        "UID:" + visit.id + "@reliability-workspace",
        "DTSTAMP:" + icalUtc(now),
        "LAST-MODIFIED:" + icalUtc(new Date(visit.updated_at || visit.visit_date)),
        "SUMMARY:" + icalEscape(title),
        "DESCRIPTION:" + icalEscape(details)
      );
      if (visit.all_day || !visit.scheduled_start) {
        lines.push("DTSTART;VALUE=DATE:" + String(visit.visit_date).replace(/-/g, ""));
        lines.push("DTEND;VALUE=DATE:" + addDays(String(visit.visit_date), 1));
      } else {
        const start = new Date(visit.scheduled_start);
        const end = visit.scheduled_end ? new Date(visit.scheduled_end) : new Date(start.getTime() + 3600000);
        lines.push("DTSTART:" + icalUtc(start), "DTEND:" + icalUtc(end));
      }
      const location = [visit.location, site?.name].filter(Boolean).join(", ");
      if (location) lines.push("LOCATION:" + icalEscape(location));
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const headers = new Headers({
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Disposition": "inline; filename=reliability-site-visits.ics",
      "X-Robots-Tag": "noindex, nofollow"
    });
    return new Response(request.method === "HEAD" ? null : lines.join("\r\n") + "\r\n", { status: 200, headers });
  } catch {
    return new Response("Calendar feed unavailable", { status: 503, headers: corsHeaders });
  }
});

function relation<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
function icalUtc(date: Date) { return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function icalEscape(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
function addDays(value: string, days: number) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
function notFound() { return new Response("Calendar not found", { status: 404, headers: corsHeaders }); }
