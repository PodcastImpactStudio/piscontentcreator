export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(500).json({ error: "Supabase service role key not configured." });
  }

  try {
    const { email, role, orgId, assignedShows, allowedModes } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required." });
    if (!orgId) return res.status(400).json({ error: "orgId is required." });

    const emailLower = email.toLowerCase().trim();
    const metadata = {
      role: role || "editor",
      org_id: orgId,
      ...(assignedShows?.length > 0 ? { assigned_shows: assignedShows } : {}),
      ...(allowedModes ? { allowed_modes: allowedModes } : {}),
    };

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Look up an existing auth user with this email
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const existing = (list?.users || []).find(u => u.email?.toLowerCase() === emailLower);

    let userId;
    let status; // "invited" (new) or "updated" (already registered)

    if (existing) {
      // Already registered — update their metadata (org + role) instead of erroring out
      const { data: upd, error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        user_metadata: { ...(existing.user_metadata || {}), ...metadata },
      });
      if (updErr) throw updErr;
      userId = upd?.user?.id || existing.id;
      status = "updated";
    } else {
      // New user — send the invite email (creates the auth account with metadata)
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(emailLower, { data: metadata });
      if (invErr) throw invErr;
      userId = inv?.user?.id;
      status = "invited";
    }

    // Ensure a profile row exists immediately so the user shows up in the team list
    // (the team list is built from profiles filtered by org_id). Only id/org_id/role
    // are set here — name is filled in by the user during account setup, so an existing
    // name is preserved by the upsert.
    if (userId) {
      const { error: profErr } = await admin
        .from("profiles")
        .upsert({ id: userId, org_id: orgId, role: metadata.role }, { onConflict: "id" });
      if (profErr) throw profErr;
    }

    return res.status(200).json({ success: true, email: emailLower, status });
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
