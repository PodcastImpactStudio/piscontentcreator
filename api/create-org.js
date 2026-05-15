export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL } = process.env;
  if (!SUPABASE_SERVICE_ROLE_KEY || !VITE_SUPABASE_URL) {
    return res.status(500).json({ error: "Server not configured." });
  }

  const { userId, orgName, userName, timezone, accessCode, accountType } = req.body || {};
  if (!userId || !orgName || !userName) {
    return res.status(400).json({ error: "userId, orgName, and userName are required." });
  }

  // Validate access code
  if (accessCode) {
    const { data: codeRow } = await (await import("@supabase/supabase-js"))
      .createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      .from("access_codes")
      .select("id, uses, max_uses, active")
      .eq("code", accessCode.trim().toUpperCase())
      .maybeSingle();
    if (!codeRow || !codeRow.active || codeRow.uses >= codeRow.max_uses) {
      return res.status(400).json({ error: "Invalid or expired access code." });
    }
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Step 1: Create the profile first (owner_id FK references profiles)
    const { error: profErr } = await admin.from("profiles").upsert({
      id: userId,
      name: userName,
      timezone: timezone || "America/Vancouver",
      role: "admin",
      org_id: null,
    });
    if (profErr) throw profErr;

    // Step 2: Create the organization (owner_id now has a valid profile to reference)
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);

    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    const finalSlug = existing
      ? `${slug}-${Math.random().toString(36).substring(2, 6)}`
      : slug;

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: orgName, slug: finalSlug, owner_id: userId, account_type: accountType || "solo" })
      .select()
      .single();
    if (orgErr) throw orgErr;

    // Step 3: Update profile with the org_id now that org exists
    const { error: profUpdateErr } = await admin.from("profiles").update({
      org_id: org.id,
    }).eq("id", userId);
    if (profUpdateErr) throw profUpdateErr;

    // Redeem the access code
    if (accessCode) {
      const { data: codeRow } = await admin.from("access_codes").select("uses").eq("code", accessCode.trim().toUpperCase()).maybeSingle();
      if (codeRow) {
        await admin.from("access_codes").update({ uses: codeRow.uses + 1 }).eq("code", accessCode.trim().toUpperCase());
      }
    }

    return res.status(200).json({ success: true, orgId: org.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
