export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { LISTENNOTES_API_KEY, OPENAI_API_KEY } = process.env;
  if (!LISTENNOTES_API_KEY) return res.status(500).json({ error: "Listen Notes API key not configured." });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API key not configured." });

  const { showDna } = req.body || {};
  if (!showDna) return res.status(400).json({ error: "showDna is required." });

  const hostName = showDna.hosts || showDna.name || "the host";

  const showContext = [
    `Show: ${showDna.name || ""}`,
    showDna.tag ? `Description: ${showDna.tag}` : "",
    showDna.hosts ? `Host(s): ${showDna.hosts}` : "",
    showDna.audience?.onePerson?.name ? `Ideal listener: ${showDna.audience.onePerson.name}` : "",
    showDna.audience?.onePerson?.twoAmQuestion ? `Their 2AM question: ${showDna.audience.onePerson.twoAmQuestion}` : "",
    showDna.audience?.onePerson?.wound ? `Their core struggle: ${showDna.audience.onePerson.wound}` : "",
    showDna.audience?.demographics ? `Demographics: ${showDna.audience.demographics}` : "",
    showDna.voice?.hostPersonality ? `Host personality/expertise: ${showDna.voice.hostPersonality}` : "",
    showDna.voice?.coreBeliefs ? `Core beliefs/mission: ${showDna.voice.coreBeliefs}` : "",
  ].filter(Boolean).join("\n");

  try {
    // ── Phase 1: derive 3 targeted search queries from the show DNA ──────────
    const queryRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `You are a podcast booking expert. Given this show's DNA, generate 3 short search queries (1–4 words each) to find podcasts where the host would be a great guest. Focus on AUDIENCE OVERLAP — finding podcasts whose listeners share the same struggles, interests, or worldview as this show's ideal listener. Do NOT use the show's name or tagline. Think about the listener's life, not the show's brand.

SHOW DNA:
${showContext}

Respond ONLY with JSON: {"queries": ["...", "...", "..."]}`,
        }],
        response_format: { type: "json_object" },
      }),
    });
    const queryData = await queryRes.json();
    let queries = [];
    try {
      const parsed = JSON.parse(queryData.choices?.[0]?.message?.content || "{}");
      queries = (parsed.queries || []).slice(0, 3).filter(Boolean);
    } catch (_) {}
    if (queries.length === 0) queries = [showDna.tag || showDna.name || "podcast"];

    // ── Phase 2: search Listen Notes with each query in parallel ─────────────
    const sixMonthsAgo = Math.floor(Date.now() / 1000) - 180 * 24 * 60 * 60;

    const searches = await Promise.all(queries.map(q => {
      const params = new URLSearchParams({
        q,
        type: "podcast",
        language: "English",
        only_in: "title,description",
        published_after: sixMonthsAgo,
        len_min: 10,
      });
      return fetch(`https://listen-api.listennotes.com/api/v2/search?${params}`, {
        headers: { "X-ListenAPI-Key": LISTENNOTES_API_KEY },
      }).then(r => r.json()).catch(() => ({ results: [] }));
    }));

    // Deduplicate by podcast ID, exclude the show itself
    const seen = new Set();
    const showNameLower = (showDna.name || "").toLowerCase();
    const allPodcasts = [];
    for (const s of searches) {
      for (const p of (s.results || [])) {
        const id = p.id;
        const titleLower = (p.title_original || "").toLowerCase();
        if (!seen.has(id) && !titleLower.includes(showNameLower.split(" ")[0]?.toLowerCase() || "___")) {
          seen.add(id);
          allPodcasts.push({
            id,
            title: p.title_original || p.title_highlighted || "",
            description: (p.description_original || p.description_highlighted || "").slice(0, 350),
            publisher: p.publisher_original || p.publisher_highlighted || "",
            website: p.website || "",
            email: p.email || "",
            image: p.thumbnail || p.image || "",
            totalEpisodes: p.total_episodes || 0,
            latestPubMs: p.latest_pub_date_ms || 0,
            listennotesUrl: p.listennotes_url || "",
          });
        }
        if (allPodcasts.length >= 15) break;
      }
      if (allPodcasts.length >= 15) break;
    }

    if (allPodcasts.length === 0) {
      return res.status(200).json({ results: [], queries });
    }

    // ── Phase 3: score audience fit + write personalized pitches ─────────────
    const pitchRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `You are a podcast booking specialist. For each podcast below, assess audience overlap with "${showDna.name}" and write a personalized pitch for ${hostName} to appear as a guest.

SHOW DNA:
${showContext}

For each podcast, output:
- fitScore: integer 1–10 (10 = strong audience overlap, 1 = poor fit)
- audienceOverlap: 1 sentence explaining WHY the audiences overlap (what do they share?)
- hostPitch: 2 sentences on what ${hostName} would bring to their listeners specifically
- suggestedAngle: 1 concrete episode topic that bridges both audiences

Only include podcasts with fitScore >= 5. If a podcast is a poor fit, still include it but with a low score.

PODCASTS:
${allPodcasts.map((p, i) => `${i + 1}. "${p.title}" (${p.publisher}) — ${p.description}`).join("\n\n")}

Respond ONLY with JSON: {"pitches": [{"index": 1, "fitScore": 8, "audienceOverlap": "...", "hostPitch": "...", "suggestedAngle": "..."}, ...]}`,
        }],
        response_format: { type: "json_object" },
      }),
    });

    const pitchData = await pitchRes.json();
    let pitches = [];
    try {
      const parsed = JSON.parse(pitchData.choices?.[0]?.message?.content || "{}");
      pitches = parsed.pitches || [];
    } catch (_) {}

    // Merge, filter poor fits, sort by score
    const results = allPodcasts
      .map((p, i) => {
        const pitch = pitches.find(pt => pt.index === i + 1) || null;
        return { ...p, pitch, fitScore: pitch?.fitScore || 0 };
      })
      .filter(p => p.fitScore >= 5)
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 10);

    return res.status(200).json({ results, queries, hostName });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
