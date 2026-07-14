export default async function handler(req, res) {
  const { SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL } = process.env;
  if (!SUPABASE_SERVICE_ROLE_KEY || !VITE_SUPABASE_URL) {
    return res.status(500).json({ error: "Server not configured." });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Auth: verify caller is an owner-plan org ──────────────────
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Unauthorized." });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized." });

  const { data: profile } = await admin
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return res.status(403).json({ error: "Forbidden." });

  const { data: org } = await admin
    .from("organizations")
    .select("plan")
    .eq("id", profile.org_id)
    .single();

  if (org?.plan !== "owner") return res.status(403).json({ error: "Forbidden." });

  // ── Route by method + action ──────────────────────────────────
  const action = req.query.action;

  // GET /api/superadmin?action=orgs — list all orgs with user counts
  if (req.method === "GET" && action === "orgs") {
    const { data: orgs, error } = await admin
      .from("organizations")
      .select("id, name, plan, beta_expires_at, account_type, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Get profile counts per org
    const { data: profiles } = await admin
      .from("profiles")
      .select("org_id, role");

    const countsByOrg = {};
    (profiles || []).forEach(p => {
      if (!countsByOrg[p.org_id]) countsByOrg[p.org_id] = { total: 0, admins: 0 };
      countsByOrg[p.org_id].total++;
      if (p.role === "admin") countsByOrg[p.org_id].admins++;
    });

    const result = orgs.map(o => ({
      ...o,
      userCount: countsByOrg[o.id]?.total || 0,
      adminCount: countsByOrg[o.id]?.admins || 0,
    }));

    return res.status(200).json({ orgs: result });
  }

  // GET /api/superadmin?action=org-users&orgId=xxx — list users in an org
  if (req.method === "GET" && action === "org-users") {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).json({ error: "orgId required." });

    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, name, role, timezone")
      .eq("org_id", orgId);
    if (error) return res.status(500).json({ error: error.message });

    // Fetch emails from auth
    const withEmails = await Promise.all(
      (profiles || []).map(async p => {
        try {
          const r = await fetch(`${VITE_SUPABASE_URL}/auth/v1/admin/users/${p.id}`, {
            headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          });
          const u = await r.json();
          return { ...p, email: u.email || "", lastSignIn: u.last_sign_in_at || "" };
        } catch { return { ...p, email: "", lastSignIn: "" }; }
      })
    );

    return res.status(200).json({ users: withEmails });
  }

  // GET /api/superadmin?action=codes — list access codes
  if (req.method === "GET" && action === "codes") {
    const { data, error } = await admin
      .from("access_codes")
      .select("id, code, max_uses, uses, active, note, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ codes: data });
  }

  // PATCH /api/superadmin?action=update-org — update plan/expiry/status
  if (req.method === "PATCH" && action === "update-org") {
    const { orgId, plan, betaExpiresAt, active } = req.body || {};
    if (!orgId) return res.status(400).json({ error: "orgId required." });

    const updates = {};
    if (plan !== undefined) updates.plan = plan;
    if (betaExpiresAt !== undefined) updates.beta_expires_at = betaExpiresAt;
    if (active === false) updates.plan = "inactive";

    const { error } = await admin.from("organizations").update(updates).eq("id", orgId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // POST /api/superadmin?action=create-code — create a new access code
  if (req.method === "POST" && action === "create-code") {
    const { code, maxUses, note } = req.body || {};
    if (!code) return res.status(400).json({ error: "code required." });

    const { data, error } = await admin
      .from("access_codes")
      .insert({ code: code.toUpperCase().trim(), max_uses: maxUses || 1, note: note || "" })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ code: data });
  }

  // PATCH /api/superadmin?action=toggle-code — activate/deactivate a code
  if (req.method === "PATCH" && action === "toggle-code") {
    const { codeId, active } = req.body || {};
    if (!codeId) return res.status(400).json({ error: "codeId required." });

    const { error } = await admin.from("access_codes").update({ active }).eq("id", codeId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: "Unknown action." });
}
