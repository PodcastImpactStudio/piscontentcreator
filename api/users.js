export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(500).json({ error: "Supabase service role key not configured." });
  }

  const orgId = req.query.orgId;
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required." });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated and belongs to the requested org
    const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (!token) return res.status(401).json({ error: "Unauthorized." });
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Unauthorized." });
    const { data: callerProfile, error: profErr } = await admin
      .from("profiles").select("org_id, role").eq("id", user.id).single();
    if (profErr || !callerProfile) return res.status(403).json({ error: "Forbidden." });
    if (callerProfile.org_id !== orgId) return res.status(403).json({ error: "Forbidden." });

    // Get all profile rows for this org
    const { data: profileRows, error: profileErr } = await admin
      .from("profiles")
      .select("id, name, role")
      .eq("org_id", orgId);

    if (profileErr) throw profileErr;

    // Fetch auth user details for each profile in this org
    const userDetails = await Promise.all(
      (profileRows || []).map(p =>
        fetch(`${supabaseUrl}/auth/v1/admin/users/${p.id}`, {
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        }).then(r => r.json())
      )
    );

    const users = userDetails
      .filter(u => u.id)
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.full_name || u.user_metadata?.name || "",
        createdAt: u.created_at,
      }));

    return res.status(200).json({ users });
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
