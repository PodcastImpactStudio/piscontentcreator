import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

const T = {
  bg: "#1A1A1A", surface: "#212121", card: "#2A2A2A", cardBorder: "#3A3A3A",
  text: "#FFFFFF", textSecondary: "#CECECE", textMuted: "#FFFFFF",
  coral: "#D97757", coralSoft: "#D9775718", coralMid: "#D9775740",
};

const TIMEZONES = [
  // ── North America ──────────────────────────────────────────────
  ["Pacific/Honolulu",              "Hawaii (HST, UTC-10)"],
  ["America/Anchorage",             "Alaska — Anchorage (AKST, UTC-9)"],
  ["America/Los_Angeles",           "Pacific Time — Los Angeles, Seattle (PT)"],
  ["America/Vancouver",             "Pacific Time — Vancouver, BC (PST/PDT)"],
  ["America/Phoenix",               "Mountain Time — Phoenix, AZ (MST, no DST)"],
  ["America/Denver",                "Mountain Time — Denver, Calgary (MT)"],
  ["America/Chicago",               "Central Time — Chicago, Dallas (CT)"],
  ["America/Mexico_City",           "Central Time — Mexico City (CST)"],
  ["America/New_York",              "Eastern Time — New York, Miami (ET)"],
  ["America/Toronto",               "Eastern Time — Toronto, Ottawa (ET)"],
  ["America/Halifax",               "Atlantic Time — Halifax, Nova Scotia (AT)"],
  ["America/St_Johns",              "Newfoundland Time — St. John's (NT)"],
  // ── Latin America ─────────────────────────────────────────────
  ["America/Bogota",                "Colombia — Bogotá (COT, UTC-5)"],
  ["America/Lima",                  "Peru — Lima (PET, UTC-5)"],
  ["America/Caracas",               "Venezuela — Caracas (VET, UTC-4)"],
  ["America/Santiago",              "Chile — Santiago (CLT)"],
  ["America/Sao_Paulo",             "Brazil — São Paulo (BRT, UTC-3)"],
  ["America/Argentina/Buenos_Aires","Argentina — Buenos Aires (ART, UTC-3)"],
  // ── Europe ────────────────────────────────────────────────────
  ["Europe/London",                 "London, Dublin (GMT/BST)"],
  ["Europe/Lisbon",                 "Lisbon, Porto (WET/WEST)"],
  ["Europe/Paris",                  "Paris, Berlin, Rome, Madrid (CET)"],
  ["Europe/Amsterdam",              "Amsterdam, Brussels, Zurich (CET)"],
  ["Europe/Stockholm",              "Stockholm, Oslo, Copenhagen (CET)"],
  ["Europe/Warsaw",                 "Warsaw, Prague, Budapest (CET)"],
  ["Europe/Helsinki",               "Helsinki, Tallinn, Riga (EET)"],
  ["Europe/Athens",                 "Athens, Bucharest, Sofia (EET)"],
  ["Europe/Moscow",                 "Moscow, St. Petersburg (MSK, UTC+3)"],
  ["Europe/Istanbul",               "Istanbul, Ankara (TRT, UTC+3)"],
  // ── Africa ────────────────────────────────────────────────────
  ["Africa/Casablanca",             "Morocco — Casablanca (WET)"],
  ["Africa/Lagos",                  "West Africa — Lagos, Accra (WAT, UTC+1)"],
  ["Africa/Cairo",                  "Egypt — Cairo (EET, UTC+2)"],
  ["Africa/Johannesburg",           "South Africa — Johannesburg, Cape Town (SAST, UTC+2)"],
  ["Africa/Nairobi",                "East Africa — Nairobi, Kampala (EAT, UTC+3)"],
  // ── Middle East ───────────────────────────────────────────────
  ["Asia/Riyadh",                   "Saudi Arabia — Riyadh, Jeddah (AST, UTC+3)"],
  ["Asia/Dubai",                    "UAE — Dubai, Abu Dhabi (GST, UTC+4)"],
  ["Asia/Kolkata",                  "India — Mumbai, Delhi, Bangalore (IST, UTC+5:30)"],
  ["Asia/Karachi",                  "Pakistan — Karachi, Lahore (PKT, UTC+5)"],
  ["Asia/Dhaka",                    "Bangladesh — Dhaka (BST, UTC+6)"],
  // ── Asia ──────────────────────────────────────────────────────
  ["Asia/Bangkok",                  "Southeast Asia — Bangkok, Jakarta (ICT, UTC+7)"],
  ["Asia/Singapore",                "Singapore, Kuala Lumpur (SGT, UTC+8)"],
  ["Asia/Shanghai",                 "China — Beijing, Shanghai (CST, UTC+8)"],
  ["Asia/Hong_Kong",                "Hong Kong (HKT, UTC+8)"],
  ["Asia/Taipei",                   "Taiwan — Taipei (CST, UTC+8)"],
  ["Asia/Manila",                   "Philippines — Manila (PHT, UTC+8)"],
  ["Asia/Seoul",                    "South Korea — Seoul (KST, UTC+9)"],
  ["Asia/Tokyo",                    "Japan — Tokyo, Osaka (JST, UTC+9)"],
  // ── Australia & Pacific ───────────────────────────────────────
  ["Australia/Perth",               "Western Australia — Perth (AWST, UTC+8)"],
  ["Australia/Darwin",              "Northern Territory — Darwin (ACST, UTC+9:30)"],
  ["Australia/Adelaide",            "South Australia — Adelaide (ACST)"],
  ["Australia/Brisbane",            "Queensland — Brisbane (AEST, UTC+10)"],
  ["Australia/Sydney",              "NSW — Sydney, Melbourne, Canberra (AEST)"],
  ["Pacific/Auckland",              "New Zealand — Auckland, Wellington (NZST, UTC+12)"],
  ["Pacific/Fiji",                  "Fiji (FJT, UTC+12)"],
];

const inp = {
  width: "100%", background: T.surface, border: "1px solid " + T.cardBorder,
  borderRadius: "8px", padding: "11px 14px", color: T.text,
  fontSize: "15px", outline: "none", boxSizing: "border-box",
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

export default function Profile({ user, onClose, onSignOut }) {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [timezone, setTimezone] = useState("America/Vancouver");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("profile");

  useEffect(() => {
    supabase.from("profiles").select("name, timezone, org_id").eq("id", user.id).single()
      .then(async ({ data }) => {
        if (data) {
          setName(data.name || "");
          setTimezone(data.timezone || "America/Vancouver");
          setOrgId(data.org_id || null);
          if (data.org_id) {
            const { data: org } = await supabase.from("organizations")
              .select("name").eq("id", data.org_id).single();
            setCompanyName(org?.name || "");
          }
        }
      });
  }, [user.id]);

  async function saveProfile() {
    if (!name.trim()) { setMsg("Name is required."); return; }
    setSaving(true); setMsg("");
    try {
      const { error } = await supabase.from("profiles")
        .update({ name: name.trim(), timezone })
        .eq("id", user.id);
      if (error) throw error;
      if (orgId && companyName.trim()) {
        const { error: orgErr } = await supabase.from("organizations")
          .update({ name: companyName.trim() })
          .eq("id", orgId);
        if (orgErr) throw orgErr;
      }
      setMsg("✓ Profile saved");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (password.length < 8) { setMsg("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setMsg("Passwords don't match."); return; }
    setSaving(true); setMsg("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirm("");
      setMsg("✓ Password updated");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  const tzLabel = TIMEZONES.find(([v]) => v === timezone)?.[1] || timezone;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", width: "100%", maxWidth: "480px", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.cardBorder, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>My Account</div>
            <div style={{ fontSize: "13px", color: T.textMuted, marginTop: "2px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{user.email}</div>
          </div>
          <button onClick={onClose} style={{ padding: "6px 12px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "13px", cursor: "pointer" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid " + T.cardBorder }}>
          {[["profile", "Profile"], ["password", "Password"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: "12px 20px", background: "transparent", border: "none", borderBottom: tab === id ? "2px solid " + T.coral : "2px solid transparent", color: tab === id ? T.coral : T.textMuted, fontSize: "14px", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: tab === id ? "700" : "500" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>
          {tab === "profile" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, display: "block", marginBottom: "8px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inp} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, display: "block", marginBottom: "8px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Company Name <span style={{ textTransform: "none", letterSpacing: "0", opacity: 0.6 }}>(optional)</span></label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your business or agency name" style={inp} />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, display: "block", marginBottom: "8px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <div style={{ fontSize: "12px", color: T.textMuted, marginTop: "6px", fontStyle: "italic", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  Publish schedules will display in {tzLabel}.
                </div>
              </div>
              {msg && <div style={{ fontSize: "14px", color: msg.startsWith("✓") ? "#52B788" : "#F09090", marginBottom: "12px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{msg}</div>}
              <button onClick={saveProfile} disabled={saving}
                style={{ padding: "12px 24px", background: T.coral, border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          )}
          {tab === "password" && (
            <div>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, display: "block", marginBottom: "8px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={inp} />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, display: "block", marginBottom: "8px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && changePassword()} placeholder="Confirm new password" style={inp} />
              </div>
              {msg && <div style={{ fontSize: "14px", color: msg.startsWith("✓") ? "#52B788" : "#F09090", marginBottom: "12px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{msg}</div>}
              <button onClick={changePassword} disabled={saving}
                style={{ padding: "12px 24px", background: T.coral, border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                {saving ? "Updating..." : "Update Password"}
              </button>
            </div>
          )}
        </div>

        {/* Sign out */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid " + T.cardBorder }}>
          <button onClick={onSignOut}
            style={{ padding: "10px 20px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
