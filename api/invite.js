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
    const { email, role, orgId, assignedShow, allowedModes } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required." });
    }
    const response = await fetch(`${supabaseUrl}/auth/v1/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        data: {
          role: role || "editor",
          org_id: orgId,
          ...(assignedShow ? { assigned_show: assignedShow } : {}),
          ...(allowedModes ? { allowed_modes: allowedModes } : {}),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.msg || data?.message || "Failed to send invite.",
      });
    }

    return res.status(200).json({ success: true, email });
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
