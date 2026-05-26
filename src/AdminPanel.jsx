import { useState, useRef, useEffect } from "react";
import { saveShow } from "./lib/shows";
import { supabase } from "./lib/supabase";
import mammoth from "mammoth";

async function claudeAPI(body) {
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data.error || data));
  return data;
}

const T = {
  bg: "#F5F0E8", surface: "#FDFAF5", card: "#FFFFFF", cardBorder: "#E2D9CC",
  text: "#1A1A1A", textSecondary: "#4A3F35", textMuted: "#6B5E52",
  coral: "#C41230", coralSoft: "#C4123010", coralMid: "#C4123028",
};
const FF = "'DM Sans', system-ui, sans-serif";
const PF = "'DM Sans', system-ui, sans-serif";
const LS = { fontFamily: FF };
const GA = { fontFamily: FF };

// Platform hub structure
export const PLATFORM_CATEGORIES = [
  { id: "podcast", label: "Podcast Hosting", description: "Where your RSS feed is hosted", platforms: ["Spotify for Creators", "Buzzsprout", "Libsyn", "Podbean", "Captivate", "Transistor", "RSS.com", "Simplecast", "Castos"] },
  { id: "social", label: "Social Media", description: "Platform-optimized posts for each selected", platforms: ["YouTube", "Instagram", "Facebook", "TikTok", "LinkedIn", "X (Twitter)", "Pinterest", "Threads", "Reddit"] },
  { id: "community", label: "Community Platform", description: "Companion post, feed prompts, polls, conversation starters", platforms: ["Patreon", "Circle", "Mighty Networks", "Kajabi", "Skool", "Facebook Group"], single: true },
  { id: "email", label: "Email & Newsletter", description: "Subject, preview, body, CTA, FAQ section", platforms: ["Newsletter"] },
  { id: "blog", label: "Web & Blog", description: "Full blog post with SEO meta and FAQ schema", platforms: ["Blog Article"] },
  { id: "extras", label: "Social Media Content Add-Ons", description: "Additional content assets generated from each episode", platforms: ["Quote Cards", "Poll Questions", "Story Slides", "Engagement Prompts", "Guest Kit", "Key Takeaway Graphics"] },
];

export const DEFAULT_PLATFORMS = {
  podcast: [],
  social: ["YouTube", "Instagram", "Facebook"],
  community: [],
  email: ["Newsletter"],
  blog: [],
  extras: [],
};

const DEFAULT_SN_ELEMENTS = [
  { id: "hook",         label: "Hook Question",        enabled: true,  text: "" },
  { id: "description",  label: "Episode Description",  enabled: true,  text: "" },
  { id: "takeaways",    label: "Key Takeaways",        enabled: true,  text: "" },
  { id: "quote",        label: "Notable Quote",        enabled: false, text: "" },
  { id: "guest_bio",    label: "Guest Bio",            enabled: false, text: "" },
  { id: "resources",    label: "Resources & Links",    enabled: false, text: "" },
  { id: "timestamps",   label: "Timestamps",           enabled: false, text: "", hasScope: true, scope: "youtube" },
  { id: "boilerplate",  label: "Boilerplate",          enabled: true,  text: "" },
  { id: "disclaimer",   label: "Custom Disclaimer",    enabled: false, text: "", hasText: true, textLabel: "Disclaimer text", textPlaceholder: "Enter the disclaimer text to append..." },
  { id: "custom_instructions", label: "Custom Instructions", enabled: false, text: "", header: "", hasText: true, hasHeader: true, textLabel: "Instructions for AI", textPlaceholder: "e.g. Identify specialized terms and define them.", headerPlaceholder: "e.g. Definitions, Key Terms" },
];

function lbl(extra) { return { fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", color: T.textSecondary, marginBottom: "8px", display: "block", ...LS, ...(extra||{}) }; }
function fld(extra) { return { width: "100%", background: T.surface, border: "1px solid " + T.cardBorder, borderRadius: "6px", padding: "10px 14px", color: T.text, fontSize: "16px", outline: "none", boxSizing: "border-box", ...GA, ...(extra||{}) }; }

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <div style={{ fontSize: "20px", color: T.coral, marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid " + T.cardBorder, fontFamily: PF, fontWeight: "600" }}>{title}</div>
      {children}
    </div>
  );
}
function Fld({ label: l, children }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={lbl()}>{l}</label>
      {children}
    </div>
  );
}

function PlatformHub({ platforms, onChange }) {
  const [customCommunity, setCustomCommunity] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  function isSelected(catId, p) {
    return (platforms[catId] || []).includes(p);
  }
  function toggle(catId, p, single) {
    const current = platforms[catId] || [];
    let next;
    if (single) {
      next = current.includes(p) ? [] : [p];
    } else {
      next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
    }
    onChange({ ...platforms, [catId]: next });
  }
  function addCustomPlatform() {
    const name = customCommunity.trim();
    if (!name) return;
    onChange({ ...platforms, community: [name] });
    setCustomCommunity(""); setAddingCustom(false);
  }

  return (
    <div>
      {PLATFORM_CATEGORIES.map(cat => (
        <div key={cat.id} style={{ marginBottom: "24px" }}>
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", color: T.coral, fontWeight: "700", ...LS }}>{cat.label}</div>
            <div style={{ fontSize: "13px", color: T.textMuted, ...GA, fontStyle: "italic", marginTop: "2px" }}>{cat.description}{cat.single ? " — select one" : ""}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {cat.platforms.map(p => {
              const selected = isSelected(cat.id, p);
              return (
                <button key={p} onClick={() => toggle(cat.id, p, cat.single)}
                  style={{ padding: "8px 16px", background: selected ? T.coralSoft : T.card, border: "1px solid " + (selected ? T.coral : T.cardBorder), borderRadius: "6px", color: selected ? T.text : T.textSecondary, fontSize: "14px", cursor: "pointer", ...LS, fontWeight: selected ? "700" : "400", transition: "all .15s" }}>
                  {selected ? "✓ " : ""}{p}
                </button>
              );
            })}
            {/* Custom community platform option */}
            {cat.id === "community" && (() => {
              const current = platforms.community || [];
              const customVal = current.find(c => !cat.platforms.includes(c));
              if (customVal) {
                return (
                  <button onClick={() => onChange({ ...platforms, community: [] })}
                    style={{ padding: "8px 16px", background: T.coralSoft, border: "1px solid " + T.coral, borderRadius: "6px", color: T.text, fontSize: "14px", cursor: "pointer", ...LS, fontWeight: "700" }}>
                    ✓ {customVal} ✕
                  </button>
                );
              }
              if (addingCustom) {
                return (
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      autoFocus
                      value={customCommunity}
                      onChange={e => setCustomCommunity(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addCustomPlatform(); if (e.key === "Escape") setAddingCustom(false); }}
                      placeholder="Platform name..."
                      style={{ padding: "8px 12px", background: T.surface, border: "1px solid " + T.coral, borderRadius: "6px", color: T.text, fontSize: "14px", outline: "none", width: "160px", fontFamily: FF }}
                    />
                    <button onClick={addCustomPlatform} style={{ padding: "8px 14px", background: T.coral, border: "none", borderRadius: "6px", color: "#fff", fontSize: "13px", cursor: "pointer", fontFamily: FF }}>Add</button>
                    <button onClick={() => setAddingCustom(false)} style={{ padding: "8px 10px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "13px", cursor: "pointer", fontFamily: FF }}>✕</button>
                  </div>
                );
              }
              return (
                <button onClick={() => setAddingCustom(true)}
                  style={{ padding: "8px 16px", background: "transparent", border: "1px dashed " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "14px", cursor: "pointer", ...LS }}>
                  + Custom Platform
                </button>
              );
            })()}
          </div>
          {(platforms[cat.id] || []).length > 0 && (
            <div style={{ fontSize: "12px", color: T.textMuted, marginTop: "6px", ...LS, letterSpacing: "1px" }}>
              SELECTED: {(platforms[cat.id] || []).join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SNBuilder({ elements, onChange }) {
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  function toggle(id) { onChange(elements.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e)); }
  function onDragStart(e, idx) { setDragging(idx); e.dataTransfer.effectAllowed = "move"; }
  function onDragOver(e, idx) { e.preventDefault(); setDragOver(idx); }
  function onDrop(e, idx) {
    e.preventDefault();
    if (dragging === null || dragging === idx) { setDragging(null); setDragOver(null); return; }
    const next = [...elements];
    const [moved] = next.splice(dragging, 1);
    next.splice(idx, 0, moved);
    onChange(next);
    setDragging(null); setDragOver(null);
  }
  return (
    <div>
      <div style={{ fontSize: "14px", color: T.textSecondary, marginBottom: "12px", ...GA }}>Toggle on/off · Drag to reorder</div>
      {elements.map((el, idx) => (
        <div key={el.id} style={{ marginBottom: "8px" }}>
          <div draggable
            onDragStart={e => onDragStart(e, idx)} onDragOver={e => onDragOver(e, idx)}
            onDrop={e => onDrop(e, idx)} onDragEnd={() => { setDragging(null); setDragOver(null); }}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: dragOver === idx ? T.coralSoft : T.card, border: "1px solid " + (dragOver === idx ? T.coral : T.cardBorder), borderRadius: el.enabled && (el.hasText || el.hasScope) ? "6px 6px 0 0" : "6px", cursor: "grab", opacity: dragging === idx ? 0.4 : 1 }}>
            <span style={{ color: T.textSecondary }}>⠿</span>
            <div onClick={() => toggle(el.id)} style={{ width: "36px", height: "20px", background: el.enabled ? T.coral : T.cardBorder, borderRadius: "10px", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background .2s" }}>
              <div style={{ position: "absolute", top: "3px", left: el.enabled ? "19px" : "3px", width: "14px", height: "14px", background: "#fff", borderRadius: "50%", transition: "left .2s" }} />
            </div>
            <span style={{ fontSize: "15px", color: el.enabled ? T.text : T.textSecondary, ...LS, fontWeight: el.enabled ? "600" : "400" }}>{el.label}</span>
            <span style={{ marginLeft: "auto", fontSize: "13px", color: T.textSecondary, ...LS }}>{idx + 1}</span>
          </div>
          {el.enabled && el.hasScope && (
            <div style={{ background: T.surface, border: "1px solid " + T.cardBorder, borderTop: "none", borderRadius: "0 0 6px 6px", padding: "12px 14px" }}>
              <label style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, marginBottom: "8px", display: "block", ...LS }}>Include Timestamps In</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[{v:"youtube",l:"YouTube Only"},{v:"both",l:"Show Notes + YouTube"}].map(opt => (
                  <button key={opt.v} onClick={() => onChange(elements.map((x,i) => i===idx ? {...x, scope: opt.v} : x))}
                    style={{ padding: "7px 16px", background: (el.scope||"youtube")===opt.v ? T.coralSoft : T.card, border: "1px solid " + ((el.scope||"youtube")===opt.v ? T.coral : T.cardBorder), borderRadius: "6px", color: (el.scope||"youtube")===opt.v ? T.text : T.textSecondary, fontSize: "13px", cursor: "pointer", ...LS, fontWeight: (el.scope||"youtube")===opt.v ? "700" : "400" }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          )}
          {el.enabled && el.hasText && (
            <div style={{ background: T.surface, border: "1px solid " + T.cardBorder, borderTop: "none", borderRadius: "0 0 6px 6px", padding: "12px 14px" }}>
              {el.hasHeader && (
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, marginBottom: "6px", display: "block", ...LS }}>Section Header</label>
                  <input style={{ ...fld(), padding: "8px 12px", fontSize: "14px" }} placeholder={el.headerPlaceholder || "Section heading..."} value={el.header || ""} onChange={e => onChange(elements.map((x,i) => i===idx ? {...x, header: e.target.value} : x))} />
                </div>
              )}
              <label style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, marginBottom: "6px", display: "block", ...LS }}>{el.textLabel || "Text"}</label>
              <textarea style={{ ...fld(), minHeight: "80px", resize: "vertical", padding: "8px 12px", fontSize: "14px", lineHeight: "1.6" }} placeholder={el.textPlaceholder || "Enter text..."} value={el.text || ""} onChange={e => onChange(elements.map((x,i) => i===idx ? {...x, text: e.target.value} : x))} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BoilerplateEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const savedRange = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  function saveSelection() { const sel = window.getSelection(); if (sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange(); }
  function restoreSelection() { if (savedRange.current) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange.current); } }
  function exec(cmd) { editorRef.current?.focus(); document.execCommand(cmd, false, null); handleChange(); }
  function handleChange() { if (editorRef.current) onChange(editorRef.current.innerHTML); }

  function handlePaste(e) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html) {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      tmp.querySelectorAll("*").forEach(el => {
        el.style.color = ""; el.style.backgroundColor = ""; el.style.background = "";
        el.style.fontSize = ""; el.style.fontFamily = "";
        if (el.tagName === "A") { el.style.color = "#C41230"; el.style.textDecoration = "underline"; }
      });
      const clean = tmp.innerHTML.replace(/<span[^>]*>/gi, "<span>").replace(/<p[^>]*>/gi, "").replace(/<\/p>/gi, "<br>").replace(/<div[^>]*>/gi, "").replace(/<\/div>/gi, "<br>").replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>");
      document.execCommand("insertHTML", false, clean);
    } else { document.execCommand("insertText", false, text); }
    handleChange();
  }

  function insertLink() {
    restoreSelection();
    if (linkUrl && linkText) document.execCommand("insertHTML", false, '<a href="' + linkUrl + '" style="color:#C41230">' + linkText + '</a>');
    else if (linkUrl) document.execCommand("createLink", false, linkUrl);
    setShowLink(false); setLinkUrl(""); setLinkText(""); handleChange();
  }

  const btnS = { padding: "5px 10px", background: T.surface, border: "1px solid " + T.cardBorder, borderRadius: "4px", color: T.textSecondary, fontSize: "13px", cursor: "pointer", ...LS, fontWeight: "600" };

  return (
    <div style={{ border: "1px solid " + T.cardBorder, borderRadius: "6px", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: "4px", padding: "8px 10px", background: T.surface, borderBottom: "1px solid " + T.cardBorder, flexWrap: "wrap", alignItems: "center" }}>
        <button onMouseDown={e => { e.preventDefault(); exec("bold"); }} style={btnS}><strong>B</strong></button>
        <button onMouseDown={e => { e.preventDefault(); exec("italic"); }} style={btnS}><em>I</em></button>
        <div style={{ width: "1px", height: "20px", background: T.cardBorder, margin: "0 4px" }} />
        <button onMouseDown={e => { e.preventDefault(); saveSelection(); setShowLink(true); }} style={btnS}>Link</button>
        <button onMouseDown={e => { e.preventDefault(); exec("unlink"); }} style={btnS}>Unlink</button>
        <div style={{ marginLeft: "auto", fontSize: "12px", color: T.textMuted, ...LS, letterSpacing: "1px" }}>PASTE FROM WORD / GOOGLE DOCS</div>
      </div>
      {showLink && (
        <div style={{ display: "flex", gap: "8px", padding: "8px 10px", background: T.coralSoft, borderBottom: "1px solid " + T.coral + "33", flexWrap: "wrap", alignItems: "center" }}>
          <input value={linkText} onChange={e => setLinkText(e.target.value)} placeholder="Link text (optional)" style={{ ...fld(), flex: 1, minWidth: "140px", padding: "6px 10px", fontSize: "13px" }} />
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." style={{ ...fld(), flex: 2, minWidth: "200px", padding: "6px 10px", fontSize: "13px" }} onKeyDown={e => e.key === "Enter" && insertLink()} />
          <button onClick={insertLink} style={{ padding: "6px 16px", background: T.coral, border: "none", borderRadius: "4px", color: "#fff", fontSize: "13px", cursor: "pointer", ...LS, fontWeight: "700" }}>Insert</button>
          <button onClick={() => { setShowLink(false); setLinkUrl(""); setLinkText(""); }} style={{ padding: "6px 12px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "4px", color: T.textMuted, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
        </div>
      )}
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={handleChange} onPaste={handlePaste} onMouseUp={saveSelection} onKeyUp={saveSelection}
        style={{ minHeight: "280px", padding: "16px 18px", color: T.text, fontSize: "15px", lineHeight: "1.8", outline: "none", ...GA, background: T.card, whiteSpace: "pre-wrap", wordBreak: "break-word", caretColor: T.text, border: "1px solid " + T.cardBorder, borderRadius: "8px" }}
        data-placeholder="Paste your boilerplate here..."
      />
      <style>{`[contenteditable]:empty:before{content:attr(data-placeholder);color:#999;pointer-events:none}[contenteditable]{color:#1A1A1A!important}[contenteditable] a{color:#C41230!important;text-decoration:underline}`}</style>
    </div>
  );
}


const GDRIVE_KEY = "pis_gdrive_connection";
const GDRIVE_CLIENT_ID = "309593338972-c8beqv97mqtea8l34oiricdugsi26krh.apps.googleusercontent.com";
function getStoredGDrive() {
  try {
    const s = localStorage.getItem(GDRIVE_KEY);
    if (!s) return null;
    const p = JSON.parse(s);
    if (Date.now() > p.expires_at) { localStorage.removeItem(GDRIVE_KEY); return null; }
    return p;
  } catch { return null; }
}

function SettingsView({ globalSettings, setGlobalSettings, saveGlobalSettings, globalSettingsSaved, globalSettingsLoading, orgId, accountType, userEmail, orgData, setOrgData, saveOrgData, orgDataSaved }) {
  const [activeSection, setActiveSection] = useState("integrations");
  const [team, setTeam] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [addingMember, setAddingMember] = useState(false);
  const [newMember, setNewMember] = useState({ email: "", role: "editor" });
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [gConnected, setGConnected] = useState(false);
  const [gConnecting, setGConnecting] = useState(false);
  const gTokenClientRef = useRef(null);

  useEffect(() => {
    setGConnected(!!getStoredGDrive());
  }, []);

  function connectGoogleDrive() {
    setGConnecting(true);
    if (!gTokenClientRef.current) {
      gTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (resp) => {
          setGConnecting(false);
          if (resp.error) return;
          const stored = { access_token: resp.access_token, expires_at: Date.now() + ((resp.expires_in || 3600) * 1000) };
          localStorage.setItem(GDRIVE_KEY, JSON.stringify(stored));
          setGConnected(true);
        },
      });
    }
    gTokenClientRef.current.requestAccessToken({ prompt: "select_account" });
  }

  function disconnectGoogleDrive() {
    localStorage.removeItem(GDRIVE_KEY);
    setGConnected(false);
  }

  useEffect(() => {
    async function loadTeam() {
      setTeamLoading(true);
      try {
        const r = await fetch(`/api/users?orgId=${orgId}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        const savedTeam = globalSettings.team || [];
        const merged = data.users.map(u => {
          const saved = savedTeam.find(m => m.email?.toLowerCase() === u.email?.toLowerCase());
          return {
            id: u.id,
            email: u.email,
            name: saved?.name || u.name || u.email,
            role: saved?.role || "Editor",
          };
        });
        setTeam(merged);
      } catch {
        setTeam(globalSettings.team || []);
      } finally {
        setTeamLoading(false);
      }
    }
    loadTeam();
  }, []);

  async function sendInvite() {
    if (!newMember.email.trim()) { setInviteMsg("Please enter an email address."); return; }
    setInviting(true); setInviteMsg("");
    try {
      const r = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMember.email.trim().toLowerCase(), role: newMember.role, orgId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to send invite.");
      setInviteMsg("✓ Invite sent to " + newMember.email);
      setNewMember({ email: "", role: "editor" });
      setTimeout(() => { setAddingMember(false); setInviteMsg(""); }, 2500);
    } catch (e) {
      setInviteMsg("Error: " + e.message);
    } finally {
      setInviting(false);
    }
  }

  const sections = [
    { id: "integrations", label: "Integrations", icon: "🔌" },
    { id: "workspace", label: "Workspace", icon: "🏢" },
    ...(accountType === "agency" ? [{ id: "team", label: "Team", icon: "👥" }] : []),
    ...(accountType === "agency" ? [{ id: "codes", label: "Access Codes", icon: "🔑" }] : []),
    { id: "billing", label: "Billing", icon: "💳" },
  ];

  const inp = { width: "100%", background: T.surface, border: "1px solid " + T.cardBorder, borderRadius: "6px", padding: "10px 14px", color: T.text, fontSize: "16px", outline: "none", boxSizing: "border-box", fontFamily: FF };

  function SaveBtn({ onClick }) {
    return (
      <button onClick={onClick || (() => saveGlobalSettings(globalSettings))}
        style={{ padding: "10px 24px", background: T.coral, border: "none", borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", letterSpacing: "1px", textTransform: "uppercase" }}>
        {globalSettingsSaved ? "✓ Saved" : globalSettingsLoading ? "Saving..." : "Save"}
      </button>
    );
  }

  function saveTeam(updatedTeam) {
    setTeam(updatedTeam);
    saveGlobalSettings({ ...globalSettings, team: updatedTeam });
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div style={{ width: "200px", background: T.surface, borderRight: "1px solid " + T.cardBorder, flexShrink: 0, padding: "16px 8px" }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: activeSection === s.id ? T.coralSoft : "transparent", border: "none", borderRadius: "6px", color: activeSection === s.id ? T.coral : T.textSecondary, fontSize: "14px", cursor: "pointer", textAlign: "left", marginBottom: "2px", fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: activeSection === s.id ? "700" : "500", transition: "all .15s" }}>
            <span>{s.icon}</span><span>{s.label}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>

        {activeSection === "integrations" && (
          <div style={{ maxWidth: "680px" }}>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "28px", fontWeight: "600", color: T.text, marginBottom: "6px", fontFamily: PF }}>Integrations</div>
              <div style={{ fontSize: "15px", color: T.textMuted, fontFamily: FF }}>Connect external tools to enhance your workflow.</div>
            </div>
            <div style={{ background: T.card, border: "1px solid " + (gConnected ? "#52B78844" : T.cardBorder), borderRadius: "12px", marginBottom: "16px", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.cardBorder, display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "22px" }}>📁</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: T.text }}>Google Drive</div>
                  <div style={{ fontSize: "13px", color: T.textMuted, fontStyle: "italic" }}>Export content packages directly to Google Drive as formatted Google Docs.</div>
                </div>
                {gConnected && (
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#52B788" }} />
                    <span style={{ fontSize: "12px", color: "#52B788", fontWeight: "600" }}>Connected</span>
                  </div>
                )}
              </div>
              <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                {gConnected ? (
                  <>
                    <div style={{ fontSize: "14px", color: T.textSecondary, fontFamily: FF }}>
                      Your Google account is connected. Click <strong>Export to Google Drive</strong> on any content package to save it directly as a Google Doc.
                    </div>
                    <button onClick={disconnectGoogleDrive} style={{ padding: "8px 16px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "13px", cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap" }}>Disconnect</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "14px", color: T.textSecondary, fontFamily: FF }}>
                      Connect your Google account once — then export any content package straight to Google Drive with one click.
                    </div>
                    <button onClick={connectGoogleDrive} disabled={gConnecting} style={{ padding: "10px 20px", background: T.coral, border: "none", borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap", opacity: gConnecting ? 0.6 : 1 }}>
                      {gConnecting ? "Connecting…" : "Connect Google Account"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", marginBottom: "16px" }}>
              <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "22px" }}>🔮</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: T.text }}>Anthropic (Claude)</div>
                  <div style={{ fontSize: "13px", color: T.textMuted, fontStyle: "italic" }}>Powers all AI content generation.</div>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#52B788" }} />
                  <span style={{ fontSize: "12px", color: T.textMuted }}>Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "workspace" && (
          <div style={{ maxWidth: "680px" }}>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "28px", fontWeight: "600", color: T.text, marginBottom: "6px", fontFamily: PF }}>Workspace</div>
              <div style={{ fontSize: "15px", color: T.textMuted, fontStyle: "italic" }}>Configure your production workspace.</div>
            </div>

            {/* Workspace details */}
            <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, marginBottom: "6px", display: "block" }}>Workspace Name</label>
                <input value={orgData.name} onChange={e => setOrgData(d => ({ ...d, name: e.target.value }))} placeholder="Your business or podcast name" style={{ ...inp, marginBottom: "14px" }} />
                <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, marginBottom: "6px", display: "block" }}>Website</label>
                <input value={orgData.website} onChange={e => setOrgData(d => ({ ...d, website: e.target.value }))} placeholder="https://yourwebsite.com" style={{ ...inp, marginBottom: "14px" }} />
                <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, marginBottom: "6px", display: "block" }}>Account Email</label>
                <div style={{ ...inp, marginBottom: "20px", background: T.bg, color: T.textMuted, cursor: "default", display: "flex", alignItems: "center" }}>{userEmail || "—"}</div>
                <button onClick={saveOrgData} style={{ padding: "10px 24px", background: T.coral, border: "none", borderRadius: "8px", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: FF }}>
                  {orgDataSaved ? "✓ Saved" : "Save"}
                </button>
              </div>
            </div>

            {/* Your Plan */}
            <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", padding: "24px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700", color: T.text, marginBottom: "4px", fontFamily: PF }}>Your Plan</div>
              <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "20px" }}>
                {accountType === "solo" ? "Solo Podcaster — up to 3 shows, 1 seat" : "Production Company — up to 10 shows, 5 seats"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", background: T.coralSoft, border: "1px solid " + T.coralMid, borderRadius: "10px", marginBottom: "16px" }}>
                <div style={{ fontSize: "28px" }}>{accountType === "solo" ? "🎙️" : "🏢"}</div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: T.coral, fontFamily: PF }}>{accountType === "solo" ? "Solo Podcaster" : "Production Company"}</div>
                  <div style={{ fontSize: "13px", color: T.textSecondary, marginTop: "2px" }}>
                    {accountType === "solo" ? "$19.99/month · 3 shows · 1 seat" : "$69/month · 10 shows · 5 seats"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", background: T.coral, color: "#fff", fontSize: "11px", fontWeight: "700", letterSpacing: "1px", padding: "4px 10px", borderRadius: "20px" }}>CURRENT</div>
              </div>
              {accountType === "solo" ? (
                <div>
                  <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "12px" }}>
                    Need more shows or team seats? Upgrade to Production Company for $69/month.
                  </div>
                  <a href="mailto:info@podcastimpactstudio.com?subject=Upgrade to Production Company" style={{ display: "inline-block", padding: "10px 20px", background: T.coral, color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "700", textDecoration: "none", fontFamily: FF }}>
                    Upgrade to Production Company →
                  </a>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "12px" }}>
                    Want to switch to the Solo plan? Email us and we'll sort it out.
                  </div>
                  <a href="mailto:info@podcastimpactstudio.com?subject=Switch to Solo Plan" style={{ display: "inline-block", padding: "10px 20px", background: "transparent", border: "1px solid " + T.cardBorder, color: T.textSecondary, borderRadius: "8px", fontSize: "13px", fontWeight: "700", textDecoration: "none", fontFamily: FF }}>
                    Contact us to downgrade
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === "team" && (
          <div style={{ maxWidth: "680px" }}>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "28px", fontWeight: "600", color: T.text, marginBottom: "6px", fontFamily: PF }}>Team</div>
              <div style={{ fontSize: "15px", color: T.textMuted, fontStyle: "italic" }}>Manage who has access to this workspace.</div>
            </div>
            <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid " + T.cardBorder }}>
                <div style={{ fontSize: "15px", fontWeight: "700", color: T.text }}>Team Members</div>
              </div>
              <div style={{ padding: "0 24px" }}>
                {teamLoading ? (
                  <div style={{ padding: "24px 0", color: T.textMuted, fontSize: "14px", textAlign: "center" }}>Loading team members...</div>
                ) : team.map((member, i) => (
                  <div key={i}>
                    {editingIdx === i ? (
                      <div style={{ padding: "14px 0", borderBottom: i < team.length - 1 ? "1px solid " + T.cardBorder : "none" }}>
                        <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                          <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" style={{ ...inp, flex: 1, minWidth: "130px" }} />
                          <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" style={{ ...inp, flex: 2, minWidth: "180px" }} />
                          <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={{ ...inp, cursor: "pointer" }} disabled={editForm.role === "Owner"}>
                            <option>Owner</option><option>Editor</option><option>Viewer</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => { saveTeam(team.map((m, idx) => idx === i ? editForm : m)); setEditingIdx(null); }} style={{ padding: "6px 16px", background: T.coral, border: "none", borderRadius: "6px", color: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Save</button>
                          <button onClick={() => setEditingIdx(null)} style={{ padding: "6px 12px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "12px", cursor: "pointer" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 0", borderBottom: i < team.length - 1 ? "1px solid " + T.cardBorder : "none" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: T.coralSoft, border: "1px solid " + T.coralMid, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: T.coral, flexShrink: 0 }}>{member.name.charAt(0)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: "600", color: T.text }}>{member.name}</div>
                          <div style={{ fontSize: "13px", color: T.textMuted }}>{member.email}</div>
                        </div>
                        <span style={{ fontSize: "11px", padding: "3px 10px", background: member.role === "Owner" ? T.coralSoft : T.card, border: "1px solid " + (member.role === "Owner" ? T.coralMid : T.cardBorder), borderRadius: "20px", color: member.role === "Owner" ? T.coral : T.textMuted }}>{member.role}</span>
                        <button onClick={() => { setEditingIdx(i); setEditForm({ ...member }); setAddingMember(false); }} style={{ padding: "5px 12px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "12px", cursor: "pointer" }}>Edit</button>
                        {member.role !== "Owner" && <button onClick={() => saveTeam(team.filter((_, idx) => idx !== i))} style={{ padding: "5px 10px", background: "transparent", border: "1px solid #D94F4F44", borderRadius: "6px", color: "#F09090", fontSize: "12px", cursor: "pointer" }}>✕</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid " + T.cardBorder }}>
                {addingMember ? (
                  <div>
                    <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "12px", fontStyle: "italic" }}>
                      They'll receive an email invite to set up their account.
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <input value={newMember.email} onChange={e => setNewMember(m => ({ ...m, email: e.target.value }))} placeholder="Email address" style={{ ...inp, flex: 2, minWidth: "200px" }} />
                      <select value={newMember.role} onChange={e => setNewMember(m => ({ ...m, role: e.target.value }))} style={{ ...inp, cursor: "pointer", flex: 1, minWidth: "120px" }}>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    {inviteMsg && <div style={{ fontSize: "13px", color: inviteMsg.startsWith("✓") ? "#52B788" : "#F09090", marginBottom: "8px" }}>{inviteMsg}</div>}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={sendInvite} disabled={inviting} style={{ padding: "8px 20px", background: T.coral, border: "none", borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                        {inviting ? "Sending..." : "Send Invite →"}
                      </button>
                      <button onClick={() => { setAddingMember(false); setNewMember({ email: "", role: "editor" }); setInviteMsg(""); }} style={{ padding: "8px 14px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddingMember(true); setEditingIdx(null); }} style={{ width: "100%", padding: "9px", background: "transparent", border: "1px dashed " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "13px", cursor: "pointer" }}>+ Invite Team Member</button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === "codes" && (
          <AccessCodesSection supabase={supabase} T={T} PF={PF} FF={FF} inp={inp} />
        )}

        {activeSection === "billing" && (
          <div style={{ maxWidth: "680px" }}>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "28px", fontWeight: "600", color: T.text, marginBottom: "6px", fontFamily: PF }}>Billing</div>
              <div style={{ fontSize: "15px", color: T.textMuted, fontStyle: "italic" }}>Manage your subscription and usage.</div>
            </div>
            <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", padding: "24px" }}>
              <div style={{ fontSize: "32px", fontWeight: "700", color: T.text, marginBottom: "4px" }}>Internal Use</div>
              <div style={{ fontSize: "14px", color: T.textMuted, marginBottom: "20px" }}>Billing will be configured when the app launches for external clients.</div>
              <div style={{ background: T.surface, borderRadius: "8px", padding: "16px 20px" }}>
                <div style={{ fontSize: "12px", color: T.coral, letterSpacing: "1.5px", marginBottom: "10px", fontWeight: "700" }}>COMING SOON</div>
                {["Per-show pricing for client workspaces", "Usage-based API cost tracking", "Client billing and invoicing"].map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ color: T.coral }}>→</span>
                    <span style={{ fontSize: "13px", color: T.textSecondary }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── ACCESS CODES SECTION ──────────────────────────────────────────────────────
function AccessCodesSection({ supabase, T, PF, FF, inp }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("1");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { loadCodes(); }, []);

  async function loadCodes() {
    setLoading(true);
    const { data } = await supabase.from("access_codes").select("*").order("created_at", { ascending: false });
    setCodes(data || []);
    setLoading(false);
  }

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setNewCode(code);
  }

  async function createCode() {
    if (!newCode.trim()) { setMsg("Enter a code first."); return; }
    setCreating(true); setMsg("");
    const { error } = await supabase.from("access_codes").insert({
      code: newCode.trim().toUpperCase(),
      max_uses: parseInt(newMaxUses) || 1,
    });
    if (error) {
      setMsg(error.message.includes("unique") ? "That code already exists." : error.message);
    } else {
      setMsg("✓ Code created!");
      setNewCode(""); setNewMaxUses("1");
      loadCodes();
    }
    setCreating(false);
    setTimeout(() => setMsg(""), 3000);
  }

  async function toggleActive(id, current) {
    await supabase.from("access_codes").update({ active: !current }).eq("id", id);
    loadCodes();
  }

  const lbl = { fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.textSecondary, marginBottom: "6px", display: "block", fontFamily: FF };

  return (
    <div style={{ maxWidth: "680px" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "28px", fontWeight: "600", color: T.text, marginBottom: "6px", fontFamily: PF }}>Access Codes</div>
        <div style={{ fontSize: "15px", color: T.textMuted, fontStyle: "italic" }}>Control who can sign up. Every new account requires a valid code.</div>
      </div>

      {/* Create new code */}
      <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: T.text, marginBottom: "16px", fontFamily: PF }}>Create New Code</div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: "180px" }}>
            <label style={lbl}>Code</label>
            <input
              style={{ ...inp, letterSpacing: "3px", fontWeight: "700", textTransform: "uppercase" }}
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="e.g. EARLYBIRD"
              maxLength={20}
            />
          </div>
          <div style={{ flex: 1, minWidth: "100px" }}>
            <label style={lbl}>Max Uses</label>
            <input
              style={inp}
              type="number"
              min="1"
              max="999"
              value={newMaxUses}
              onChange={e => setNewMaxUses(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={generateCode} style={{ padding: "10px 18px", background: T.surface, border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.text, fontSize: "13px", cursor: "pointer", fontFamily: FF }}>
            🎲 Generate Random
          </button>
          <button onClick={createCode} disabled={creating} style={{ padding: "10px 24px", background: T.coral, border: "none", borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: FF }}>
            {creating ? "Creating..." : "Create Code →"}
          </button>
        </div>
        {msg && <div style={{ marginTop: "10px", fontSize: "13px", color: msg.startsWith("✓") ? "#52B788" : "#F09090", fontFamily: FF }}>{msg}</div>}
      </div>

      {/* Code list */}
      <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + T.cardBorder, display: "grid", gridTemplateColumns: "1fr 80px 80px 80px", gap: "12px" }}>
          {["Code", "Uses", "Max", "Status"].map(h => (
            <div key={h} style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, fontFamily: FF }}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: T.textMuted, fontSize: "14px", fontFamily: FF }}>Loading...</div>
        ) : codes.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: T.textMuted, fontSize: "14px", fontFamily: FF }}>No codes yet — create one above.</div>
        ) : codes.map(c => (
          <div key={c.id} style={{ padding: "14px 20px", borderBottom: "1px solid " + T.cardBorder, display: "grid", gridTemplateColumns: "1fr 80px 80px 80px", gap: "12px", alignItems: "center", opacity: c.active ? 1 : 0.5 }}>
            <div style={{ fontFamily: FF, fontWeight: "700", color: T.text, letterSpacing: "2px", fontSize: "14px" }}>{c.code}</div>
            <div style={{ fontFamily: FF, color: c.uses >= c.max_uses ? "#F09090" : "#52B788", fontSize: "14px" }}>{c.uses}</div>
            <div style={{ fontFamily: FF, color: T.textSecondary, fontSize: "14px" }}>{c.max_uses}</div>
            <button onClick={() => toggleActive(c.id, c.active)} style={{ padding: "4px 10px", background: c.active ? "#52B78820" : T.surface, border: "1px solid " + (c.active ? "#52B788" : T.cardBorder), borderRadius: "4px", color: c.active ? "#52B788" : T.textMuted, fontSize: "11px", cursor: "pointer", fontFamily: FF, fontWeight: "700" }}>
              {c.active ? "ACTIVE" : "OFF"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminGate({ onSuccess, onClose }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  function check() { if (pin === "6425") { onSuccess(); } else { setErr(true); setPin(""); setTimeout(() => setErr(false), 1200); } }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: T.bg, border: "1px solid " + T.cardBorder, borderRadius: "16px", padding: "48px 40px", width: "340px", textAlign: "center" }}>
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>🔐</div>
        <div style={{ fontSize: "20px", color: T.text, marginBottom: "6px", ...LS, letterSpacing: "2px", textTransform: "uppercase" }}>Admin Access</div>
        <div style={{ fontSize: "15px", color: T.textSecondary, marginBottom: "28px", ...GA }}>Enter your PIN to continue</div>
        <input type="password" style={{ ...fld(), fontSize: "28px", textAlign: "center", letterSpacing: "10px", borderColor: err ? T.coral : T.cardBorder }} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && check()} placeholder="••••" maxLength={4} autoFocus />
        {err && <div style={{ color: T.coral, fontSize: "14px", marginTop: "10px", ...LS }}>Incorrect PIN</div>}
        <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", background: T.surface, border: "1px solid " + T.cardBorder, borderRadius: "8px", color: T.textSecondary, fontSize: "15px", cursor: "pointer", ...LS }}>Cancel</button>
          <button onClick={check} style={{ flex: 1, padding: "14px", background: T.coral, border: "none", borderRadius: "8px", color: "#fff", fontSize: "15px", fontWeight: "700", cursor: "pointer", ...LS }}>Enter →</button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel({ shows, orgId, onClose, onSaved, accountType = "agency", userEmail = "" }) {
  const [adminView, setAdminView] = useState("shows");
  const [selKey, setSelKey] = useState(null);
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState("basic");
  const [rawDna, setRawDna] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newId, setNewId] = useState("");
  const [newShowPath, setNewShowPath] = useState(null); // null | "manual" | "transcript" | "dna"
  const [globalSettings, setGlobalSettings] = useState({});
  const [globalSettingsSaved, setGlobalSettingsSaved] = useState(false);
  const [globalSettingsLoading, setGlobalSettingsLoading] = useState(false);
  const [orgData, setOrgData] = useState({ name: "", website: "" });
  const [orgDataSaved, setOrgDataSaved] = useState(false);
  const [transcriptFiles, setTranscriptFiles] = useState([]);
  const [transcriptDragging, setTranscriptDragging] = useState(false);
  const [transcriptParsing, setTranscriptParsing] = useState(false);
  const [transcriptMsg, setTranscriptMsg] = useState("");
  const [epfForm, setEpfForm] = useState({ name: "", type: "Guest Interview", targetLength: "", structure: "", signOffLine: "", ratingSystem: "" });
  const [epfEditing, setEpfEditing] = useState(null);
  const [epfShowForm, setEpfShowForm] = useState(false);

  useEffect(() => {
    async function loadGlobalSettings() {
      try {
        const { data } = await supabase.from("settings").select("value").eq("key", "global").single();
        if (data?.value) setGlobalSettings(data.value);
      } catch {}
    }
    loadGlobalSettings();
  }, []);

  useEffect(() => {
    async function loadOrgData() {
      if (!orgId) return;
      try {
        const { data } = await supabase.from("organizations").select("name, website").eq("id", orgId).single();
        if (data) setOrgData({ name: data.name || "", website: data.website || "" });
      } catch {}
    }
    loadOrgData();
  }, [orgId]);

  async function saveOrgData() {
    setOrgDataSaved(false);
    try {
      await supabase.from("organizations").update({ name: orgData.name, website: orgData.website }).eq("id", orgId);
      setOrgDataSaved(true);
      setTimeout(() => setOrgDataSaved(false), 2000);
    } catch {}
  }

  async function saveGlobalSettings(newSettings) {
    setGlobalSettingsLoading(true);
    try {
      await supabase.from("settings").upsert({ key: "global", value: newSettings, org_id: orgId }, { onConflict: "org_id,key" });
      setGlobalSettings(newSettings);
      setGlobalSettingsSaved(true);
      setTimeout(() => setGlobalSettingsSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setGlobalSettingsLoading(false);
    }
  }
  function selectShow(k) {
    const s = shows[k];
    setSelKey(k);
    setForm({
      name: s.name || "",
      tag: s.tag || "",
      hosts: s.hosts || "",
      clr: s.clr || "#C41230",
      platforms: s.platforms || DEFAULT_PLATFORMS,
      voice: { traits: s.voice?.traits || "", energy: s.voice?.energy || "5/10", arch: s.voice?.arch || "", arc: s.voice?.arc || "", phrases: (s.voice?.phrases || []).join("\n"), use: s.voice?.use || "", avoid: s.voice?.avoid || "" },
      aud: { who: s.aud?.who || "", pains: (s.aud?.pains || []).join("\n"), lang: s.aud?.lang || "" },
      tags: s.tags || "",
      bp: s.bp || "",
      rules: s.rules || "", publishDay: s.publishDay || "", publishTime: s.publishTime || "", publishTz: s.publishTz || "",
      snElements: DEFAULT_SN_ELEMENTS.map(def => {
        const saved = (s.snElements || []).find(e => e.id === def.id);
        return saved ? { ...def, enabled: saved.enabled, text: saved.text || "", header: saved.header || "", scope: saved.scope || def.scope } : def;
      }),
      descriptApiKey: s.descriptApiKey || "",
      editingLevel: s.editingLevel || "1",
      epPrep: {
        onePerson: { name: s.epPrep?.onePerson?.name || "", question2AM: s.epPrep?.onePerson?.question2AM || "", wound: s.epPrep?.onePerson?.wound || "" },
        storyMission: s.epPrep?.storyMission || "",
        permissionSlips: (s.epPrep?.permissionSlips || []).join("\n"),
      },
      episodeFormats: s.episodeFormats || [],
    });
    setRawDna(""); setMsg(""); setTab("basic"); setNewShowPath("manual");
  }

  function startNew() {
    setSelKey("__new__");
    setForm({
      name: "", tag: "", hosts: "", clr: "#C41230",
      platforms: DEFAULT_PLATFORMS,
      voice: { traits: "", energy: "5/10", arch: "", arc: "", phrases: "", use: "", avoid: "" },
      aud: { who: "", pains: "", lang: "" },
      tags: "", bp: "", rules: "", publishDay: "", publishTime: "", publishTz: "",
      snElements: DEFAULT_SN_ELEMENTS,
      descriptApiKey: "",
      editingLevel: "1",
      epPrep: { onePerson: { name: "", question2AM: "", wound: "" }, storyMission: "", permissionSlips: "" },
      episodeFormats: [],
    });
    setNewId(""); setRawDna(""); setMsg(""); setAddingNew(true); setTab("basic"); setNewShowPath(null);
  }

  function detectPasteType(text) {
    if (!text || text.trim().length < 50) return null;
    const structuredLabels = (text.match(/^[A-Z][A-Z_]{2,}:\s/gm) || []).length;
    const hasTimestamps = /\[\d{1,2}:\d{2}\]|\b\d{1,2}:\d{2}:\d{2}\b/.test(text);
    const hasDialogue = /^[A-Za-z][A-Za-z\s]{1,20}:\s+\S/m.test(text) && text.length > 600;
    if (structuredLabels >= 4 && !hasTimestamps) return "dna";
    if (hasTimestamps || (hasDialogue && structuredLabels < 4)) return "transcript";
    if (structuredLabels >= 2) return "dna";
    if (text.length > 800) return "transcript";
    return null;
  }

  async function parseWithAI() {
    if (!rawDna.trim()) return;
    const contentType = detectPasteType(rawDna);
    const isTranscript = contentType === "transcript";
    setParsing(true); setMsg("");
    try {
      function getField(label, responseText) {
        for (const line of responseText.split("\n")) {
          const t = line.trim();
          if (t.toUpperCase().startsWith(label + ":")) return t.slice(label.length + 1).trim();
        }
        return "";
      }
      function getMultiline(label, responseText) {
        const lines = responseText.split("\n");
        let found = false; const collected = [];
        for (const line of lines) {
          if (!found) { if (line.trim().toUpperCase().startsWith(label + ":")) { found = true; const rest = line.slice(line.indexOf(":") + 1).trim(); if (rest) collected.push(rest); } }
          else { if (/^[A-Z_]+:/.test(line.trim())) break; collected.push(line); }
        }
        return collected.join("\n").trim();
      }
      function splitBy(str, sep) { return str ? str.split(sep).map(s => s.trim()).filter(Boolean) : []; }

      if (isTranscript) {
        const prompt = `You are a podcast content strategist. Analyze this podcast transcript and extract the show's DNA — voice, audience, and content patterns.

Return ONLY these labeled fields, one per line, label in ALL CAPS followed by colon and space, then the value. No other text, no explanations.

NAME: show name (infer from context if not explicit)
TAG: a one-line tagline that captures the show's essence
HOSTS: host name(s) — infer from how people address each other
VOICE_TRAITS: 4-6 adjectives describing the tone and voice (e.g. Warm. Curious. Direct. Science-backed.)
VOICE_ENERGY: energy level from 1-10 with /10 (e.g. 6/10)
VOICE_ARCH: host archetype in 2-4 words (e.g. The Curious Guide, The Expert Friend)
VOICE_ARC: emotional journey listeners go on (e.g. Confused → Curious → Validated → Empowered)
VOICE_PHRASES: recurring phrases or sign-offs separated by | (pull exact words from transcript)
VOICE_USE: types of language, analogies, or framing the show gravitates toward
VOICE_AVOID: language, tone, or topics that seem absent or contrary to this show's voice
AUD_WHO: describe the ideal listener in 2-3 sentences — who they are, what stage of life/career
AUD_PAINS: 3-5 core struggles or questions the audience has, separated by |
AUD_LANG: exact phrases or words the audience would use to describe their problem
HASHTAGS: 5-8 relevant hashtags for this show
RULES: 2-3 content rules that emerge from the transcript (e.g. Always cite sources. Never give medical advice.)

TRANSCRIPT:
${rawDna.substring(0, 10000)}`;

        const j = await claudeAPI({ model: "claude-3-5-haiku-20241022", max_tokens: 2000, messages: [{ role: "user", content: prompt }] });
        const text = j.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";

        setForm(prev => ({
          ...prev,
          name: getField("NAME", text) || prev?.name || "",
          tag: getField("TAG", text) || prev?.tag || "",
          hosts: getField("HOSTS", text) || prev?.hosts || "",
          voice: { traits: getField("VOICE_TRAITS", text) || prev?.voice?.traits || "", energy: getField("VOICE_ENERGY", text) || prev?.voice?.energy || "5/10", arch: getField("VOICE_ARCH", text) || prev?.voice?.arch || "", arc: getField("VOICE_ARC", text) || prev?.voice?.arc || "", phrases: splitBy(getField("VOICE_PHRASES", text), "|").join("\n") || prev?.voice?.phrases || "", use: getField("VOICE_USE", text) || prev?.voice?.use || "", avoid: getField("VOICE_AVOID", text) || prev?.voice?.avoid || "" },
          aud: { who: getField("AUD_WHO", text) || prev?.aud?.who || "", pains: splitBy(getField("AUD_PAINS", text), "|").join("\n") || prev?.aud?.pains || "", lang: getField("AUD_LANG", text) || prev?.aud?.lang || "" },
          tags: getField("HASHTAGS", text) || prev?.tags || "",
          rules: getField("RULES", text) || prev?.rules || "",
          snElements: prev?.snElements || DEFAULT_SN_ELEMENTS,
        }));
        setMsg("✓ Transcript analyzed — review each tab and save.");
      } else {
        const prompt = "Read this Show DNA document and fill in each field. " +
          "Return ONLY these labeled fields, one per line, with the label in ALL CAPS followed by a colon and a space, then the value. No other text.\n\n" +
          "NAME: show name\nTAG: tagline\nHOSTS: host names\nCOLOR: suggest a hex color\n" +
          "PLATFORMS_PODCAST: main podcast platforms comma separated\nPLATFORMS_SOCIAL: social platforms comma separated\n" +
          "VOICE_TRAITS: tone and voice traits\nVOICE_ENERGY: energy level like 6/10\nVOICE_ARCH: host archetype\n" +
          "VOICE_ARC: emotional arc\nVOICE_PHRASES: signature phrases separated by |\n" +
          "VOICE_USE: language to use\nVOICE_AVOID: language to avoid\n" +
          "AUD_WHO: audience persona\nAUD_PAINS: pain points separated by |\nAUD_LANG: language they use\n" +
          "HASHTAGS: default hashtags\nRULES: content rules\n" +
          "BOILERPLATE: full boilerplate text including all links and disclaimers\n\n" +
          "SHOW DNA:\n" + rawDna.substring(0, 8000);

        const j = await claudeAPI({ model: "claude-3-5-haiku-20241022", max_tokens: 4000, messages: [{ role: "user", content: prompt }] });
        const text = j.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";

        const podcastPlatforms = splitBy(getField("PLATFORMS_PODCAST", text), ",");
        const socialPlatforms = splitBy(getField("PLATFORMS_SOCIAL", text), ",");

        setForm(prev => ({
          ...prev,
          name: getField("NAME", text) || prev?.name || "",
          tag: getField("TAG", text) || prev?.tag || "",
          hosts: getField("HOSTS", text) || prev?.hosts || "",
          clr: getField("COLOR", text) || prev?.clr || "#C41230",
          platforms: {
            ...DEFAULT_PLATFORMS,
            podcast: podcastPlatforms.length ? podcastPlatforms : DEFAULT_PLATFORMS.podcast,
            social: socialPlatforms.length ? socialPlatforms : DEFAULT_PLATFORMS.social,
          },
          voice: { traits: getField("VOICE_TRAITS", text), energy: getField("VOICE_ENERGY", text) || "5/10", arch: getField("VOICE_ARCH", text), arc: getField("VOICE_ARC", text), phrases: splitBy(getField("VOICE_PHRASES", text), "|").join("\n"), use: getField("VOICE_USE", text), avoid: getField("VOICE_AVOID", text) },
          aud: { who: getField("AUD_WHO", text), pains: splitBy(getField("AUD_PAINS", text), "|").join("\n"), lang: getField("AUD_LANG", text) },
          tags: getField("HASHTAGS", text),
          bp: getMultiline("BOILERPLATE", text),
          rules: getField("RULES", text),
          snElements: prev?.snElements || DEFAULT_SN_ELEMENTS,
        }));
        setMsg("✓ DNA parsed — review fields and save.");
      }
    } catch (e) { setMsg("Parse error: " + e.message); }
    finally { setParsing(false); }
  }

  function handleTranscriptDrop(e) {
    e.preventDefault(); setTranscriptDragging(false);
    const files = Array.from(e.dataTransfer?.files || e.target?.files || [])
      .filter(f => f.name.match(/\.(txt|md|docx?)$/i))
      .slice(0, 5 - transcriptFiles.length);
    if (!files.length) return;

    function readFile(f) {
      return new Promise((res, rej) => {
        if (f.name.match(/\.docx?$/i)) {
          // Word doc — use mammoth to extract plain text
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const result = await mammoth.extractRawText({ arrayBuffer: ev.target.result });
              res({ name: f.name, text: result.value });
            } catch (err) { rej(err); }
          };
          reader.onerror = rej;
          reader.readAsArrayBuffer(f);
        } else {
          // Plain text / markdown
          const reader = new FileReader();
          reader.onload = ev => res({ name: f.name, text: ev.target.result });
          reader.onerror = rej;
          reader.readAsText(f);
        }
      });
    }

    Promise.all(files.map(readFile))
      .then(loaded => setTranscriptFiles(prev => [...prev, ...loaded].slice(0, 5)))
      .catch(err => setTranscriptMsg("Error reading file: " + err.message));
  }

  async function parseFromTranscripts() {
    if (!transcriptFiles.length) return;
    setTranscriptParsing(true); setTranscriptMsg("");
    try {
      const combined = transcriptFiles.map((f, i) =>
        `=== TRANSCRIPT ${i + 1}: ${f.name} ===\n${f.text.slice(0, 5000)}`
      ).join("\n\n");

      const prompt = `You are a podcast content strategist. Analyze these ${transcriptFiles.length} podcast transcript(s) and extract the show's DNA — voice, audience, and content patterns.

Return ONLY these labeled fields, one per line, label in ALL CAPS followed by colon and space, then the value. No other text, no explanations.

NAME: show name (infer from context if not explicit)
TAG: a one-line tagline that captures the show's essence
HOSTS: host name(s) — infer from how people address each other
VOICE_TRAITS: 4-6 adjectives describing the tone and voice (e.g. Warm. Curious. Direct. Science-backed.)
VOICE_ENERGY: energy level from 1-10 with /10 (e.g. 6/10)
VOICE_ARCH: host archetype in 2-4 words (e.g. The Curious Guide, The Expert Friend)
VOICE_ARC: emotional journey listeners go on (e.g. Confused → Curious → Validated → Empowered)
VOICE_PHRASES: recurring phrases or sign-offs separated by | (pull exact words from transcripts)
VOICE_USE: types of language, analogies, or framing the show gravitates toward
VOICE_AVOID: language, tone, or topics that seem absent or contrary to this show's voice
AUD_WHO: describe the ideal listener in 2-3 sentences — who they are, what stage of life/career
AUD_PAINS: 3-5 core struggles or questions the audience has, separated by |
AUD_LANG: exact phrases or words the audience would use to describe their problem
HASHTAGS: 5-8 relevant hashtags for this show
RULES: 2-3 content rules that emerge from the transcripts (e.g. Always cite sources. Never give medical advice.)

TRANSCRIPTS:
${combined}`;

      const j = await claudeAPI({ model: "claude-3-5-haiku-20241022", max_tokens: 2000, messages: [{ role: "user", content: prompt }] });
      const text = j.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";

      function getField(label) {
        for (const line of text.split("\n")) {
          const t = line.trim();
          if (t.toUpperCase().startsWith(label + ":")) return t.slice(label.length + 1).trim();
        }
        return "";
      }
      function splitBy(str, sep) { return str ? str.split(sep).map(s => s.trim()).filter(Boolean) : []; }

      setForm(prev => ({
        ...prev,
        name: getField("NAME") || prev?.name || "",
        tag: getField("TAG") || prev?.tag || "",
        hosts: getField("HOSTS") || prev?.hosts || "",
        voice: {
          traits: getField("VOICE_TRAITS") || prev?.voice?.traits || "",
          energy: getField("VOICE_ENERGY") || prev?.voice?.energy || "5/10",
          arch: getField("VOICE_ARCH") || prev?.voice?.arch || "",
          arc: getField("VOICE_ARC") || prev?.voice?.arc || "",
          phrases: splitBy(getField("VOICE_PHRASES"), "|").join("\n") || prev?.voice?.phrases || "",
          use: getField("VOICE_USE") || prev?.voice?.use || "",
          avoid: getField("VOICE_AVOID") || prev?.voice?.avoid || "",
        },
        aud: {
          who: getField("AUD_WHO") || prev?.aud?.who || "",
          pains: splitBy(getField("AUD_PAINS"), "|").join("\n") || prev?.aud?.pains || "",
          lang: getField("AUD_LANG") || prev?.aud?.lang || "",
        },
        tags: getField("HASHTAGS") || prev?.tags || "",
        rules: getField("RULES") || prev?.rules || "",
        snElements: prev?.snElements || DEFAULT_SN_ELEMENTS,
      }));
      setTranscriptMsg("✓ Done! Fields filled from " + transcriptFiles.length + " transcript" + (transcriptFiles.length > 1 ? "s" : "") + ". Review each tab and save.");
    } catch (e) {
      setTranscriptMsg("Error: " + e.message);
    } finally {
      setTranscriptParsing(false);
    }
  }

  async function handleSave() {
    if (!form) return;
    const id = selKey === "__new__" ? newId.trim().toLowerCase().replace(/\s+/g, "-") : selKey;
    if (!id) { setMsg("Show ID required."); return; }
    if (!form.name.trim()) { setMsg("Show name required."); return; }
    setSaving(true); setMsg("");
    try {
      const dna = {
        name: form.name, tag: form.tag, hosts: form.hosts,
        clr: form.clr, light: form.clr + "20",
        platforms: form.platforms,
        voice: { traits: form.voice.traits, energy: form.voice.energy, arch: form.voice.arch, arc: form.voice.arc, phrases: form.voice.phrases.split("\n").map(s => s.trim()).filter(Boolean), use: form.voice.use, avoid: form.voice.avoid },
        aud: { who: form.aud.who, pains: form.aud.pains.split("\n").map(s => s.trim()).filter(Boolean), lang: form.aud.lang },
        tags: form.tags, bp: form.bp, rules: form.rules, publishDay: form.publishDay || "", publishTime: form.publishTime || "", publishTz: form.publishTz || "",
        snElements: form.snElements,
        descriptApiKey: form.descriptApiKey || "",
        editingLevel: form.editingLevel || "1",
        epPrep: {
          onePerson: form.epPrep.onePerson,
          storyMission: form.epPrep.storyMission,
          permissionSlips: form.epPrep.permissionSlips.split("\n").map(s => s.trim()).filter(Boolean),
        },
        episodeFormats: form.episodeFormats || [],
        tpl: { sn: "", yt: "", sm: "", gk: "", em: "", bl: "" },
      };
      await saveShow(id, dna, orgId);
      setMsg("Saved successfully!");
      if (selKey === "__new__") setSelKey(id);
      setAddingNew(false);
      onSaved();
    } catch (e) { setMsg("Save error: " + e.message); }
    finally { setSaving(false); }
  }

  const TABS = [
    { id: "basic", label: "Basic Info" },
    { id: "voice", label: "Voice DNA" },
    { id: "audience", label: "Audience" },
    { id: "platforms", label: "Platforms" },
    { id: "snnotes", label: "Show Notes Builder" },
    { id: "boilerplate", label: "Boilerplate" },
    { id: "editing", label: "Editor Companion" },
    { id: "formats", label: "Episode Formats" },
    { id: "epprep", label: "Episode Prep DNA" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div style={{ background: T.surface, borderBottom: "1px solid " + T.cardBorder, flexShrink: 0 }}>
        <div style={{ padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "center", height: "56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "3px", height: "24px", background: T.coral, borderRadius: "2px" }} />
            <span style={{ fontSize: "20px", color: T.text, fontFamily: PF, fontWeight: "700" }}>Podcast Impact Studio</span>
            <span style={{ fontSize: "11px", color: T.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif", background: T.card, padding: "3px 8px", borderRadius: "4px", border: "1px solid " + T.cardBorder }}>Admin</span>
          </div>
          <button onClick={onClose} style={{ padding: "8px 16px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textSecondary, fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>✕ Close</button>
        </div>
        <div style={{ display: "flex", padding: "0 32px" }}>
          {["shows", "settings"].map(v => (
            <button key={v} onClick={() => setAdminView(v)}
              style={{ padding: "10px 24px", background: "transparent", border: "none", borderBottom: adminView === v ? "2px solid " + T.coral : "2px solid transparent", color: adminView === v ? T.coral : T.textMuted, fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: adminView === v ? "700" : "500", transition: "all .15s" }}>
              {v === "shows" ? (accountType === "solo" ? "My Shows" : "Show DNA Manager") : "Settings"}
            </button>
          ))}
        </div>
      </div>

      {adminView === "settings" ? (
        <SettingsView globalSettings={globalSettings} setGlobalSettings={setGlobalSettings} saveGlobalSettings={saveGlobalSettings} globalSettingsSaved={globalSettingsSaved} globalSettingsLoading={globalSettingsLoading} orgId={orgId} accountType={accountType} userEmail={userEmail} orgData={orgData} setOrgData={setOrgData} saveOrgData={saveOrgData} orgDataSaved={orgDataSaved} />
      ) : (
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: "220px", background: T.surface, borderRight: "1px solid " + T.cardBorder, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "16px", borderBottom: "1px solid " + T.cardBorder }}>
            <button onClick={startNew} style={{ width: "100%", padding: "10px", background: T.coral, border: "none", borderRadius: "6px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", ...LS, letterSpacing: "1.5px", textTransform: "uppercase" }}>+ Add Show</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {Object.entries(shows).map(([k, s]) => (
              <div key={k} onClick={() => selectShow(k)}
                style={{ padding: "12px 14px", borderRadius: "6px", cursor: "pointer", background: selKey === k ? (s.clr ? s.clr + "18" : T.coralSoft) : "transparent", border: "1px solid " + (selKey === k ? (s.clr || T.coral) + "44" : "transparent"), marginBottom: "4px", transition: "all .15s" }}>
                <div style={{ fontSize: "16px", color: selKey === k ? (s.clr || T.coral) : T.coral, fontWeight: "600", fontFamily: PF, marginBottom: "3px" }}>{s.name}</div>
                <div style={{ fontSize: "13px", color: T.textMuted, fontFamily: FF, fontStyle: "italic" }}>{(s.tag || "").substring(0, 40)}{(s.tag || "").length > 40 ? "..." : ""}</div>
              </div>
            ))}
          </div>
        </div>

        {!form ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: T.textMuted }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎙️</div>
              <div style={{ fontSize: "15px", ...LS, letterSpacing: "2px", textTransform: "uppercase" }}>Select a show or add a new one</div>
            </div>
          </div>

        ) : selKey === "__new__" && newShowPath === null ? (
          /* ── PATH CHOOSER ─────────────────────────────────────────── */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 60px" }}>
            <div style={{ maxWidth: "760px", width: "100%" }}>
              <div style={{ textAlign: "center", marginBottom: "48px" }}>
                <div style={{ fontSize: "30px", fontWeight: "700", color: T.text, fontFamily: PF, marginBottom: "10px" }}>How would you like to set up your show?</div>
                <div style={{ fontSize: "16px", color: T.textSecondary, fontFamily: FF, lineHeight: "1.5" }}>
                  The more we know about your show, the more your content will sound like you.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>

                {/* Card 1 — Enter Manually */}
                <button onClick={() => setNewShowPath("manual")}
                  style={{ padding: "32px 24px", background: T.card, border: "2px solid " + T.cardBorder, borderRadius: "14px", cursor: "pointer", textAlign: "center", transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.coral; e.currentTarget.style.background = T.coralSoft; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.background = T.card; }}>
                  <div style={{ fontSize: "36px" }}>📝</div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: T.text, fontFamily: FF, marginBottom: "8px" }}>Enter Manually</div>
                    <div style={{ fontSize: "13px", color: T.textSecondary, fontFamily: FF, lineHeight: "1.6" }}>
                      Fill in your show's details yourself — name, voice, audience, and more — tab by tab.
                    </div>
                  </div>
                  <div style={{ marginTop: "auto", fontSize: "13px", color: T.coral, fontFamily: FF, fontWeight: "600" }}>Start filling in →</div>
                </button>

                {/* Card 2 — AI from Transcripts */}
                <button onClick={() => { setNewShowPath("dna"); }}
                  style={{ padding: "32px 24px", background: T.card, border: "2px solid " + T.coral + "44", borderRadius: "14px", cursor: "pointer", textAlign: "center", transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", position: "relative" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.coral; e.currentTarget.style.background = T.coralSoft; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.coral + "44"; e.currentTarget.style.background = T.card; }}>
                  <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: T.coral, color: "#fff", fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", padding: "4px 12px", borderRadius: "20px", fontFamily: FF, whiteSpace: "nowrap" }}>RECOMMENDED</div>
                  <div style={{ fontSize: "36px" }}>✨</div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: T.text, fontFamily: FF, marginBottom: "8px" }}>Draft from Episodes</div>
                    <div style={{ fontSize: "13px", color: T.textSecondary, fontFamily: FF, lineHeight: "1.6" }}>
                      Upload 3–5 of your best episode transcripts (.txt or .docx) and AI will draft your show's voice, audience, and style automatically.
                    </div>
                  </div>
                  <div style={{ marginTop: "auto", fontSize: "13px", color: T.coral, fontFamily: FF, fontWeight: "600" }}>Upload transcripts →</div>
                </button>

                {/* Card 3 — Paste Show DNA */}
                <button onClick={() => setNewShowPath("dna")}
                  style={{ padding: "32px 24px", background: T.card, border: "2px solid " + T.cardBorder, borderRadius: "14px", cursor: "pointer", textAlign: "center", transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.coral; e.currentTarget.style.background = T.coralSoft; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.background = T.card; }}>
                  <div style={{ fontSize: "36px" }}>📋</div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: T.text, fontFamily: FF, marginBottom: "8px" }}>Paste Show DNA</div>
                    <div style={{ fontSize: "13px", color: T.textSecondary, fontFamily: FF, lineHeight: "1.6" }}>
                      Already have a Show DNA document or detailed show brief? Paste it here and AI will extract all the fields for you.
                    </div>
                  </div>
                  <div style={{ marginTop: "auto", fontSize: "13px", color: T.coral, fontFamily: FF, fontWeight: "600" }}>Paste & parse →</div>
                </button>

              </div>
            </div>
          </div>

        ) : (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Left paste panel — DNA or Transcript, auto-detected */}
            {(newShowPath === "dna" || selKey !== "__new__") && (() => {
              const detectedType = detectPasteType(rawDna);
              const typeLabel = detectedType === "dna" ? "✓ Detected: Show DNA" : detectedType === "transcript" ? "✓ Detected: Transcript" : null;
              const btnLabel = parsing ? "Analyzing…" : detectedType === "transcript" ? "✨ Analyze Transcript →" : "Parse with AI →";
              return (
              <div style={{ width: "380px", borderRight: "1px solid " + T.cardBorder, display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.cardBorder }}>
                  <div style={{ fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", color: T.textMuted, marginBottom: "8px", ...LS }}>Paste Show DNA or Transcript</div>
                  <div style={{ fontSize: "14px", color: T.textSecondary, ...GA, lineHeight: "1.5" }}>Paste a Show DNA doc or an episode transcript. Claude will detect the content type and fill in your show's fields automatically.</div>
                </div>
                <div style={{ flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden" }}>
                  <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
                    <textarea style={{ flex: 1, background: T.surface, border: "1px solid " + (typeLabel ? (detectedType === "transcript" ? T.coral + "88" : "#52B78888") : T.cardBorder), borderRadius: "6px", padding: "14px", color: T.text, fontSize: "14px", outline: "none", resize: "none", ...GA, lineHeight: "1.6", transition: "border-color .2s" }} placeholder={"Paste your Show DNA or episode transcript here…\n\nOr click 'Upload .txt / .docx' below to load a file."} value={rawDna} onChange={e => setRawDna(e.target.value)} spellCheck={false} />
                    {typeLabel && (
                      <div style={{ position: "absolute", bottom: "10px", right: "10px", fontSize: "11px", fontWeight: "700", letterSpacing: "1px", padding: "3px 8px", borderRadius: "20px", background: detectedType === "transcript" ? T.coral + "22" : "#52B78822", color: detectedType === "transcript" ? T.coral : "#52B788", fontFamily: FF, pointerEvents: "none" }}>
                        {typeLabel}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ flex: 1, height: "1px", background: T.cardBorder }} />
                    <span style={{ fontSize: "12px", color: T.textMuted, fontFamily: FF }}>or</span>
                    <div style={{ flex: 1, height: "1px", background: T.cardBorder }} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "9px", border: "1px dashed " + T.cardBorder, borderRadius: "6px", cursor: "pointer", fontSize: "13px", color: T.textSecondary, fontFamily: FF, transition: "all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.coral; e.currentTarget.style.color = T.coral; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.color = T.textSecondary; }}>
                    📄 Upload .txt or .docx
                    <input type="file" accept=".txt,.md,.doc,.docx" style={{ display: "none" }} onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      if (f.name.match(/\.docx?$/i)) {
                        const reader = new FileReader();
                        reader.onload = async ev => { try { const r = await mammoth.extractRawText({ arrayBuffer: ev.target.result }); setRawDna(r.value); } catch(err) { setMsg("Error reading file: " + err.message); } };
                        reader.readAsArrayBuffer(f);
                      } else {
                        const reader = new FileReader();
                        reader.onload = ev => setRawDna(ev.target.result);
                        reader.readAsText(f);
                      }
                      e.target.value = "";
                    }} />
                  </label>
                  <button onClick={parseWithAI} disabled={parsing || !rawDna.trim()}
                    style={{ padding: "13px", background: rawDna.trim() ? T.coral : T.cardBorder, border: "none", borderRadius: "6px", color: rawDna.trim() ? "#fff" : T.textMuted, fontSize: "14px", fontWeight: "700", cursor: rawDna.trim() ? "pointer" : "not-allowed", ...LS, letterSpacing: "2px", textTransform: "uppercase" }}>
                    {btnLabel}
                  </button>
                  {msg && (
                    <div>
                      <div style={{ fontSize: "13px", color: msg.startsWith("✓") || msg.startsWith("Saved") ? "#52B788" : "#F09090", ...LS }}>{msg}</div>
                      {msg.startsWith("✓") && (
                        <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {["basic","voice","audience"].map(t => (
                            <button key={t} onClick={() => setTab(t)} style={{ padding: "5px 10px", background: T.surface, border: "1px solid " + T.cardBorder, borderRadius: "5px", color: T.coral, fontSize: "11px", cursor: "pointer", fontFamily: FF, fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>
                              {t === "basic" ? "Basic Info" : t === "voice" ? "Voice DNA" : "Audience"} →
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {addingNew && selKey === "__new__" && (
                <div style={{ padding: "12px 24px", background: T.coralSoft, borderBottom: "1px solid " + T.coral + "33" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <label style={{ ...lbl(), margin: 0, whiteSpace: "nowrap" }}>Show ID:</label>
                    <input style={{ ...fld(), padding: "8px 12px", fontSize: "14px", flex: 1 }} placeholder="e.g. my-podcast" value={newId} onChange={e => setNewId(e.target.value)} />
                  </div>
                </div>
              )}

              {selKey === "__new__" && (
                <div style={{ padding: "14px 24px", background: "#FF313110", borderBottom: "1px solid " + T.coral + "33", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "20px", flexShrink: 0 }}>💡</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: T.coral, marginBottom: "3px", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif" }}>For best results, fill in every tab</div>
                    <div style={{ fontSize: "13px", color: T.textSecondary, lineHeight: "1.5", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                      The more detail you provide — voice DNA, audience, platforms, boilerplate — the more tailored and on-brand your generated content will be. Start with <strong style={{ color: T.text }}>Basic Info</strong>, then work through each tab. You can always come back and update.
                    </div>
                  </div>
                  <button onClick={() => setNewShowPath(null)} style={{ flexShrink: 0, background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "6px", color: T.textMuted, fontSize: "12px", cursor: "pointer", padding: "5px 10px", fontFamily: FF, whiteSpace: "nowrap" }}>← Change path</button>
                </div>
              )}

              <div style={{ display: "flex", borderBottom: "1px solid " + T.cardBorder, flexShrink: 0, overflowX: "auto" }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={{ padding: "12px 18px", background: tab === t.id ? T.bg : "transparent", borderBottom: tab === t.id ? "2px solid " + T.coral : "2px solid transparent", border: "none", color: tab === t.id ? T.coral : T.text, fontSize: "13px", cursor: "pointer", ...LS, letterSpacing: "1.5px", textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: tab === t.id ? "700" : "500" }}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

                {tab === "basic" && (
                  <Section title="Basic Information">
                    <Fld label="Show Name"><input style={fld()} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="The Podcast Name" /></Fld>
                    <Fld label="Tagline / Motto"><input style={fld()} value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value }))} placeholder="Your show's one-liner" /></Fld>
                    <Fld label="Host(s)"><input style={fld()} value={form.hosts} onChange={e => setForm(p => ({ ...p, hosts: e.target.value }))} placeholder="Jane Smith, John Doe" /></Fld>

                    <Fld label="Default Hashtags"><textarea style={{ ...fld(), minHeight: "70px", resize: "vertical" }} value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="#ShowName #Topic1 #Topic2" /></Fld>
                    <div style={{ marginBottom: "14px" }}>
                      <label style={lbl()}>Publish Schedule</label>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <select style={{ ...fld(), flex: 1, minWidth: "140px", cursor: "pointer" }} value={form.publishDay || ""} onChange={e => setForm(p => ({ ...p, publishDay: e.target.value }))}>
                          <option value="">Day of week...</option>
                          {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <input type="time" style={{ ...fld(), flex: 1, minWidth: "120px" }} value={form.publishTime || ""} onChange={e => setForm(p => ({ ...p, publishTime: e.target.value }))} />
                        <select style={{ ...fld(), flex: 2, minWidth: "180px", cursor: "pointer" }} value={form.publishTz || ""} onChange={e => setForm(p => ({ ...p, publishTz: e.target.value }))}>
                          <option value="">Timezone...</option>
                          {[["America/New_York","Eastern Time (ET)"],["America/Chicago","Central Time (CT)"],["America/Denver","Mountain Time (MT)"],["America/Los_Angeles","Pacific Time (PT)"],["America/Vancouver","Vancouver (PT)"],["America/Toronto","Toronto (ET)"],["Europe/London","London (GMT/BST)"],["Asia/Manila","Manila (PHT)"],["Asia/Tokyo","Tokyo (JST)"],["Australia/Sydney","Sydney (AEST)"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div style={{ fontSize: "12px", color: T.textMuted, marginTop: "6px", fontStyle: "italic" }}>Editors in other timezones will see this converted to their local time.</div>
                    </div>
                  </Section>
                )}

                {tab === "voice" && (
                  <Section title="Voice DNA">
                    <Fld label="Voice Traits"><textarea style={{ ...fld(), minHeight: "70px", resize: "vertical" }} value={form.voice.traits} onChange={e => setForm(p => ({ ...p, voice: { ...p.voice, traits: e.target.value } }))} placeholder="Warm. Curious. Grounded. Direct." /></Fld>
                    <Fld label="Energy Level"><input style={fld()} value={form.voice.energy} onChange={e => setForm(p => ({ ...p, voice: { ...p.voice, energy: e.target.value } }))} placeholder="e.g. 6/10" /></Fld>
                    <Fld label="Host Archetype"><input style={fld()} value={form.voice.arch} onChange={e => setForm(p => ({ ...p, voice: { ...p.voice, arch: e.target.value } }))} placeholder="e.g. Guide + Mirror" /></Fld>
                    <Fld label="Emotional Arc"><textarea style={{ ...fld(), minHeight: "70px", resize: "vertical" }} value={form.voice.arc} onChange={e => setForm(p => ({ ...p, voice: { ...p.voice, arc: e.target.value } }))} placeholder="Curious → Seen → Understood → Inspired" /></Fld>
                    <Fld label="Signature Phrases (one per line)"><textarea style={{ ...fld(), minHeight: "90px", resize: "vertical" }} value={form.voice.phrases} onChange={e => setForm(p => ({ ...p, voice: { ...p.voice, phrases: e.target.value } }))} placeholder="Your show's tagline phrases" /></Fld>
                    <Fld label="Language to USE"><textarea style={{ ...fld(), minHeight: "80px", resize: "vertical" }} value={form.voice.use} onChange={e => setForm(p => ({ ...p, voice: { ...p.voice, use: e.target.value } }))} placeholder="Words and concepts that fit the show" /></Fld>
                    <Fld label="Language to AVOID"><textarea style={{ ...fld(), minHeight: "80px", resize: "vertical" }} value={form.voice.avoid} onChange={e => setForm(p => ({ ...p, voice: { ...p.voice, avoid: e.target.value } }))} placeholder="Words and concepts to never use" /></Fld>
                    <Fld label="Content Rules"><textarea style={{ ...fld(), minHeight: "80px", resize: "vertical" }} value={form.rules} onChange={e => setForm(p => ({ ...p, rules: e.target.value }))} placeholder="Any specific rules for content generation" /></Fld>
                  </Section>
                )}

                {tab === "audience" && (
                  <Section title="Audience DNA">
                    <Fld label="Listener Persona"><textarea style={{ ...fld(), minHeight: "90px", resize: "vertical" }} value={form.aud.who} onChange={e => setForm(p => ({ ...p, aud: { ...p.aud, who: e.target.value } }))} placeholder="Who is your ideal listener?" /></Fld>
                    <Fld label="Pain Points (one per line)"><textarea style={{ ...fld(), minHeight: "100px", resize: "vertical" }} value={form.aud.pains} onChange={e => setForm(p => ({ ...p, aud: { ...p.aud, pains: e.target.value } }))} placeholder="I've tried everything and nothing works." /></Fld>
                    <Fld label="Language They Use"><textarea style={{ ...fld(), minHeight: "80px", resize: "vertical" }} value={form.aud.lang} onChange={e => setForm(p => ({ ...p, aud: { ...p.aud, lang: e.target.value } }))} placeholder="how to stop / why can't I" /></Fld>
                  </Section>
                )}

                {tab === "platforms" && (
                  <Section title="Platform Hub">
                    <div style={{ fontSize: "14px", color: T.textSecondary, marginBottom: "20px", ...GA, lineHeight: "1.6" }}>
                      Select every platform this show publishes to. Content will be generated and optimized for each selected platform.
                    </div>
                    <PlatformHub platforms={form.platforms || DEFAULT_PLATFORMS} onChange={pl => setForm(p => ({ ...p, platforms: pl }))} />
                  </Section>
                )}

                {tab === "snnotes" && (
                  <Section title="Show Notes Builder">
                    <div style={{ fontSize: "14px", color: T.textSecondary, marginBottom: "16px", ...GA, lineHeight: "1.6" }}>Toggle which elements to include and drag to set their order.</div>
                    <SNBuilder elements={form.snElements} onChange={el => setForm(p => ({ ...p, snElements: el }))} />
                  </Section>
                )}

                {tab === "boilerplate" && (
                  <Section title="Boilerplate">
                    <div style={{ fontSize: "14px", color: T.textSecondary, marginBottom: "16px", ...GA, lineHeight: "1.6" }}>Automatically appended to Show Notes and YouTube descriptions.</div>
                    <BoilerplateEditor value={form.bp} onChange={v => setForm(p => ({ ...p, bp: v }))} />
                  </Section>
                )}

                {tab === "editing" && (
                  <div>
                    <div style={{ marginBottom: "24px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: T.coral, marginBottom: "6px", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Editing Level</div>
                      <div style={{ fontSize: "14px", color: T.textMuted, marginBottom: "20px", fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: "1.6" }}>Set the editing standard for this show. Editors will see this level and its description as a coaching brief when they open the Editor Companion.</div>
                      {[
                        { id: "1", name: "Level 1 — Clean & Clear", desc: "The goal is a natural, listenable episode with no obvious edit points. Remove long awkward silences unless they are emotional or intentional. Cut anything that clearly signals an edit — mic bumps, false starts, hard stops, technical interruptions. Leave ums, ahs, and filler words unless they are so frequent they disrupt the listening experience. Do not over-edit. The episode should sound like a real conversation, just cleaned up." },
                        { id: "2", name: "Level 2 — Crafted", desc: "The goal is a polished, well-paced episode that holds attention. Everything in Level 1 applies. Additionally: identify and surface the strongest hook moment and restructure the opening if needed. Remove repetitive points, rambling tangents, and run-on sections that dilute the message. Tighten pacing so the conversation flows freely without losing its natural feel. Add lower thirds at key moments. The episode should sound intentional without sounding produced." },
                        { id: "3", name: "Level 3 — Story-Driven", desc: "The goal is a fully crafted narrative. Everything in Levels 1 and 2 applies. Additionally: treat the raw recording as source material, not a final structure. Reconstruct the arc — find the story, build toward it, and edit down aggressively if needed (e.g. a 90-minute interview may become a 45-minute episode). Add b-roll, images, and supporting visuals to reinforce meaning. Re-record inserts may be added to fill gaps in the narrative. The episode should feel like a documentary, not a recording." },
                      ].map(lvl => (
                        <div key={lvl.id} onClick={() => setForm(p => ({ ...p, editingLevel: lvl.id }))}
                          style={{ border: "1px solid " + (form.editingLevel === lvl.id ? T.coral : T.cardBorder), borderRadius: "12px", padding: "20px 24px", marginBottom: "12px", cursor: "pointer", background: form.editingLevel === lvl.id ? T.coral + "10" : T.bg, transition: "all 0.15s" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: form.editingLevel === lvl.id ? T.coral : T.cardBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", color: form.editingLevel === lvl.id ? "#fff" : T.textMuted, flexShrink: 0, fontFamily: "'DM Sans', system-ui, sans-serif" }}>{lvl.id}</div>
                            <div style={{ fontSize: "15px", fontWeight: "700", color: form.editingLevel === lvl.id ? T.coral : T.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>{lvl.name}</div>
                          </div>
                          <div style={{ fontSize: "13px", color: T.textMuted, lineHeight: "1.7", fontFamily: "'DM Sans', system-ui, sans-serif", paddingLeft: "40px" }}>{lvl.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === "epprep" && (
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: T.coral, marginBottom: "4px", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif" }}>The ONE Person</div>
                    <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "16px", fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: "1.6" }}>The single listener this show is made for. Used to write hooks, permission slip closes, and episode structure.</div>
                    <div style={{ display: "grid", gap: "14px", marginBottom: "28px" }}>
                      <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>Name</label><input value={form.epPrep?.onePerson?.name || ""} onChange={e => setForm(p => ({ ...p, epPrep: { ...p.epPrep, onePerson: { ...p.epPrep.onePerson, name: e.target.value } } }))} placeholder="e.g. Sarah" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" }} /></div>
                      <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>2AM Question</label><input value={form.epPrep?.onePerson?.question2AM || ""} onChange={e => setForm(p => ({ ...p, epPrep: { ...p.epPrep, onePerson: { ...p.epPrep.onePerson, question2AM: e.target.value } } }))} placeholder="The question keeping them up at 2AM" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" }} /></div>
                      <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>Core Wound</label><input value={form.epPrep?.onePerson?.wound || ""} onChange={e => setForm(p => ({ ...p, epPrep: { ...p.epPrep, onePerson: { ...p.epPrep.onePerson, wound: e.target.value } } }))} placeholder="The deeper fear or wound underneath the question" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" }} /></div>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: T.coral, marginBottom: "4px", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Story-Mission Connection</div>
                    <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "10px", fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: "1.6" }}>The host's personal connection to this show's mission. Used verbatim in the Bridge section of every episode.</div>
                    <textarea value={form.epPrep?.storyMission || ""} onChange={e => setForm(p => ({ ...p, epPrep: { ...p.epPrep, storyMission: e.target.value } }))} placeholder="Write the host's personal story connection here — this will be used verbatim in the Bridge." rows={5} style={{ width: "100%", padding: "12px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", resize: "vertical", boxSizing: "border-box", marginBottom: "24px" }} />
                    <div style={{ fontSize: "13px", fontWeight: "700", color: T.coral, marginBottom: "4px", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Permission Slip Bank</div>
                    <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "10px", fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: "1.6" }}>One permission slip per line. These are used verbatim in the Permission Slip Close at the end of each episode.</div>
                    <textarea value={form.epPrep?.permissionSlips || ""} onChange={e => setForm(p => ({ ...p, epPrep: { ...p.epPrep, permissionSlips: e.target.value } }))} placeholder={"You have permission to feel all of it.\nYou have permission to not have it figured out.\nYou have permission to begin again."} rows={8} style={{ width: "100%", padding: "12px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                )}

                {tab === "formats" && (
                  <div>
                    {(!form.episodeFormats || form.episodeFormats.length === 0) && !epfShowForm && (
                      <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
                        <div style={{ fontSize: "15px", fontWeight: "600", color: T.text, marginBottom: "6px" }}>No formats yet</div>
                        <div style={{ fontSize: "13px", marginBottom: "20px" }}>Add your first episode format to use Episode Prep.</div>
                      </div>
                    )}
                    {(form.episodeFormats || []).map((fmt, idx) => (
                      <div key={fmt.id || idx} style={{ border: "1px solid " + T.cardBorder, borderRadius: "10px", padding: "16px 20px", marginBottom: "10px", background: T.bg }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                              <div style={{ fontSize: "15px", fontWeight: "700", color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>{fmt.name}</div>
                              {fmt.status === "imported" && <span style={{ fontSize: "10px", background: "#FFF3CD", color: "#856404", border: "1px solid #FFEAA7", borderRadius: "20px", padding: "2px 8px", fontWeight: "700", letterSpacing: "0.5px" }}>IMPORTED — PLEASE REVIEW</span>}
                            </div>
                            <div style={{ fontSize: "13px", color: T.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>{fmt.type}{fmt.targetLength ? " · " + fmt.targetLength : ""}</div>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={() => { setEpfForm({ name: fmt.name, type: fmt.type, targetLength: fmt.targetLength || "", structure: fmt.structure || "", signOffLine: fmt.signOffLine || "", ratingSystem: fmt.ratingSystem || "" }); setEpfEditing(fmt.id || idx); setEpfShowForm(true); }} style={{ padding: "6px 14px", border: "1px solid " + T.cardBorder, borderRadius: "6px", background: "transparent", color: T.text, fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Edit</button>
                            <button onClick={() => setForm(p => ({ ...p, episodeFormats: p.episodeFormats.filter((_, i) => i !== idx) }))} style={{ padding: "6px 14px", border: "1px solid #D94F4F44", borderRadius: "6px", background: "transparent", color: "#D94F4F", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!epfShowForm && (
                      <button onClick={() => { setEpfForm({ name: "", type: "Guest Interview", targetLength: "", structure: "", signOffLine: "", ratingSystem: "" }); setEpfEditing(null); setEpfShowForm(true); }} style={{ width: "100%", padding: "12px", border: "2px dashed " + T.cardBorder, borderRadius: "10px", background: "transparent", color: T.coral, fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", marginTop: "8px" }}>+ Add Format</button>
                    )}
                    {epfShowForm && (
                      <div style={{ border: "1px solid " + T.coral + "40", borderRadius: "12px", padding: "24px", background: T.coral + "08", marginTop: "12px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: T.coral, marginBottom: "20px", fontFamily: "'DM Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "1px" }}>{epfEditing !== null ? "Edit Format" : "New Format"}</div>
                        <div style={{ display: "grid", gap: "14px" }}>
                          <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>Format Name *</label><input value={epfForm.name} onChange={e => setEpfForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Guest Interview, Solo Deep Dive" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" }} /></div>
                          <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>Format Type *</label><select value={epfForm.type} onChange={e => setEpfForm(p => ({ ...p, type: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" }}><option>Guest Interview</option><option>Review & Reaction Panel</option><option>Hot Take & Breaking News</option><option>Solo Monologue</option><option>Custom</option></select></div>
                          <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>Target Length</label><input value={epfForm.targetLength} onChange={e => setEpfForm(p => ({ ...p, targetLength: e.target.value }))} placeholder="e.g. 30–45 min" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" }} /></div>
                          <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>Format Structure *</label><textarea value={epfForm.structure} onChange={e => setEpfForm(p => ({ ...p, structure: e.target.value }))} placeholder={"Paste the full segment structure here:\n\nSEGMENT 1 — HOOK (0:00–1:30)\n...\nSEGMENT 2 — INTRO (1:30–4:00)\nStanding questions: ...\n..."} rows={10} style={{ width: "100%", padding: "12px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "13px", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} /></div>
                          <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>Sign-off Line *</label><input value={epfForm.signOffLine} onChange={e => setEpfForm(p => ({ ...p, signOffLine: e.target.value }))} placeholder="The exact closing line — used verbatim every episode" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" }} /></div>
                          <div><label style={{ fontSize: "12px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", display: "block", marginBottom: "6px" }}>Rating/Scoring System <span style={{ fontWeight: "400", textTransform: "none" }}>(optional — for review formats)</span></label><input value={epfForm.ratingSystem} onChange={e => setEpfForm(p => ({ ...p, ratingSystem: e.target.value }))} placeholder="e.g. Sobees Score 1–5" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.cardBorder, borderRadius: "8px", background: T.bg, color: T.text, fontSize: "14px", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" }} /></div>
                        </div>
                        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                          <button onClick={() => {
                            if (!epfForm.name.trim() || !epfForm.structure.trim()) return;
                            const newFmt = { id: Date.now().toString(), ...epfForm, status: "confirmed" };
                            if (epfEditing !== null) {
                              setForm(p => ({ ...p, episodeFormats: p.episodeFormats.map((f, i) => (f.id === epfEditing || i === epfEditing) ? { ...f, ...epfForm, status: "confirmed" } : f) }));
                            } else {
                              setForm(p => ({ ...p, episodeFormats: [...(p.episodeFormats || []), newFmt] }));
                            }
                            setEpfShowForm(false); setEpfEditing(null); setEpfForm({ name: "", type: "Guest Interview", targetLength: "", structure: "", signOffLine: "", ratingSystem: "" });
                          }} style={{ padding: "12px 24px", background: T.coral, border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Save Format</button>
                          <button onClick={() => { setEpfShowForm(false); setEpfEditing(null); setEpfForm({ name: "", type: "Guest Interview", targetLength: "", structure: "", signOffLine: "", ratingSystem: "" }); }} style={{ padding: "12px 24px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: "8px", color: T.textMuted, fontSize: "14px", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}


              </div>

              <div style={{ padding: "16px 24px", background: T.surface, borderTop: "1px solid " + T.cardBorder, display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: "12px 32px", background: T.coral, border: "none", borderRadius: "6px", color: "#fff", fontSize: "15px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", ...LS, letterSpacing: "2px", textTransform: "uppercase", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving..." : "Save Show →"}
                </button>
                {msg && <div style={{ fontSize: "14px", color: msg.startsWith("Saved") || msg.startsWith("DNA") ? "#52B788" : "#F09090", ...LS }}>{msg}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}