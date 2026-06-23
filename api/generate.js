export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { OPENAI_API_KEY } = process.env;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "API not configured." });

  const { model, max_tokens, messages, system } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required." });
  }

  try {
    // The frontend speaks Anthropic-style ({ system, messages:[{role,content}] }).
    // Translate to OpenAI Chat Completions: system becomes the first message.
    const oaMessages = [];
    if (system) oaMessages.push({ role: "system", content: system });
    for (const m of messages) {
      // Anthropic content can be a string or an array of blocks — normalize to string.
      const content = Array.isArray(m.content)
        ? m.content.filter(b => b.type === "text").map(b => b.text).join("\n")
        : m.content;
      oaMessages.push({ role: m.role, content });
    }

    // Use the incoming model only if it's an OpenAI model; otherwise default to gpt-4o
    // (the frontend still passes Claude ids, which OpenAI would reject).
    const oaModel = typeof model === "string" && model.startsWith("gpt") ? model : "gpt-4o";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: oaModel,
        max_tokens: max_tokens || 8000,
        messages: oaMessages,
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error || data });

    // Translate OpenAI response back into the Anthropic-style shape the frontend parses:
    // { content: [{ type: "text", text: "..." }] }
    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
