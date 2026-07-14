export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { projectId, prompt, apiKey: userApiKey } = req.body;
  const apiKey = userApiKey?.trim() || process.env.DESCRIPT_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "No Descript API key found. Add your Descript API key in Podcast Settings → Editor tab for this show." });
  }
  if (!projectId || !prompt) {
    return res.status(400).json({ error: "Missing projectId or prompt" });
  }

  // Try the Descript API - log full error details back to client for debugging
  try {
    const url = `https://api.descript.com/v2/projects/${projectId}/agent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      // Return full details so we can debug
      return res.status(response.status).json({
        error: data?.message || data?.error || "Descript API error",
        status: response.status,
        details: data,
        url_used: url,
        key_prefix: apiKey.substring(0, 8) + "...",
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to reach Descript API: " + err.message });
  }
}
