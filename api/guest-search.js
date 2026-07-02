export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { LISTENNOTES_API_KEY, OPENAI_API_KEY } = process.env;
  if (!LISTENNOTES_API_KEY) return res.status(500).json({ error: "Listen Notes API key not configured." });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API key not configured." });

  const { showDna, hostName, searchQuery, maxResults = 10 } = req.body || {};
  if (!searchQuery) return res.status(400).json({ error: "searchQuery is required." });

  try {
    // 1. Search Listen Notes for active podcasts (published in the last 6 months)
    const sixMonthsAgo = Math.floor(Date.now() / 1000) - 180 * 24 * 60 * 60;
    const params = new URLSearchParams({
      q: searchQuery,
      type: "podcast",
      language: "English",
      only_in: "title,description",
      published_after: sixMonthsAgo,
      len_min: 10, // at least 10 episodes — confirms it's an active, established show
    });

    const lnRes = await fetch(`https://listen-api.listennotes.com/api/v2/search?${params}`, {
      headers: { "X-ListenAPI-Key": LISTENNOTES_API_KEY },
    });
    const lnData = await lnRes.json();

    if (!lnRes.ok) {
      return res.status(lnRes.status).json({ error: lnData?.message || "Listen Notes API error." });
    }

    const raw = (lnData.results || []).slice(0, maxResults);
    const podcasts = raw.map(p => ({
      id: p.id,
      title: p.title_original || p.title_highlighted || "",
      description: (p.description_original || p.description_highlighted || "").slice(0, 300),
      publisher: p.publisher_original || p.publisher_highlighted || "",
      website: p.website || "",
      email: p.email || "",
      image: p.thumbnail || p.image || "",
      totalEpisodes: p.total_episodes || 0,
      latestPubMs: p.latest_pub_date_ms || 0,
      listennotesUrl: p.listennotes_url || "",
    }));

    if (podcasts.length === 0) {
      return res.status(200).json({ results: [] });
    }

    // 2. Generate personalized pitches with GPT-4o
    const showContext = [
      showDna?.name ? `Show: ${showDna.name}` : "",
      showDna?.tag ? `Niche: ${showDna.tag}` : "",
      showDna?.audience?.onePerson?.name ? `Target listener: ${showDna.audience.onePerson.name}` : "",
      showDna?.audience?.onePerson?.twoAmQuestion ? `Their 2AM question: ${showDna.audience.onePerson.twoAmQuestion}` : "",
      showDna?.audience?.onePerson?.wound ? `Core wound/struggle: ${showDna.audience.onePerson.wound}` : "",
      showDna?.voice?.hostPersonality ? `Host personality: ${showDna.voice.hostPersonality}` : "",
    ].filter(Boolean).join("\n");

    const pitchPrompt = `You are a podcast booking specialist. Based on the show DNA below, write a short personalized pitch for each podcast explaining why ${hostName || "this host"} would be a great guest.

SHOW DNA:
${showContext}

For each podcast numbered below, output JSON with these fields:
- audienceFit: 1 sentence on why the audiences align
- hostPitch: 2 sentences on what ${hostName || "the host"} would bring to their listeners
- suggestedAngle: 1 specific episode topic or angle that would resonate

PODCASTS:
${podcasts.map((p, i) => `${i + 1}. "${p.title}" (${p.publisher}) — ${p.description}`).join("\n\n")}

Respond ONLY with valid JSON in this format:
{"pitches": [{"index": 1, "audienceFit": "...", "hostPitch": "...", "suggestedAngle": "..."}, ...]}`;

    const oaRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 3000,
        messages: [{ role: "user", content: pitchPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    const oaData = await oaRes.json();
    let pitches = [];
    try {
      const parsed = JSON.parse(oaData.choices?.[0]?.message?.content || "{}");
      pitches = parsed.pitches || [];
    } catch (_) {
      pitches = [];
    }

    // 3. Merge pitches into podcast results
    const results = podcasts.map((p, i) => ({
      ...p,
      pitch: pitches.find(pt => pt.index === i + 1) || null,
    }));

    return res.status(200).json({ results });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
