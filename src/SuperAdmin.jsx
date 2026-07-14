import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";

const T = {
  bg: "#F5F0E8", surface: "#FDFAF5", card: "#FFFFFF", cardBorder: "#E2D9CC",
  text: "#1A1A1A", textSecondary: "#4A3F35", textMuted: "#6B5E52",
  coral: "#7A0019", coralSoft: "#7A001910", coralMid: "#7A001928",
  green: "#2D6A4F", greenSoft: "rgba(45,106,79,0.08)",
  amber: "#92650A", amberSoft: "rgba(146,101,10,0.08)",
  blue: "#1B4F8A", blueSoft: "rgba(27,79,138,0.08)",
};

const PF = "'DM Sans', system-ui, sans-serif";

const PLANS = ["beta", "starter", "pro", "agency", "owner", "inactive"];

const PLAN_COLOR = {
  beta:     { bg: T.amberSoft,  border: T.amber,  text: T.amber  },
  starter:  { bg: T.blueSoft,   border: T.blue,   text: T.blue   },
  pro:      { bg: T.greenSoft,  border: T.green,  text: T.green  },
  agency:   { bg: T.coralSoft,  border: T.coral,  text: T.coral  },
  owner:    { bg: "rgba(100,60,180,0.08)", border: "#6B3CB5", text: "#6B3CB5" },
  inactive: { bg: "rgba(80,80,80,0.2)", border: "#555", text: "#777" },
};

function planBadge(plan) {
  const c = PLAN_COLOR[plan] || PLAN_COLOR.beta;
  return (
    <span style={{ padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700",
      letterSpacing: "1px", textTransform: "uppercase", fontFamily: PF,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {plan}
    </span>
  );
}

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

async function api(method, action, body, token) {
  const url = `/api/superadmin?action=${action}`;
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function SuperAdmin({ onClose }) {
  const [token, setToken] = useState(null);
  const [tab, setTab] = useState("accounts");
  const [orgs, setOrgs] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);

  // Edit org state
  const [editPlan, setEditPlan] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // New code state
  const [newCode, setNewCode] = useState("");
  const [newCodeMax, setNewCodeMax] = useState("10");
  const [newCodeNote, setNewCodeNote] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);

  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data?.session?.access_token;
      setToken(t);
    });
  }, []);

  const loadOrgs = useCallback(async (t) => {
    if (!t) return;
    try {
      const data = await api("GET", "orgs", null, t);
      setOrgs(data.orgs || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadCodes = useCallback(async (t) => {
    if (!t) return;
    try {
      const data = await api("GET", "codes", null, t);
      setCodes(data.codes || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([loadOrgs(token), loadCodes(token)]).finally(() => setLoading(false));
  }, [token, loadOrgs, loadCodes]);

  async function selectOrg(org) {
    setSelectedOrg(org);
    setEditPlan(org.plan);
    setEditExpiry(org.beta_expires_at ? org.beta_expires_at.substring(0, 10) : "");
    setSaveMsg("");
    setOrgUsers([]);
    setOrgUsersLoading(true);
    try {
      const data = await api("GET", `org-users&orgId=${org.id}`, null, token);
      setOrgUsers(data.users || []);
    } catch (e) { console.error(e); }
    finally { setOrgUsersLoading(false); }
  }

  async function saveOrg() {
    if (!selectedOrg) return;
    setSaving(true); setSaveMsg("");
    try {
      await api("PATCH", "update-org", {
        orgId: selectedOrg.id,
        plan: editPlan,
        betaExpiresAt: editPlan === "owner" ? null : (editExpiry || null),
      }, token);
      setSaveMsg("✓ Saved");
      await loadOrgs(token);
      setSelectedOrg(o => ({ ...o, plan: editPlan, beta_expires_at: editExpiry || null }));
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e) { setSaveMsg("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function extendBeta(months) {
    const base = selectedOrg?.beta_expires_at && new Date(selectedOrg.beta_expires_at) > new Date()
      ? new Date(selectedOrg.beta_expires_at)
      : new Date();
    base.setMonth(base.getMonth() + months);
    const iso = base.toISOString();
    setEditExpiry(iso.substring(0, 10));
    setSaving(true); setSaveMsg("");
    try {
      await api("PATCH", "update-org", { orgId: selectedOrg.id, betaExpiresAt: iso }, token);
      setSaveMsg(`✓ Extended ${months} month${months > 1 ? "s" : ""}`);
      await loadOrgs(token);
      setSelectedOrg(o => ({ ...o, beta_expires_at: iso }));
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e) { setSaveMsg("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function createCode() {
    if (!newCode.trim()) return;
    setCreatingCode(true);
    try {
      await api("POST", "create-code", { code: newCode.trim(), maxUses: parseInt(newCodeMax) || 10, note: newCodeNote.trim() }, token);
      setNewCode(""); setNewCodeMax("10"); setNewCodeNote("");
      await loadCodes(token);
    } catch (e) { alert(e.message); }
    finally { setCreatingCode(false); }
  }

  async function toggleCode(code) {
    try {
      await api("PATCH", "toggle-code", { codeId: code.id, active: !code.active }, token);
      await loadCodes(token);
    } catch (e) { alert(e.message); }
  }

  const filteredOrgs = orgs.filter(o =>
    !search || o.name?.toLowerCase().includes(search.toLowerCase())
  );

  const inp = { width: "100%", background: T.surface, border: `1px solid ${T.cardBorder}`,
    borderRadius: "8px", padding: "10px 14px", color: T.text, fontSize: "14px",
    fontFamily: PF, outline: "none", boxSizing: "border-box" };

  const btn = (bg, col = "#fff") => ({
    padding: "9px 20px", background: bg, border: "none", borderRadius: "8px",
    color: col, fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: PF,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 2000, display: "flex", flexDirection: "column", fontFamily: PF }}>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${T.cardBorder};border-radius:3px} button:hover{opacity:.85}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: `1px solid ${T.cardBorder}`, background: T.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src="/logo-nav.png" alt="" style={{ height: "28px", objectFit: "contain" }} />
            <span style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "2.5px", color: T.coral, textTransform: "uppercase", borderLeft: `1px solid ${T.cardBorder}`, paddingLeft: "10px" }}>Owner Admin</span>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {[["accounts", "Accounts"], ["codes", "Access Codes"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ padding: "7px 16px", background: tab === id ? T.coral : "transparent",
                  border: `1px solid ${tab === id ? T.coral : T.cardBorder}`,
                  borderRadius: "6px", color: tab === id ? "#fff" : T.textMuted,
                  fontSize: "13px", cursor: "pointer", fontFamily: PF, fontWeight: "600" }}>
                {label}
                <span style={{ marginLeft: "6px", fontSize: "11px", opacity: 0.7 }}>
                  ({id === "accounts" ? orgs.length : codes.length})
                </span>
              </button>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={{ padding: "7px 16px", background: "transparent", border: `1px solid ${T.cardBorder}`, borderRadius: "6px", color: T.textMuted, fontSize: "13px", cursor: "pointer", fontFamily: PF }}>✕ Close</button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "32px", height: "32px", border: `2px solid ${T.cardBorder}`, borderTopColor: T.coral, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : tab === "accounts" ? (

        /* ── ACCOUNTS TAB ─────────────────────────────────────── */
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Left — org list */}
          <div style={{ width: "340px", borderRight: `1px solid ${T.cardBorder}`, display: "flex", flexDirection: "column", flexShrink: 0, background: T.surface }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search accounts…" style={{ ...inp, padding: "8px 12px" }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredOrgs.map(org => {
                const days = daysLeft(org.beta_expires_at);
                const isSelected = selectedOrg?.id === org.id;
                const isExpired = days !== null && days < 0;
                return (
                  <div key={org.id} onClick={() => selectOrg(org)}
                    style={{ padding: "14px 16px", borderBottom: `1px solid ${T.cardBorder}`, cursor: "pointer",
                      background: isSelected ? T.card : "transparent", borderLeft: `3px solid ${isSelected ? T.coral : "transparent"}`, transition: "all .1s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: T.text, flex: 1, marginRight: "8px" }}>{org.name}</div>
                      {planBadge(org.plan)}
                    </div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: T.textMuted }}>
                      <span>{org.userCount} user{org.userCount !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>Joined {fmt(org.created_at)}</span>
                    </div>
                    {org.plan === "beta" && days !== null && (
                      <div style={{ marginTop: "4px", fontSize: "11px", color: isExpired ? T.coral : days < 14 ? T.amber : T.textMuted }}>
                        {isExpired ? "⚠ Beta expired" : `Beta expires in ${days}d`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — org detail */}
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
            {!selectedOrg ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.textMuted, fontSize: "15px" }}>
                Select an account to manage it
              </div>
            ) : (
              <>
                {/* Org header */}
                <div style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                    <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: T.text }}>{selectedOrg.name}</h2>
                    {planBadge(selectedOrg.plan)}
                  </div>
                  <div style={{ fontSize: "13px", color: T.textMuted }}>
                    {selectedOrg.account_type} · Joined {fmt(selectedOrg.created_at)} · {selectedOrg.userCount} user{selectedOrg.userCount !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Plan + expiry editor */}
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "24px", marginBottom: "20px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "2px", color: T.coral, marginBottom: "16px" }}>PLAN SETTINGS</div>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "140px" }}>
                      <label style={{ fontSize: "11px", color: T.textMuted, display: "block", marginBottom: "6px", letterSpacing: "1px" }}>PLAN</label>
                      <select value={editPlan} onChange={e => setEditPlan(e.target.value)}
                        style={{ ...inp, cursor: "pointer" }}>
                        {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    {editPlan !== "owner" && (
                      <div style={{ flex: 1, minWidth: "140px" }}>
                        <label style={{ fontSize: "11px", color: T.textMuted, display: "block", marginBottom: "6px", letterSpacing: "1px" }}>BETA EXPIRES</label>
                        <input type="date" value={editExpiry} onChange={e => setEditExpiry(e.target.value)} style={inp} />
                      </div>
                    )}
                  </div>

                  {/* Quick extend buttons */}
                  {editPlan === "beta" && (
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "8px", letterSpacing: "1px" }}>QUICK EXTEND</div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {[1, 2, 3, 6].map(m => (
                          <button key={m} onClick={() => extendBeta(m)}
                            style={{ ...btn(T.bg, T.textSecondary), border: `1px solid ${T.cardBorder}`, fontSize: "12px", padding: "6px 12px" }}>
                            +{m} month{m > 1 ? "s" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button onClick={saveOrg} disabled={saving}
                      style={{ ...btn(T.coral), opacity: saving ? .6 : 1 }}>
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                    {saveMsg && <span style={{ fontSize: "13px", color: saveMsg.startsWith("✓") ? T.green : T.coral }}>{saveMsg}</span>}
                  </div>
                </div>

                {/* Users */}
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "24px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "2px", color: T.coral, marginBottom: "16px" }}>TEAM MEMBERS</div>
                  {orgUsersLoading ? (
                    <div style={{ color: T.textMuted, fontSize: "13px" }}>Loading…</div>
                  ) : orgUsers.length === 0 ? (
                    <div style={{ color: T.textMuted, fontSize: "13px" }}>No users found.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {orgUsers.map(u => (
                        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: T.bg, borderRadius: "8px", border: `1px solid ${T.cardBorder}` }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: T.text }}>{u.name || "(no name)"}</div>
                            <div style={{ fontSize: "12px", color: T.textMuted, marginTop: "2px" }}>{u.email}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px" }}>{u.role}</span>
                            {u.lastSignIn && <span style={{ fontSize: "11px", color: T.textMuted }}>Last in: {fmt(u.lastSignIn)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

      ) : (

        /* ── ACCESS CODES TAB ─────────────────────────────────── */
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", maxWidth: "800px" }}>

          {/* Create new code */}
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "2px", color: T.coral, marginBottom: "16px" }}>CREATE NEW CODE</div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
              <div style={{ flex: 2, minWidth: "140px" }}>
                <label style={{ fontSize: "11px", color: T.textMuted, display: "block", marginBottom: "6px", letterSpacing: "1px" }}>CODE</label>
                <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PODCAST2025" style={inp} />
              </div>
              <div style={{ flex: 1, minWidth: "80px" }}>
                <label style={{ fontSize: "11px", color: T.textMuted, display: "block", marginBottom: "6px", letterSpacing: "1px" }}>MAX USES</label>
                <input type="number" value={newCodeMax} onChange={e => setNewCodeMax(e.target.value)}
                  min="1" style={inp} />
              </div>
              <div style={{ flex: 2, minWidth: "140px" }}>
                <label style={{ fontSize: "11px", color: T.textMuted, display: "block", marginBottom: "6px", letterSpacing: "1px" }}>NOTE (optional)</label>
                <input value={newCodeNote} onChange={e => setNewCodeNote(e.target.value)}
                  placeholder="e.g. For Podcast Summit attendees" style={inp} />
              </div>
            </div>
            <button onClick={createCode} disabled={!newCode.trim() || creatingCode}
              style={{ ...btn(T.coral), opacity: !newCode.trim() || creatingCode ? .5 : 1 }}>
              {creatingCode ? "Creating…" : "Create Code"}
            </button>
          </div>

          {/* Existing codes */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {codes.map(c => {
              const pct = c.max_uses > 0 ? Math.round((c.uses / c.max_uses) * 100) : 0;
              return (
                <div key={c.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "16px", fontWeight: "700", color: T.text, letterSpacing: "1px" }}>{c.code}</span>
                        <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "700", letterSpacing: "1px",
                          background: c.active ? T.greenSoft : "rgba(80,80,80,0.2)",
                          border: `1px solid ${c.active ? T.green : "#555"}`,
                          color: c.active ? T.green : "#666" }}>
                          {c.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>
                      {c.note && <div style={{ fontSize: "12px", color: T.textMuted }}>{c.note}</div>}
                    </div>
                    <button onClick={() => toggleCode(c)}
                      style={{ ...btn(c.active ? T.bg : T.greenSoft, c.active ? T.textMuted : T.green),
                        border: `1px solid ${c.active ? T.cardBorder : T.green}`, fontSize: "12px", padding: "6px 12px" }}>
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>

                  {/* Usage bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ flex: 1, height: "4px", background: T.surface, borderRadius: "2px" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct >= 90 ? T.coral : pct >= 60 ? T.amber : T.green, borderRadius: "2px", transition: "width .3s" }} />
                    </div>
                    <span style={{ fontSize: "12px", color: T.textMuted, whiteSpace: "nowrap" }}>
                      {c.uses} / {c.max_uses} used
                    </span>
                    <span style={{ fontSize: "11px", color: T.textMuted }}>Created {fmt(c.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
