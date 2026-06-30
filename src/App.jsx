import { useState, useRef, useEffect } from "react";
import { loadShows, saveShow } from "./lib/shows";
import Auth from "./Auth";
import Profile from "./Profile";
import { supabase } from "./lib/supabase";
import { AdminPanel, AdminGate } from "./AdminPanel";

// API calls go through /api/generate (server-side) — key is never in the browser
async function claudeAPI(body, attempt = 0) {
  const MAX_RETRIES = 4;
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const errType = data?.error?.type || "";
    const isTransient = r.status === 529 || r.status === 429 || r.status === 503 || r.status === 500
      || errType === "overloaded_error" || errType === "rate_limit_error" || errType === "api_error";
    if (isTransient && attempt < MAX_RETRIES) {
      // exponential backoff with jitter: ~1s, 2s, 4s, 8s
      const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
      await new Promise(res => setTimeout(res, delay));
      return claudeAPI(body, attempt + 1);
    }
    if (isTransient) throw new Error("Anthropic's servers are busy right now (high demand). Please wait a moment and click Generate again.");
    throw new Error(JSON.stringify(data.error || data));
  }
  return data;
}

const T = {
  bg: "#F5F0E8", surface: "#FDFAF5", card: "#FFFFFF", cardBorder: "#E2D9CC",
  text: "#1A1A1A", textSecondary: "#4A3F35", textMuted: "#6B5E52",
  coral: "#7A0019", coralSoft: "#7A001910", coralMid: "#7A001928", red: "#7A0019",
};

const MODES = [
  { id: "full", icon: "📦", label: "Full Content Package", desc: "Show notes, YouTube description, social captions, newsletter, blog post & quote cards — everything from one transcript" },
  { id: "clips", icon: "✂️", label: "Short-Form Content", desc: "SEO-optimized titles, captions & hashtags for YouTube Shorts, Instagram Reels, TikTok & Facebook Reels" },
  { id: "editor", icon: "🎬", label: "Editor Companion", desc: "A coaching brief for your editor — editing level guidance, best clip moments with timestamps, and sections to cut based on your show's standard." },
  { id: "prep", icon: "📋", label: "Episode Prep", desc: "Generate a complete episode outline with scripted hook, wound bridge, and permission slip close — tailored to your show format and guest or topic." },
];
const PF = "'DM Sans', system-ui, sans-serif";

function strip(t){if(!t)return "";const B=String.fromCharCode(96);const r1=new RegExp(B+"{3}[\\s\\S]*?"+B+"{3}","g");const r2=new RegExp(B+"([^"+B+"]+)"+B,"g");return t.replace(/^#{1,6}\s+/gm,"").replace(/\*\*\*(.*?)\*\*\*/g,"$1").replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1").replace(/__(.*?)__/g,"$1").replace(r1,"").replace(r2,"$1").replace(/^\s*[-*+]\s+/gm,"- ").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/^>\s+/gm,"").replace(/^---+$/gm,"").replace(/\n{3,}/g,"\n\n").trim();}
function parse(raw){const ps=[
  // Episode Prep sections (checked first — more specific)
  {id:"prep-series",     r:[/SERIES PLAN/i]},
  {id:"prep-topics",     r:[/SUGGESTED TOPICS/i]},
  {id:"prep-package",    r:[/EPISODE PREP PACKAGE/i]},
  {id:"prep-hook",       r:[/^HOOK\b/i,/^HOOK\s*\(/i]},
  {id:"prep-bridge",     r:[/^BRIDGE\b/i,/^BRIDGE\s*\(/i]},
  {id:"prep-permission", r:[/PERMISSION SLIP CLOSE/i]},
  {id:"prep-structure",  r:[/^EPISODE STRUCTURE/i]},
  {id:"prep-research",   r:[/^GUEST RESEARCH/i]},
  {id:"prep-questions",  r:[/TAILORED INTERVIEW QUESTIONS/i,/^TAILORED QUESTIONS/i]},
  {id:"prep-clips",      r:[/^CLIP PRIORITIES/i]},
  {id:"prep-titles",     r:[/SUGGESTED EPISODE TITLES/i,/^SEO.*TITLES/i]},
  {id:"prep-checklist",  r:[/PRE-RECORDING CHECKLIST/i]},
  // Full content sections
  {id:"titles",r:[/SEO TITLE/i]},{id:"shownotes",r:[/SHOW NOTES/i]},{id:"spotify-creators",r:[/SPOTIFY FOR CREATORS/i]},{id:"editor-hooks",r:[/INTRO HOOK REC/i]},{id:"editor-clips",r:[/SOCIAL (MEDIA )?CLIP REC/i,/SOCIAL CLIP REC/i]},{id:"editor-notes",r:[/EDITOR NOTES/i]},{id:"youtube",r:[/YOUTUBE DESC/i]},{id:"youtube-quiz",r:[/YOUTUBE QUIZ/i]},{id:"youtube-thumbnail",r:[/YOUTUBE THUMBNAIL/i,/THUMBNAIL TITLE/i]},{id:"social",r:[/SOCIAL MEDIA(?! CLIP)/i]},{id:"quotes",r:[/QUOTE CARDS/i,/PULL QUOTES/i]},{id:"poll-questions",r:[/POLL QUESTIONS/i]},{id:"story-slides",r:[/STORY SLIDES/i]},{id:"engagement-prompts",r:[/ENGAGEMENT PROMPTS/i]},{id:"takeaway-graphics",r:[/KEY TAKEAWAY GRAPHICS/i]},{id:"guestkit",r:[/GUEST SHARE/i]},{id:"email",r:[/EMAIL NEWS/i,/^(?!.*(PATREON|CIRCLE|MIGHTY|KAJABI|SKOOL|FACEBOOK GROUP)).*NEWSLETTER/i]},{id:"blog",r:[/BLOG ART/i,/BLOG POST/i]},{id:"community-companion",r:[/COMPANION POST/i]},{id:"community-prompts",r:[/COMMUNITY FEED PROMPTS/i,/DISCUSSION PROMPTS/i]},{id:"community-polls",r:[/POLL IDEAS/i,/(?:PATREON|CIRCLE|MIGHTY|KAJABI|SKOOL|FACEBOOK) POLL/i]},{id:"community-starters",r:[/CONVERSATION STARTERS/i]},{id:"clips",r:[/^\d+\.\s*CLIPS/i,/^\d+\.\s*SHORTS/i,/^\d+\.\s*REELS/i]}
];const c=strip(raw),lines=c.split("\n"),secs=[];let ti=null,id="intro",buf=[];for(const l of lines){let h=false;for(const p of ps){if(p.r.some(r=>r.test(l))){if(buf.length)secs.push({id,title:ti||"Overview",content:buf.join("\n").trim()});ti=l.replace(/^\d+\.\s*/,"").trim();id=p.id;buf=[];h=true;break;}}if(!h)buf.push(l);}if(buf.length)secs.push({id,title:ti||"Content",content:buf.join("\n").trim()});return secs.filter(s=>s.content.length>0);}

const SM={"prep-series":{l:"Series Plan",i:"📚"},"prep-topics":{l:"Suggested Topics",i:"💡"},"prep-package":{l:"Episode Overview",i:"📋"},"prep-hook":{l:"Hook",i:"🎣"},"prep-bridge":{l:"Bridge",i:"🌉"},"prep-permission":{l:"Permission Slip Close",i:"🔓"},"prep-structure":{l:"Episode Structure",i:"📐"},"prep-research":{l:"Guest Research",i:"🔍"},"prep-questions":{l:"Tailored Interview Questions",i:"❓"},"prep-clips":{l:"Clip Priorities",i:"✂️"},"prep-titles":{l:"SEO Episode Titles",i:"🎯"},"prep-checklist":{l:"Pre-Recording Checklist",i:"✅"},titles:{l:"SEO Titles",i:"🎯"},shownotes:{l:"Show Notes",i:"📝"},"spotify-creators":{l:"Spotify for Creators",i:"🎵"},youtube:{l:"YouTube",i:"▶️"},"youtube-thumbnail":{l:"YouTube Thumbnail Titles",i:"🖼️"},"youtube-quiz":{l:"YouTube Quiz Card",i:"🧩"},"editor-hooks":{l:"Intro Hook Recommendations",i:"🎬"},"editor-clips":{l:"Social Clip Recommendations",i:"✂️"},"editor-notes":{l:"Editor Notes",i:"📋"},social:{l:"Social Media",i:"📱"},quotes:{l:"Quote Cards",i:"💬"},"poll-questions":{l:"Poll Questions",i:"📊"},"story-slides":{l:"Story Slides",i:"🎞️"},"engagement-prompts":{l:"Engagement Prompts",i:"💡"},"takeaway-graphics":{l:"Key Takeaway Graphics",i:"✨"},guestkit:{l:"Guest Kit",i:"🎁"},email:{l:"Newsletter",i:"📧"},blog:{l:"Blog",i:"📰"},"patreon-companion":{l:"Patreon Companion Post",i:"📝"},"patreon-discussion":{l:"Patreon Discussion Prompts",i:"💬"},"patreon-poll":{l:"Patreon Poll",i:"📊"},"patreon-newsletter":{l:"Patreon Newsletter",i:"📧"},"community-companion":{l:"Community Companion Post",i:"📝"},"community-prompts":{l:"Community Feed Prompts",i:"💬"},"community-polls":{l:"Community Polls",i:"📊"},"community-starters":{l:"Conversation Starters",i:"✨"},clips:{l:"Clips & Shorts",i:"✂️"},intro:{l:"Overview",i:"📋"}};
const ED=[{id:"titles",l:"SEO Titles"},{id:"shownotes",l:"Show Notes"},{id:"youtube",l:"YouTube"},{id:"social",l:"Social Media"},{id:"guestkit",l:"Guest Kit",g:true},{id:"email",l:"Newsletter"},{id:"blog",l:"Blog"},{id:"quotes",l:"Quotes"},{id:"patreon-companion",l:"Patreon Companion Post",pm:true},{id:"patreon-discussion",l:"Patreon Discussion Prompts",pm:true},{id:"patreon-poll",l:"Patreon Poll",pm:true},{id:"patreon-newsletter",l:"Patreon Newsletter",pm:true},{id:"clips",l:"Clips & Shorts",cm:true}];

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/a>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSNTemplate(snElements) {
  if (!snElements) return "";
  const enabled = snElements.filter(e => e.enabled);
  return enabled.map(e => {
    switch(e.id) {
      case "hook":        return "[HOOK QUESTION: Recognition-based. Under 15 words. Starts immediately — no preamble.]";
      case "description": return "\n[EPISODE DESCRIPTION: 2-3 sentences, third person. Open with insight or emotional truth.]";
      case "takeaways":   return "\nKEY TAKEAWAYS\n- [Takeaway 1]\n- [Takeaway 2]\n- [Takeaway 3]";
      case "quote":       return "\nNOTABLE QUOTE\n\"[Exact quote from transcript]\" — [Name of the person who said it]";
      case "guest_bio":   return "\nGUEST BIO\n[2-3 sentences about the guest, third person. Guest episodes only — omit for solo.]";
      case "resources":   return "\nLINKS & RESOURCES\n[Episode-specific resources mentioned in this episode only — books, tools, studies. Omit entirely if none mentioned.]";
      case "timestamps":  return (e.scope === "both") ? "\nTIMESTAMPS\n00:00 — Introduction\n[MM:SS] — [Topic]" : "";
      case "boilerplate": return "\n[BOILERPLATE — copy exactly as configured]";
      case "disclaimer":  return e.text ? "\nDISCLAIMER\n" + e.text : "";
      case "custom_instructions": {
        const header = e.header || "CUSTOM SECTION";
        const instructions = e.text || "Generate a custom section based on the transcript.";
        return "\n" + header.toUpperCase() + "\n[" + instructions + "]";
      }
      default: return "";
    }
  }).join("\n");
}

function getTimestampsScope(snElements) {
  if (!snElements) return "youtube";
  const ts = snElements.find(e => e.id === "timestamps");
  return ts?.enabled ? (ts.scope || "youtube") : "none";
}

function hasBoilerplate(snElements) {
  if (!snElements) return true; // default on
  const bp = snElements.find(e => e.id === "boilerplate");
  return bp ? bp.enabled : true;
}

function buildSections(show, g, snTemplate) {
  const p = show.platforms || {};
  const podcast  = p.podcast  || [];
  const social   = p.social   || [];
  const community= p.community|| [];
  const email    = p.email    || [];
  const blog     = p.blog     || [];
  const extras   = p.extras   || [];

  let out = ""; let n = 1;

  // YOUTUBE THUMBNAIL TITLES — grouped with SEO titles at the top (before show notes)
  if (social.includes("YouTube")) {
    out += `${n++}. YOUTUBE THUMBNAIL TITLES\nWrite 5 YouTube thumbnail title options for this episode. Each title must be EXACTLY 3 words — no more, no fewer. Prioritize high-contrast emotional punch, curiosity, or a bold claim. No filler words. No articles (a/an/the) unless they are the most powerful word available. No colons or punctuation within the title.\n\nFormat:\n1. [Three Word Title]\n2. [Three Word Title]\n3. [Three Word Title]\n4. [Three Word Title]\n5. [Three Word Title]\nDo NOT add a RECOMMENDED line.\n---\n`;
  }

  // SHOW NOTES — always generated
  // Boilerplate is NOT passed to Claude — it is appended programmatically after
  // parsing so the original HTML (with live hyperlinks) is preserved.
  const snClean = snTemplate
    ? snTemplate.replace(/\[BOILERPLATE[^\]]*\]/gi, "").trimEnd()
    : "";
  out += `${n++}. SHOW NOTES\n${snClean}\n---\n`;

  // SPOTIFY FOR CREATORS — after show notes, before YouTube
  if (podcast.includes("Spotify for Creators")) {
    out += `${n++}. SPOTIFY FOR CREATORS
Generate interactive engagement content for the Spotify for Creators episode upload.

CRITICAL CHARACTER LIMITS — Spotify enforces these strictly:
- Each poll QUESTION: 60 characters maximum (count every character including spaces)
- Each poll OPTION (A/B/C/D): 24 characters maximum — this is Spotify's hard limit, do NOT exceed it
- Listener questions: 100 characters maximum
Count carefully before writing each item.

QUESTIONS FOR LISTENERS (write 3 questions, each under 100 characters)
Question 1: [A thought-provoking open-ended question tied to this episode's main topic]
Question 2: [A personal reflection question — "Have you ever..." or "What's your experience with..."]
Question 3: [A forward-looking question — "What will you try..." or "What's one thing you're taking away..."]

POLL 1
[Poll question — 60 chars max]
Option A: [answer — 24 chars max]
Option B: [answer — 24 chars max]
Option C: [answer — 24 chars max]
Option D: [answer — 24 chars max]

POLL 2
[Poll question — 60 chars max]
Option A: [answer — 24 chars max]
Option B: [answer — 24 chars max]
Option C: [answer — 24 chars max]
Option D: [answer — 24 chars max]

POLL 3
[Poll question — 60 chars max]
Option A: [answer — 24 chars max]
Option B: [answer — 24 chars max]
Option C: [answer — 24 chars max]
Option D: [answer — 24 chars max]
---
`;
  }

  // YOUTUBE — if in social platforms, gets full YouTube treatment
  if (social.includes("YouTube")) {
    const ytBp = stripHtml(show?.bp || "");
    out += `${n++}. YOUTUBE DESCRIPTION\n[HOOK — 1 sentence]\n\n[SUMMARY: 2-3 sentences optimized for YouTube search]\n\nTIMESTAMPS\n00:00 — Introduction\n[exact MM:SS from transcript] — [Topic]\n[exact MM:SS from transcript] — [Topic]\n[exact MM:SS from transcript] — [Topic]\n[exact MM:SS from transcript] — [Topic]\n[Add all major topics using the precise timestamps from the transcript — do NOT round to whole minutes]\n\n${ytBp || "[BOILERPLATE]"}\n\nHASHTAGS\n[8-12 hashtags with # symbol]\n\nKEYWORDS\n[8-12 comma-separated SEO keywords]\n---\n`;
    out += `${n++}. YOUTUBE QUIZ CARD\nWrite one multiple-choice quiz question based on a key insight from this episode. Choose a timestamp from the middle of the video where a viewer would have just learned this. Format exactly as:\n\nTIMESTAMP: [MM:SS]\nQUESTION: [The quiz question — clear, specific, pulled from the episode content]\nA) [Option]\nB) [Option]\nC) [Option]\nD) [Option]\nCORRECT ANSWER: [Letter] — [Brief explanation of why, 1 sentence]\n---\n`;
  }

  // SOCIAL MEDIA posts — one per selected platform (except YouTube handled above)
  const socialPosts = social.filter(s => s !== "YouTube");
  if (socialPosts.length > 0) {
    out += `${n++}. SOCIAL MEDIA\n`;
    out += `Generate a paste-ready post for EACH platform listed below. Each post must be formatted EXACTLY as it would appear when posted — with line breaks, spacing, emojis, and hashtags in the right places. Write it so someone can copy and paste it directly with zero editing needed.\n\n`;
    out += `Use this format for each:\n[PLATFORM NAME] POST:\n[post — formatted exactly as it would appear on that platform]\n\n`;
    out += `PLATFORM-SPECIFIC FORMAT RULES:\n`;
    if (socialPosts.includes("Instagram")) out += `INSTAGRAM: Start with a hook line (no hashtags yet). Leave a blank line. Write 3-5 short paragraphs — punchy, personal, conversational. End with a question or CTA. Leave TWO blank lines. Then ALL hashtags together on one line (20-25 tags). Use emojis naturally throughout — not forced, but where they add energy or emphasis.\n`;
    if (socialPosts.includes("Facebook")) out += `FACEBOOK: Start with a hook or bold opening statement. 2-3 paragraphs, warm and conversational like you're talking to a friend. Can be longer than Instagram. End with a question to spark comments. No hashtags needed, but 2-3 relevant ones are fine. Emojis optional but sparingly.\n`;
    if (socialPosts.includes("TikTok")) out += `TIKTOK: First line is the HOOK — must stop the scroll. Then 2-3 very short punchy lines. End with a CTA ("Link in bio" or "New episode out now"). 3-5 hashtags max. Use emojis to add energy. Total post under 150 chars ideally.\n`;
    if (socialPosts.includes("LinkedIn")) out += `LINKEDIN: Open with a bold insight or contrarian statement — no fluff. Short punchy sentences. Use line breaks after every 1-2 sentences for readability. 3-5 paragraphs. End with a thought-provoking question or call to action. 3-5 relevant hashtags at the end. Professional but human — no corporate-speak.\n`;
    if (socialPosts.includes("X (Twitter)")) out += `X (TWITTER): Under 280 characters. One punchy statement or a quote from the episode. Optionally end with "🎧 Episode [number] out now" or similar. Max 2 hashtags. No fluff.\n`;
    if (socialPosts.includes("Pinterest")) out += `PINTEREST: Write as a pin description. Benefit-driven opening. 2-3 sentences. Include keywords naturally. End with what they'll learn or get from listening. No hashtags.\n`;
    if (socialPosts.includes("Threads")) out += `THREADS: Conversational and casual — like texting a friend. 2-4 short paragraphs with line breaks. Can ask a question or share a hot take. No hashtags. Emojis are fine but don't overdo it.\n`;
    if (socialPosts.includes("Reddit")) out += `REDDIT: Write like a real person posting in a relevant subreddit — no marketing language, no hashtags, no emojis. Lead with genuine value or an interesting insight. Can be longer. End with an open question to spark discussion.\n`;
    if (socialPosts.includes("Apple Podcasts")) out += `APPLE PODCASTS: 2-3 sentences max. Plain and descriptive. What will the listener learn or feel? No hashtags, no emojis.\n`;
    if (socialPosts.includes("Spotify")) out += `SPOTIFY: 2-3 casual sentences. Conversational. What makes this episode worth their time? No hashtags.\n`;
    out += `---\n`;
  }

  // COMMUNITY content
  if (community.length > 0) {
    const name = community[0];
    out += `${n++}. ${name.toUpperCase()} COMPANION POST
Write a 300-500 word behind-the-scenes companion post for ${name} members. Exclusive insider content going deeper than the episode. Warm, personal, direct address. End with an engagement question.
---
`;
    out += `${n++}. ${name.toUpperCase()} COMMUNITY FEED PROMPTS
Write 3 community feed prompts based on specific moments from this episode. Each prompt:
- Bold title (e.g. "The Trust Question")
- Genuine question the community will want to answer
- Emoji answer options where appropriate (e.g. 🅰️ 🅱️ 🅲️ 🅳️)
- 1-2 sentences tying to the episode
Format: Prompt [#] — [Title] / [Question] / [Options] / [Episode tie-in]
---
`;
    out += `${n++}. ${name.toUpperCase()} POLL IDEAS
Write 3 polls based on episode topics. Each poll:
- Direct question with colored circle emoji options: 🔴 🟡 🟢 ⚪
- 1-sentence episode tie-in
Format: Poll [#] — [Topic] / [Question] / 🔴 [A] / 🟡 [B] / 🟢 [C] / ⚪ [D] / [tie-in]
---
`;
    out += `${n++}. CONVERSATION STARTERS
Write 4 short punchy posts for Stories, X, or short-form. Hook-first, 1-3 sentences, include episode quotes where powerful, end with CTA. Number them Starter 1-4.
---
`;
  }

  // EMAIL NEWSLETTER
  if (email.includes("Newsletter")) {
    out += `${n++}. EMAIL NEWSLETTER\n[SUBJECT LINE]\n[PREVIEW TEXT]\n\n[Body: hook, 3-4 key insights from episode, CTA to listen]\n\nFREQUENTLY ASKED QUESTIONS\n[3-5 FAQs based on the episode topic with concise answers]\n---\n`;
  }

  // BLOG
  if (blog.includes("Blog Article")) {
    out += `${n++}. BLOG ARTICLE\n[800-1500 words. SEO-optimized headline. Hook → sections with subheadings → CTA. Include meta description at end.]\n\nFAQ SCHEMA\n[5 FAQs for structured data markup]\n---\n`;
  }

  // QUOTE CARDS
  if (extras.includes("Quote Cards")) {
    out += `${n++}. QUOTE CARDS\n[5 quotes under 25 words each, numbered. Pull exact quotes from transcript where possible. Attribute EACH quote to the person who said it by name, formatted as: 1. "Quote text" — [Name]]\n---\n`;
  }

  // POLL QUESTIONS
  if (extras.includes("Poll Questions")) {
    out += `${n++}. POLL QUESTIONS
Write 5 social media poll questions based on key moments or debates from this episode. Each poll should spark engagement and be usable on Instagram Stories, LinkedIn, or Facebook.

Format each poll exactly as:
Poll [#]: [Question — short, direct, under 12 words]
🅰️ [Option A]
🅱️ [Option B]
🅲️ [Option C — optional third choice if relevant]
Episode tie-in: [1 sentence connecting the poll to a specific moment or insight from the episode]
---
`;
  }

  // STORY SLIDES
  if (extras.includes("Story Slides")) {
    out += `${n++}. STORY SLIDES
Write a 5-slide Instagram/Facebook Story sequence for this episode. Each slide should be a standalone piece of content designed for a 1080x1920 vertical format.

Format each slide as:
SLIDE [#] — [Slide type: e.g. Hook, Insight, Quote, CTA]
Headline: [Bold text — 6 words max]
Body: [Supporting text — 2-3 lines max, large enough to read on mobile]
Visual note: [Brief direction for the designer — color, style, or layout suggestion]
---
`;
  }

  // ENGAGEMENT PROMPTS
  if (extras.includes("Engagement Prompts")) {
    out += `${n++}. ENGAGEMENT PROMPTS
Write 6 engagement prompts based on specific moments from this episode. These are designed to be posted in comments, community spaces, or as standalone social posts to spark conversation.

Format each prompt as:
Prompt [#]: [Question or statement — conversational, under 20 words]
Platform: [Best platform — Instagram, Facebook, LinkedIn, or Community]
Hook angle: [e.g. Relatable struggle, Bold claim, Curiosity gap, Personal challenge]
---
`;
  }

  // KEY TAKEAWAY GRAPHICS
  if (extras.includes("Key Takeaway Graphics")) {
    out += `${n++}. KEY TAKEAWAY GRAPHICS
Write 5 key takeaways from this episode formatted for graphic design. Each takeaway should work as a standalone visual post — bold, punchy, and shareable.

Format each takeaway as:
Graphic [#]:
Main text: [The takeaway — under 15 words, written as a statement or insight]
Supporting text: [1 short sentence adding context — under 20 words]
Source label: [e.g. "[Show Name] — Episode [#]"]
---
`;
  }

  // GUEST KIT
  if (g && extras.includes("Guest Kit")) {
    out += `${n++}. GUEST SHARE KIT\n[Thank you note from host, episode blurb for guest to share, 2-3 suggested social captions pre-written for guest]\n---\n`;
  }

  return out;
}


function sys(show, k, g, ep, mode, extras=[], clipCount=5) {
  const d = show; if (!d) return "";
  const ap = [...(d.platforms?.p||[]),...(d.platforms?.s||[])];
  const bp = stripHtml(d.bp||"");
  const urls = (bp.match(/https?:\/\/[^\s,)]+|www\.[^\s,)]+/g)||[]);
  const voice = d.voice||{}; const aud = d.aud||{}; const tpl = d.tpl||{};
  const base = `You are the content strategist for ${d.name}.\n\nOUTPUT FORMAT:\n- PLAIN TEXT only. Zero markdown. No asterisks. No bold. No italic.\n- ALL section headers and sub-headers must be in ALL CAPS — every single one, no exceptions\n- This includes: KEY TAKEAWAYS, NOTABLE QUOTE, GUEST BIO, LINKS & RESOURCES, TIMESTAMPS, HASHTAGS, KEYWORDS, SUBJECT LINE, PREVIEW TEXT, and any other label\n- Separate major sections with ---\n- Bullets use - (hyphen space)\n\nCRITICAL RULES:\n1. SEO TITLES: Write the title ONLY. Do NOT add the podcast name, a dash, episode number, or any other text after the title.\n2. SHOW NOTES: The very first thing after the SHOW NOTES header must be the hook question. No podcast name, no episode info, no intro text.\n3. BULLETS: KEY TAKEAWAYS must be 3-7 bullet points, each on its own line starting with - (hyphen space). Never write takeaways as a paragraph.\n4. HEADERS: Never use Title Case for any header or label. ALL CAPS only. "Links & Resources" must be written as "LINKS & RESOURCES".\n5. QUOTE ATTRIBUTION: EVERY direct quote pulled from the transcript MUST be attributed to the person who actually said it, by name — format as "quote text" — [Name]. Use the real host or guest name from the show/episode context (Host(s) and any guest are listed below). Never leave a quote unattributed and never use a generic placeholder like [Speaker]. If you genuinely cannot tell who said it, write — [Speaker unknown — please confirm].\n\nShow: ${d.name} | "${d.tag}" | Host(s): ${d.hosts}\n${g?"GUEST episode — include Guest Share Kit.":"SOLO episode — skip Guest Share Kit."}${ep?` | Episode ${ep}`:""}\n\nVOICE: ${voice.traits||""} | Energy: ${voice.energy||""} | ${voice.arch||""}\nArc: ${voice.arc||""}\nPhrases: ${(voice.phrases||[]).join(" | ")}\nUSE: ${voice.use||""}\nAVOID: ${voice.avoid||""}\n\nAUDIENCE: ${aud.who||""}\nPain: ${(aud.pains||[]).join(" | ")}\nLanguage: ${aud.lang||""}\n\nPLATFORMS: ${[...ap,...extras].join(", ")} | HASHTAGS: ${d.tags||""}\n${extras.length>0?`ADDITIONAL PLATFORMS THIS EPISODE: ${extras.join(", ")} -- generate a dedicated social post for each additional platform listed.`:""}\n\n${bp ? `BOILERPLATE (YouTube description only — show notes boilerplate is handled separately):\n${bp}\nFor the YouTube description, copy the boilerplate exactly after the timestamps. Include every URL exactly as written.` : "No boilerplate for this show."}\n\nSHOW NOTES FORMAT RULE: The show notes template shown in the section instructions is the COMPLETE format. Follow it EXACTLY — do not add sections, key takeaways, guest bios, or any other content not already specified in the template. Do not add a boilerplate to show notes — it is appended automatically.\n\nTIMESTAMPS RULE: Always include timestamps in the YouTube description. Use the EXACT timestamp markers that appear in the transcript (e.g. if the transcript shows [00:03:47] or 3:47, use 03:47 — NOT a rounded 03:00 or 05:00). Do NOT round to the nearest minute and do NOT invent evenly-spaced times. Each timestamp must mark the precise moment that topic actually begins in the transcript, copied from the nearest transcript marker. If the transcript has no explicit time markers, estimate as closely as possible but still avoid suspiciously round numbers. ${getTimestampsScope(d.snElements) === "both" ? "Also include timestamps in show notes." : "Do NOT include timestamps in show notes unless the show notes template specifically includes them."}\n\nRULES:\n${d.rules||""}\n\n`;
  if(mode==="clips"){return base;}
  if(mode==="editor"){
    const editLevels = {
      "1": { name: "Level 1 — Clean & Clear", desc: "The goal is a natural, listenable episode with no obvious edit points — a light technical cleanup ONLY. Slap on the standard intro and outro. Remove long awkward dead-air gaps unless they are emotional or intentional. Cut anything that is clearly a technical defect — mic bumps, false starts, hard stops, audio dropouts, glitches, and obvious mistakes or retakes. Leave ums, ahs, and filler words unless they are so frequent they disrupt listening. DO NOT restructure the episode, DO NOT remove content for narrative or pacing reasons, and DO NOT reorder anything. The episode should sound like the real conversation, just cleaned up." },
      "2": { name: "Level 2 — Crafted", desc: "The goal is a polished, well-paced episode that holds attention. Everything in Level 1 applies. Additionally: identify and surface the strongest hook moment and restructure the opening if needed. Remove repetitive points, rambling tangents, and run-on sections that dilute the message. Tighten pacing so the conversation flows freely without losing its natural feel. Add lower thirds at key moments. The episode should sound intentional without sounding produced." },
      "3": { name: "Level 3 — Story-Driven", desc: "The goal is a fully crafted narrative. Everything in Levels 1 and 2 applies. Additionally: treat the raw recording as source material, not a final structure. Reconstruct the arc — find the story, build toward it, and edit down aggressively if needed (e.g. a 90-minute interview may become a 45-minute episode). Add b-roll, images, and supporting visuals to reinforce meaning. Re-record inserts may be added to fill gaps in the narrative. The episode should feel like a documentary, not a recording." },
    };
    const lvl = editLevels[d.editingLevel || "1"];
    return base + `
You are an editor coach analyzing this episode transcript for a professional podcast editor.

EDITING STANDARD FOR THIS SHOW:
${lvl.name}
${lvl.desc}

SHOW DNA CONTEXT:
Target audience: ${d.aud?.who||""}
Audience pain points: ${(d.aud?.pains||[]).join(", ")}
Show voice: ${d.voice?.traits||""}
What resonates with this audience: ${d.voice?.use||""}

Your job is to coach the editor through this specific episode based on the editing standard above, find the best clip moments, and flag what should be cut or tightened.

STRICT DURATION RULE: Every clip and hook must be UNDER 60 seconds when spoken. Ideal length is 30-45 seconds. Do not suggest any moment longer than 60 seconds.

Generate the following:

---

EDITOR COMPANION BRIEF

EDITING LEVEL: ${lvl.name}

EPISODE OVERVIEW
[2-3 sentences on the overall tone, energy, and narrative arc of this episode. What is the core story or message? What makes this episode worth listening to?]

EDITING APPROACH FOR THIS EPISODE
[Based on the editing level above and this specific episode, give the editor their marching orders. What should they prioritize? What will make this episode shine at this level? Be specific to what you heard in this transcript — not generic advice.]

SECTIONS TO CUT OR TIGHTEN
${(d.editingLevel || "1") === "1"
  ? "[This show is Level 1 — technical cleanup ONLY. List ONLY technical issues to fix: long dead-air gaps, glitches or audio dropouts, false starts, mic bumps, and obvious mistakes or retakes. Do NOT suggest cutting content for pacing, repetition, or narrative reasons, and do NOT suggest restructuring. If there are no technical issues to flag, say so plainly. Also note where the standard intro and outro should be added.]"
  : "[List specific moments with timestamps that should be removed or shortened. For each, explain why — is it repetitive, off-topic, too slow, contradicts the show voice? Be direct.]"}

TIMESTAMP: [exact start — exact end, copied from the transcript markers]
REASON: [why this should be cut or tightened]
SUGGESTION: ${(d.editingLevel || "1") === "1" ? "[cut the glitch / remove dead air / trim false start / add intro / add outro]" : "[cut entirely / trim to X seconds / restructure]"}

---

INTRO HOOK RECOMMENDATIONS

Find the 3 best moments from the transcript to use as a podcast intro hook (spliced in before theme music). Each must be under 60 seconds when spoken — ideally 30-45 seconds. Rank them 1-3 with #1 being your top recommendation.

For each hook, provide:

HOOK #[N] — [RECOMMENDED / ALTERNATE 1 / ALTERNATE 2]
TIMESTAMP: [approximate time in transcript — e.g. "~14:30" or "around the 22-minute mark"]
DURATION: [estimated clip length — must be under 60 seconds]
QUOTE: [the exact words from the transcript where this moment starts and ends — copy verbatim, followed by — [Name of who said it]]
WHY THIS WORKS: [2-3 sentences — specifically why this moment will hook THIS show's audience based on their pain points and what they care about]
AUDIENCE TRIGGER: [the specific emotional hook — e.g. "Relief — listener feels finally understood", "Curiosity — raises a question they've always had", "Validation — confirms what they suspected"]

---

SOCIAL CLIP RECOMMENDATIONS

Find exactly ${clipCount} moments that would make high-performing social media clips. Each clip must be under 60 seconds when spoken — ideally 30-45 seconds. Focus on moments that are self-contained, emotionally resonant, and don't require context from the rest of the episode.

For each clip:

CLIP #[N]
CLIP TITLE: [4-7 word title optimized for search — punchy, specific, no show name]
TIMESTAMP: [exact start and end time copied from the transcript markers]
DURATION: [estimated length — must be under 60 seconds]
BEST PLATFORM: [Instagram Reels / TikTok / YouTube Shorts / LinkedIn — pick the ONE best fit and explain why]
QUOTE: [exact words where clip starts and ends — followed by — [Name of who said it]]
WHY IT PERFORMS: [why this specific moment will stop the scroll — what's the hook, the tension, the payoff]
SUGGESTED CAPTION HOOK: [one punchy first line for the social caption]

---
`;
  }
  const snTpl = buildSNTemplate(d.snElements);
  const sections = buildSections(d, g, snTpl);
  return base+`Generate the COMPLETE content package in plain text. Use ONLY the sections listed below.

1. SEO TITLE OPTIONS
[5 numbered titles, each 4-8 words — full, descriptive, search-optimized episode titles. Titles ONLY — no podcast name. Do NOT add a RECOMMENDED line.]
---
${sections}`;
}

function revSys(show){const d=show;if(!d)return "";return `Content strategist for ${d.name}. PLAIN TEXT only. ALL CAPS headers. - bullets.\nVoice: ${d.voice?.traits||""} | Phrases: ${(d.voice?.phrases||[]).join(" | ")}\nUSE: ${d.voice?.use||""} | AVOID: ${d.voice?.avoid||""}\nBoilerplate: ${d.bp||""}\nOnly revise the requested section.`;}

function linkifyLine(line){return line.replace(/(https?:\/\/[^\s,)"]+|www\.[^\s,)"]+|[a-zA-Z0-9][a-zA-Z0-9\-]*\.(?:com|org|net|io|co)(?:\/[^\s,)"]*)?)/g,url=>{const href=url.startsWith("http")?url:"https://"+url;return`<a href="${href}" style="color:#7A0019">${url}</a>`;});}

const TOP_SECTIONS=/^(\d+\.\s*)?(SEO TITLE|SHOW NOTES|SPOTIFY FOR CREATORS|INTRO HOOK|SOCIAL CLIP|EDITOR NOTES|YOUTUBE DESC|YOUTUBE QUIZ|YOUTUBE THUMBNAIL|SOCIAL MEDIA|QUOTE CARDS|POLL QUESTIONS|STORY SLIDES|ENGAGEMENT PROMPTS|KEY TAKEAWAY GRAPHICS|GUEST SHARE|EMAIL NEWS|NEWSLETTER|BLOG (ARTICLE|POST)|PATREON (COMPANION|DISCUSSION|POLL|EXCLUSIVE|POSTS|NEWSLETTER)|CLIPS|SHORTS|REELS)/i;
const SUB_HEADERS=/^(KEY TAKEAWAYS|NOTABLE QUOTE|TIMESTAMPS|HASHTAGS|KEYWORDS|INSTAGRAM|FACEBOOK|TIKTOK|LINKEDIN|X \(TWITTER\)|QUOTE CARDS|THANK YOU|EPISODE BLURB|SUGGESTED SOCIAL|SUBJECT LINE|PREVIEW TEXT|SOBER SHOT|ELLEVATED ACHIEVERS TAKEAWAY|IN THIS EPISODE|LINKS & RESOURCES|NOTABLE RESOURCES|CONNECT WITH|ABOUT|MUSIC CREDITS|DISCLAIMER|CLIP \d+|YOUTUBE CLIP \d+|INSTAGRAM REEL \d+|FACEBOOK REEL \d+|TIKTOK \d+|SPOTIFY CLIP \d+)/i;

function dlDoc(content,filename,bpHtml=""){
  // collapse runs of blank lines to at most one blank line
  const collapsed=content.replace(/\n{3,}/g,"\n\n");
  const lines=collapsed.split("\n");
  const out=[];
  let inShowNotes=false,bpInserted=false;
  for(const l of lines){
    const t=l.trim();
    if(t&&TOP_SECTIONS.test(t)){
      // Leaving the show notes section — inject the boilerplate (with live hyperlinks) before the next section
      if(inShowNotes&&!bpInserted&&bpHtml){out.push(`<div class="bp">${bpHtml}</div>`);bpInserted=true;}
      inShowNotes=/SHOW NOTES/i.test(t);
      out.push(`<div class="sec">${t}</div>`);
      continue;
    }
    if(!t){out.push('<p class="blank">&nbsp;</p>');continue;}
    if(t==="---"){out.push('<p class="blank">&nbsp;</p>');continue;}
    if(SUB_HEADERS.test(t)&&t.split(/\s+/).length<=6){out.push(`<div class="sub">${t}</div>`);continue;}
    if(/^[-•]\s/.test(t)){out.push(`<li>${linkifyLine(t.replace(/^[-•]\s/,""))}</li>`);continue;}
    out.push(`<p>${linkifyLine(l)}</p>`);
  }
  // Show notes was the final section — append boilerplate at the end
  if(inShowNotes&&!bpInserted&&bpHtml){out.push(`<div class="bp">${bpHtml}</div>`);bpInserted=true;}
  const h=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
body{font-family:"Calibri",sans-serif;font-size:11pt;line-height:1.4;color:#111;margin:.9in 1in}
h1{font-size:15pt;font-weight:bold;color:#111;margin-top:0;margin-bottom:3pt;font-family:"Calibri",sans-serif}
.meta{font-size:9pt;color:#888;margin-bottom:16pt;font-family:"Calibri",sans-serif}
.sec{font-size:11pt;font-weight:bold;color:#111;margin-top:18pt;margin-bottom:4pt;text-transform:uppercase;font-family:"Calibri",sans-serif}
.sub{font-size:10.5pt;font-weight:bold;color:#333;margin-top:8pt;margin-bottom:2pt;font-family:"Calibri",sans-serif}
p{margin:1pt 0 3pt 0;font-size:11pt}
a{color:#7A0019;text-decoration:underline}
li{margin:2pt 0;font-size:11pt}
.blank{margin:4pt 0;font-size:4pt;line-height:1}
.bp{font-size:11pt;margin-top:6pt}
.bp a{color:#7A0019;text-decoration:underline}
.bp p{margin:1pt 0 3pt 0}
</style></head>
<body>
<h1>${filename}</h1>
<div class="meta">Podcast Impact Studio &nbsp;·&nbsp; Content Creator</div>
${out.join("\n")}
</body></html>`;
  const b=new Blob([h],{type:"application/msword"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u;a.download=`${filename}.doc`;
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(u);
}

function buildHtml(content,filename,bpHtml=""){
  const lines=content.split("\n");
  const out=[];
  let inShowNotes=false,bpInserted=false;
  for(const l of lines){
    const t=l.trim();
    if(t&&TOP_SECTIONS.test(t)){
      if(inShowNotes&&!bpInserted&&bpHtml){out.push(`<div class="bp">${bpHtml}</div>`);bpInserted=true;}
      inShowNotes=/SHOW NOTES/i.test(t);
      out.push(`<div class="sec">${t}</div>`);
      continue;
    }
    if(!t){out.push("<p>&nbsp;</p>");continue;}
    if(t==="---"){out.push("<hr>");continue;}
    if(SUB_HEADERS.test(t)&&t.split(/\s+/).length<=6){out.push(`<div class="sub">${t}</div>`);continue;}
    if(/^[-•]\s/.test(t)){out.push(`<p style="padding-left:16px">- ${linkifyLine(t.replace(/^[-•]\s/,""))}</p>`);continue;}
    out.push(`<p>${linkifyLine(l)}</p>`);
  }
  if(inShowNotes&&!bpInserted&&bpHtml){out.push(`<div class="bp">${bpHtml}</div>`);bpInserted=true;}
  return`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${filename}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.7;color:#111;max-width:820px;margin:40px auto;padding:0 24px}
h1{font-size:18pt;font-weight:bold;color:#C41230;border-bottom:2px solid #C41230;padding-bottom:8px;margin-bottom:4px}
.meta{font-size:10pt;color:#888;margin-bottom:24px}
.sec{font-size:13pt;font-weight:bold;color:#C41230;margin-top:28px;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
.sub{font-size:11pt;font-weight:bold;color:#333;margin-top:14px;margin-bottom:4px}
p{margin:3pt 0}
hr{border:none;border-top:1px solid #ddd;margin:18px 0}
a{color:#C41230}
.bp{margin-top:8px}
.bp a{color:#C41230}
</style></head>
<body>
<h1>${filename}</h1>
<div class="meta">Podcast Impact Studio · Content Planner · Generated ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</div>
${out.join("\n")}
</body></html>`;
}
function dlHtml(content,filename){
  const h=buildHtml(content,filename);
  const b=new Blob([h],{type:"text/html"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u;a.download=`${filename}.html`;
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(u);
}

function textToHtml(text){
  // Convert plain text with URLs to HTML with clickable links and bold headers
  const lines = text.split("\n");
  const htmlLines = lines.map(line => {
    const t = line.trim();
    if (!t) return "<br>";
    // Section headers (ALL CAPS lines) -> bold red
    if (/^(\d+\.\s*)?(SEO TITLE|SHOW NOTES|SPOTIFY FOR CREATORS|YOUTUBE DESC|SOCIAL MEDIA|QUOTE CARDS|POLL QUESTIONS|STORY SLIDES|ENGAGEMENT PROMPTS|KEY TAKEAWAY GRAPHICS|GUEST SHARE|EMAIL NEWS|NEWSLETTER|BLOG|PATREON|CLIPS|TIMESTAMPS|HASHTAGS|KEYWORDS)/i.test(t)) {
      return `<p><strong style="color:#CC0000;text-transform:uppercase;">${t}</strong></p>`;
    }
    // Sub headers (KEY TAKEAWAYS, NOTABLE QUOTE etc) -> bold
    if (/^(KEY TAKEAWAYS|NOTABLE QUOTE|GUEST BIO|CONNECT WITH|SUBJECT LINE|TIMESTAMPS|HASHTAGS|KEYWORDS)/i.test(t)) {
      return `<p><strong>${t}</strong></p>`;
    }
    // Separator
    if (t === "---") return "<hr>";
    // Linkify URLs
    const linked = line.replace(/(https?:\/\/[^\s,)"]+|www\.[^\s,)"]+)/g, url => {
      const href = url.startsWith("http") ? url : "https://" + url;
      return `<a href="${href}">${url}</a>`;
    });
    // Bullets
    if (/^[-•]\s/.test(t)) return `<p>- ${linked.replace(/^[-•]\s/,"")}</p>`;
    return `<p>${linked}</p>`;
  });
  return htmlLines.join("\n");
}

function copyText(text, bpHtml=""){
  const html = textToHtml(text) + (bpHtml ? "\n" + bpHtml : "");
  const plain = text + (bpHtml ? "\n" + stripHtml(bpHtml) : "");
  if(navigator.clipboard && window.ClipboardItem){
    const blob = new Blob([html], {type:"text/html"});
    const plainBlob = new Blob([plain], {type:"text/plain"});
    navigator.clipboard.write([new ClipboardItem({"text/html":blob,"text/plain":plainBlob})]).catch(()=>fallbackCopy(plain));
    return;
  }
  fallbackCopy(plain);
}
function fallbackCopy(text){
  const el=document.createElement("div");
  el.contentEditable="true";
  el.style.cssText="position:fixed;left:-9999px;top:-9999px;opacity:0;white-space:pre";
  el.innerText=text;
  document.body.appendChild(el);
  const sel=window.getSelection();sel.removeAllRanges();
  const range=document.createRange();range.selectNodeContents(el);sel.addRange(range);
  try{document.execCommand("copy");}catch(e){}
  sel.removeAllRanges();document.body.removeChild(el);
}

function Cp({text,bpHtml=""}){const[ok,setOk]=useState(false);return <button onClick={()=>{copyText(text,bpHtml);setOk(true);setTimeout(()=>setOk(false),1800);}} style={{padding:"5px 14px",background:ok?T.coralSoft:"transparent",border:`1px solid ${ok?T.coralMid:T.cardBorder}`,borderRadius:"6px",color:ok?T.coral:T.textMuted,fontSize:"12px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",transition:"all .25s",whiteSpace:"nowrap",letterSpacing:"1px"}}>{ok?"✓ COPIED":"COPY"}</button>;}

function isTopSection(line){const t=line.trim();return /^(\d+\.\s*)?(SEO TITLE|SHOW NOTES|SPOTIFY FOR CREATORS|INTRO HOOK|SOCIAL CLIP|EDITOR NOTES|YOUTUBE DESC|SOCIAL MEDIA|QUOTE CARDS|POLL QUESTIONS|STORY SLIDES|ENGAGEMENT PROMPTS|KEY TAKEAWAY GRAPHICS|GUEST SHARE|EMAIL NEWS|NEWSLETTER|BLOG (ARTICLE|POST)|PATREON|CLIPS|SHORTS|REELS)/i.test(t);}
function isSubHeader(line){const t=line.trim();if(!t||t.length<3)return false;if(/^[-\u2022*\d"(@]/.test(t))return false;if(isTopSection(line))return false;if(t.split(/\s+/).length>8)return false;const allCaps=/^[A-Z][A-Z\s&()\u00ae\u2122\/\-:\.]+$/.test(t)&&t.length>3;const titleCase=/^[A-Z][a-zA-Z]*(\s(&|[A-Z][a-zA-Z]*))*:?$/.test(t)&&t.length>3&&t.split(/\s+/).length<=6;return allCaps||titleCase;}

function renderContent(text){
  const urlRegex=/(https?:\/\/[^\s,)"]+|www\.[^\s,)"]+|[a-zA-Z0-9][a-zA-Z0-9\-]*\.(?:com|org|net|io|co)(?:\/[^\s,)"]*)?)/g;
  const linkify=(line)=>line.split(urlRegex).map((part,i)=>{if(urlRegex.test(part)){urlRegex.lastIndex=0;const href=part.startsWith("http")?part:`https://${part}`;return <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{color:T.coral,textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>;}return <span key={i}>{part}</span>;});
  return text.split("\n").map((line,li)=>{
    const t=line.trim();
    const isTop=isTopSection(line);
    const isSub=!isTop&&isSubHeader(line);
    const isBullet=/^[-\u2022]\s/.test(t);
    const isEmpty=!t;
    if(isEmpty)return <div key={li} style={{height:"6px"}}/>;
    if(isTop)return <div key={li} style={{fontWeight:"700",fontSize:"14px",letterSpacing:"2px",textTransform:"uppercase",color:T.coral,marginTop:"18px",marginBottom:"4px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{linkify(line)}</div>;
    if(isSub)return <div key={li} style={{fontWeight:"700",fontSize:"13px",color:T.text,marginTop:"14px",marginBottom:"4px",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px"}}>{linkify(line)}</div>;
    if(isBullet){const content=t.replace(/^[-\u2022]\s/,"");return <div key={li} style={{display:"flex",gap:"10px",fontSize:"16px",color:T.textSecondary,fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"2.0",marginBottom:"5px"}}><span style={{color:T.textMuted,flexShrink:0,marginTop:"2px"}}>-</span><span>{linkify(content)}</span></div>;}
    return <div key={li} style={{fontSize:"16px",color:T.textSecondary,fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"2.0",marginBottom:"5px"}}>{linkify(line)}</div>;
  });
}

function Sec({s,clr}){const m=SM[s.id]||SM.intro;
  return <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:"10px",marginBottom:"10px",overflow:"hidden"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 20px",borderBottom:`1px solid ${T.cardBorder}`,background:T.surface}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <span style={{fontSize:"14px"}}>{m.i}</span>
        <span style={{fontSize:"14px",letterSpacing:"2px",textTransform:"uppercase",color:clr||T.coral,fontWeight:"700",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{m.l}</span>
      </div>
      <Cp text={s.content} bpHtml={s.bpHtml||""}/>
    </div>
    <div style={{padding:"20px 24px"}}>
      {renderContent(s.content)}
      {s.bpHtml&&<div dangerouslySetInnerHTML={{__html:s.bpHtml}} style={{marginTop:"12px",fontSize:"16px",color:T.textSecondary,fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"2.0"}}/>}
    </div>
  </div>;
}


// ─── MAIN APP ─────────────────────────────────────────────────────────────────

function getUtcOffsetMinutes(date, tz) {
  // Returns offset in minutes: local_in_tz - UTC
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => { const p = parts.find(p => p.type === type); return p ? parseInt(p.value) : 0; };
  let h = get('hour'); if (h === 24) h = 0;
  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'));
  return (localAsUtc - date.getTime()) / 60000;
}

function formatPublishSchedule(show, userTz) {
  if (!show?.publishDay || !show?.publishTime || !show?.publishTz) return null;
  try {
    const [hours, minutes] = show.publishTime.split(":").map(Number);
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayIdx = days.indexOf(show.publishDay);
    if (dayIdx === -1) return null;
    const tz = userTz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Use a fixed reference week (Jan 5-11, 2025; Jan 5 = Sunday) to avoid DST edge cases
    // Build a UTC timestamp that corresponds to hours:minutes in show.publishTz on the correct weekday
    const candidate = new Date(Date.UTC(2025, 0, 5 + dayIdx, hours, minutes));
    const offsetMin = getUtcOffsetMinutes(candidate, show.publishTz);
    const actualUtc = new Date(candidate.getTime() - offsetMin * 60000);
    const showTime = actualUtc.toLocaleString("en-US", { timeZone: show.publishTz, weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const isDifferent = tz !== show.publishTz;
    const localTime = isDifferent ? actualUtc.toLocaleString("en-US", { timeZone: tz, weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : null;
    return { showTime, localTime, isDifferent };
  } catch { return null; }
}

const OB_TIMEZONES = [
  ["America/New_York","Eastern Time (ET)"],["America/Chicago","Central Time (CT)"],
  ["America/Denver","Mountain Time (MT)"],["America/Los_Angeles","Pacific Time (PT)"],
  ["America/Vancouver","Vancouver (PT)"],["America/Toronto","Toronto (ET)"],
  ["Europe/London","London (GMT/BST)"],["Europe/Paris","Paris (CET)"],
  ["Asia/Manila","Manila (PHT)"],["Asia/Tokyo","Tokyo (JST)"],
  ["Australia/Sydney","Sydney (AEST)"],["Pacific/Auckland","Auckland (NZST)"],
];

function OnboardingScreen({ step, user, orgId, orgName, userProfile, onProfileDone, onAddShow }) {
  const [name, setName] = useState(userProfile?.name || "");
  const [company, setCompany] = useState(orgName || "");
  const [timezone, setTimezone] = useState(userProfile?.timezone || "America/Vancouver");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const obInp = {
    width:"100%", background:T.surface, border:`1px solid ${T.cardBorder}`,
    borderRadius:"8px", padding:"12px 16px", color:T.text, fontSize:"16px",
    outline:"none", boxSizing:"border-box",
    fontFamily:"'DM Sans', system-ui, sans-serif",
  };
  const obLbl = {
    fontSize:"12px", letterSpacing:"2px", textTransform:"uppercase",
    color:T.textMuted, display:"block", marginBottom:"8px",
    fontFamily:"'DM Sans', system-ui, sans-serif",
  };

  async function handleProfileSave() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr("");
    try {
      const { error: profErr } = await supabase.from("profiles")
        .update({ name: name.trim(), timezone })
        .eq("id", user.id);
      if (profErr) throw profErr;
      if (company.trim() && orgId) {
        const { error: orgErr } = await supabase.from("organizations")
          .update({ name: company.trim() })
          .eq("id", orgId);
        if (orgErr) throw orgErr;
      }
      onProfileDone(name.trim(), company.trim(), timezone);
    } catch(e) {
      setErr("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ width:"100%", maxWidth:"520px" }}>
        {/* Logo */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:"48px" }}>
          <img src="/logo-nav.png" alt="Podcast Impact Content Studio" style={{ height:"240px", objectFit:"contain" }} />
        </div>

        {step === "profile" && (
          <div style={{ animation:"fadeUp .4s ease" }}>
            <div style={{ marginBottom:"32px", textAlign:"center" }}>
              <h1 style={{ fontSize:"40px", fontWeight:"700", color:T.text, margin:"0 0 12px", fontFamily:PF, lineHeight:"1.2" }}>
                Welcome, {name || "friend"}! 👋
              </h1>
              <p style={{ fontSize:"15px", color:T.textMuted, margin:0, lineHeight:"1.6", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                Before you dive in, let's make sure we have your details right.
              </p>
            </div>
            <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:"12px", padding:"32px", display:"flex", flexDirection:"column", gap:"20px" }}>
              <div>
                <label style={obLbl}>Full Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={obInp} />
              </div>
              <div>
                <label style={obLbl}>Company Name <span style={{ textTransform:"none", letterSpacing:"0", opacity:.6 }}>(optional)</span></label>
                <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Your business or agency name" style={obInp} />
              </div>
              <div>
                <label style={obLbl}>Your Timezone</label>
                <select value={timezone} onChange={e=>setTimezone(e.target.value)} style={{ ...obInp, cursor:"pointer" }}>
                  {OB_TIMEZONES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
                <p style={{ fontSize:"12px", color:T.textMuted, margin:"6px 0 0", fontStyle:"italic", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                  Publish schedules will display in your local time.
                </p>
              </div>
              {err && <p style={{ color:"#F09090", fontSize:"14px", margin:0, fontFamily:"'DM Sans', system-ui, sans-serif" }}>{err}</p>}
              <button onClick={handleProfileSave} disabled={saving} style={{ padding:"14px 28px", background:T.coral, border:"none", borderRadius:"8px", color:"#fff", fontSize:"16px", fontWeight:"700", cursor:"pointer", letterSpacing:"1px", fontFamily:"'DM Sans', system-ui, sans-serif", alignSelf:"flex-start" }}>
                {saving ? "Saving..." : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {step === "guide" && (
          <div style={{ animation:"fadeUp .4s ease", maxWidth:"600px" }}>
            <div style={{ textAlign:"center", marginBottom:"40px" }}>
              <div style={{ fontSize:"48px", marginBottom:"16px" }}>🎉</div>
              <h1 style={{ fontSize:"36px", fontWeight:"700", color:T.text, margin:"0 0 12px", fontFamily:PF, lineHeight:"1.2" }}>You're all set up!</h1>
              <p style={{ fontSize:"16px", color:T.textMuted, margin:0, lineHeight:"1.7", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                Here's how Podcast Impact Content Studio works:
              </p>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"16px", marginBottom:"40px" }}>
              {[
                { n:"01", icon:"🧬", title:"Set up your Show DNA", desc:"Add your show's voice, audience, platforms, and boilerplate once. The AI uses this to write in your exact style every time." },
                { n:"02", icon:"📋", title:"Paste a transcript", desc:"Copy and paste any episode transcript — or upload a .txt or .docx file. No formatting needed." },
                { n:"03", icon:"✨", title:"Get your full content package", desc:"Show notes, YouTube description, social posts, newsletter, blog post — all generated in your show's voice, ready to use." },
              ].map(s=>(
                <div key={s.n} style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:"12px", padding:"20px 24px", display:"flex", gap:"16px", alignItems:"flex-start" }}>
                  <div style={{ fontSize:"28px", flexShrink:0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize:"11px", color:T.coral, fontWeight:"700", letterSpacing:"2px", marginBottom:"4px" }}>{s.n}</div>
                    <div style={{ fontSize:"16px", fontWeight:"700", color:T.text, marginBottom:"6px", fontFamily:PF }}>{s.title}</div>
                    <div style={{ fontSize:"14px", color:T.textSecondary, lineHeight:"1.6", fontFamily:"'DM Sans', system-ui, sans-serif" }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign:"center" }}>
              <button onClick={onAddShow} style={{ padding:"16px 40px", background:T.coral, border:"none", borderRadius:"8px", color:"#fff", fontSize:"16px", fontWeight:"700", cursor:"pointer", letterSpacing:"1px", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                Set Up My First Show →
              </button>
              <p style={{ fontSize:"13px", color:T.textMuted, marginTop:"12px", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                You can always update your show DNA later from the Admin panel.
              </p>
            </div>
          </div>
        )}

        {step === "show" && (
          <div style={{ animation:"fadeUp .4s ease" }}>
            <div style={{ marginBottom:"32px" }}>
              <h1 style={{ fontSize:"40px", fontWeight:"700", color:T.text, margin:"0 0 12px", fontFamily:PF, lineHeight:"1.2" }}>
                Now let's add your first show
              </h1>
              <p style={{ fontSize:"15px", color:T.textMuted, margin:0, lineHeight:"1.6", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                Set up a show profile so the AI knows exactly how to write for your podcast — voice, audience, platforms, and format.
              </p>
            </div>
            <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:"12px", padding:"32px" }}>
              <div style={{ fontSize:"48px", marginBottom:"16px", textAlign:"center" }}>🎙️</div>
              <p style={{ fontSize:"15px", color:T.textMuted, textAlign:"center", lineHeight:"1.6", margin:"0 0 28px", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                The more detail you add, the better your content will be. You can always come back and update it.
              </p>
              <div style={{ textAlign:"center" }}>
                <button onClick={onAddShow} style={{ padding:"14px 36px", background:T.coral, border:"none", borderRadius:"8px", color:"#fff", fontSize:"16px", fontWeight:"700", cursor:"pointer", letterSpacing:"1px", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                  Add My First Show →
                </button>
              </div>
            </div>
            <p style={{ fontSize:"13px", color:T.textMuted, textAlign:"center", marginTop:"20px", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
              Once you've saved your show, you'll go straight into the app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── BETA DISCLAIMER MODAL ─────────────────────────────────────────────────────
function BetaDisclaimerModal({ onAcknowledge }) {
  const FF = "'DM Sans', system-ui, sans-serif";
  const points = [
    { icon: "🔄", title: "Regular Updates", text: "We're actively building and improving the app. You may notice new features and occasional changes." },
    { icon: "🐛", title: "Found a Bug? Tell Us.", text: "Email info@podcastimpactstudio.com — your feedback directly shapes what we build next." },
    { icon: "🎁", title: "Free During Beta", text: "As a beta tester you have full access at no cost. Pricing takes effect at public launch." },
  ];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,26,26,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:"20px" }}>
      <div style={{ background:T.card, border:"1px solid "+T.cardBorder, borderRadius:"20px", padding:"44px 40px", maxWidth:"520px", width:"100%", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ textAlign:"center", marginBottom:"28px" }}>
          <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", marginBottom:"16px" }}>
            <img src="/logo-nav.png" alt="Podcast Impact Content Studio" style={{ height:"80px", objectFit:"contain", marginBottom:"10px" }} />
            <div style={{ display:"inline-block", background:T.coralSoft, border:"1px solid "+T.coralMid, borderRadius:"20px", padding:"4px 14px", fontSize:"11px", fontWeight:"700", letterSpacing:"2px", textTransform:"uppercase", color:T.coral }}>Beta</div>
          </div>
          <h2 style={{ fontSize:"22px", fontWeight:"700", color:T.text, margin:"0 0 10px", fontFamily:FF, lineHeight:"1.3" }}>Welcome to Podcast Impact Content Studio</h2>
          <p style={{ fontSize:"14px", color:T.textMuted, margin:0, lineHeight:"1.6", fontFamily:FF }}>Thanks for being an early tester! A few things to know:</p>
        </div>
        <div style={{ marginBottom:"24px" }}>
          {points.map((p, i) => (
            <div key={i} style={{ display:"flex", gap:"14px", marginBottom:"16px", alignItems:"flex-start" }}>
              <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:T.coralSoft, border:"1px solid "+T.coralMid, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", flexShrink:0 }}>{p.icon}</div>
              <div>
                <div style={{ fontSize:"14px", fontWeight:"700", color:T.text, fontFamily:FF, marginBottom:"3px" }}>{p.title}</div>
                <div style={{ fontSize:"13px", color:T.textSecondary, fontFamily:FF, lineHeight:"1.6" }}>{p.text}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onAcknowledge}
          style={{ width:"100%", padding:"15px", background:T.coral, border:"none", borderRadius:"10px", color:"#fff", fontSize:"16px", fontWeight:"700", cursor:"pointer", fontFamily:FF, transition:"background 0.2s" }}>
          Let's Go! →
        </button>
      </div>
    </div>
  );
}

// ── ONBOARDING TOUR ────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  { icon: "🎙️", title: "Welcome to Your Content Studio", body: "Podcast Impact Content Studio turns your episode transcripts into complete, publish-ready content packages — show notes, social captions, YouTube descriptions, newsletters, and more. All written in your show's voice." },
  { icon: "📋", title: "Start by Selecting a Show", body: "Your show library lives on the home screen. Each card represents a show with its own DNA — voice, audience, platforms, and style. Click a show to start creating content for it. Admins can manage shows in the Show DNA Manager (⚙️ icon)." },
  { icon: "🎬", title: "Four Powerful Modes", body: "Full Content Package — everything from one transcript.\nClips & Shorts — content written around specific clip timestamps.\nEditor Companion — hook recs, pacing notes, and a brief for your editor.\nEpisode Prep — AI-generated research docs, guest prep, and run-of-show." },
  { icon: "📝", title: "Add Your Transcript", body: "Paste your full episode transcript directly into the text area, or upload a .txt file. The AI reads the whole thing — the longer and more complete it is, the better the output. Show notes, social, email, blog — all generated at once." },
  { icon: "✨", title: "Your Content Package is Ready", body: "Generated content appears in organized sections you can copy individually or download as a formatted Word doc. You can also revise any section with a custom instruction — just click 'Edit' next to any section and type what you want changed." },
];

function TourModal({ onDone }) {
  const [step, setStep] = useState(0);
  const FF = "'DM Sans', system-ui, sans-serif";
  const s = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,26,26,0.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9998, padding:"20px" }}>
      <div style={{ background:T.card, border:"1px solid "+T.cardBorder, borderRadius:"20px", padding:"44px 40px", maxWidth:"540px", width:"100%", boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }}>
        {/* Step dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:"6px", marginBottom:"32px" }}>
          {TOUR_STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{ width: i === step ? "20px" : "6px", height:"6px", borderRadius:"3px", background: i === step ? T.coral : T.cardBorder, transition:"all .25s", cursor:"pointer" }} />
          ))}
        </div>
        <div style={{ textAlign:"center", marginBottom:"28px" }}>
          <div style={{ fontSize:"48px", marginBottom:"16px" }}>{s.icon}</div>
          <div style={{ fontSize:"22px", fontWeight:"700", color:T.text, fontFamily:FF, marginBottom:"14px", lineHeight:"1.3" }}>{s.title}</div>
          <div style={{ fontSize:"14px", color:T.textSecondary, fontFamily:FF, lineHeight:"1.8", whiteSpace:"pre-line" }}>{s.body}</div>
        </div>
        <div style={{ display:"flex", gap:"10px" }}>
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ flex:1, padding:"13px", background:"transparent", border:"1px solid "+T.cardBorder, borderRadius:"10px", color:T.textSecondary, fontSize:"14px", fontWeight:"600", cursor:"pointer", fontFamily:FF }}>← Back</button>}
          <button onClick={() => isLast ? onDone() : setStep(s => s + 1)} style={{ flex:1, padding:"13px", background:T.coral, border:"none", borderRadius:"10px", color:"#fff", fontSize:"14px", fontWeight:"700", cursor:"pointer", fontFamily:FF }}>
            {isLast ? "Let's Create! 🚀" : "Next →"}
          </button>
        </div>
        <div style={{ textAlign:"center", marginTop:"14px" }}>
          <button onClick={onDone} style={{ background:"none", border:"none", color:T.textMuted, fontSize:"12px", cursor:"pointer", fontFamily:FF }}>Skip tour</button>
        </div>
      </div>
    </div>
  );
}

// ── WHAT'S NEW ─────────────────────────────────────────────────────────────────
const CHANGELOG = [
  {
    version: "1.0", date: "May 2026", label: "Initial Beta Release",
    items: [
      "🎙️ Show DNA Manager — Build detailed show profiles with voice, audience, platforms, boilerplate, and editing levels. Paste any existing DNA doc or transcript and AI fills all fields automatically.",
      "📦 Full Content Package — Paste a transcript and generate show notes, YouTube description, social captions for every platform, email newsletter, and blog post in one click.",
      "✂️ Clips & Shorts — Add individual clip transcripts with timestamps and get platform-optimized content written around each clip.",
      "🎬 Editor Companion — Generates hook recommendations, pacing notes, clip timestamps, and a structured editing brief for your video editor.",
      "📋 Episode Prep — AI-powered pre-episode research doc. Includes guest profiles, discussion questions, run-of-show, and coaching notes — written for your show's specific format.",
      "🎨 Multi-platform Hub — Select your platforms per show and content is generated and optimized for each one (Instagram, LinkedIn, Facebook, X, TikTok, YouTube, Podcast, and more).",
      "📄 Word Doc Export — Download any content package as a formatted .docx file, ready to hand off.",
      "✏️ In-line Revisions — Not happy with a section? Click Edit, type your instruction, and Claude rewrites just that section.",
      "👥 Team Workspace — Invite editors, manage roles, and each team member has their own profile and timezone settings.",
      "🔒 Secure by design — All AI calls go through server-side proxies. No API keys in the browser.",
    ]
  }
];

function WhatsNewModal({ onClose }) {
  const FF = "'DM Sans', system-ui, sans-serif";
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,26,26,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9997, padding:"20px" }}>
      <div style={{ background:T.card, border:"1px solid "+T.cardBorder, borderRadius:"20px", padding:"0", maxWidth:"600px", width:"100%", maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.22)", overflow:"hidden" }}>
        <div style={{ padding:"28px 32px 20px", borderBottom:"1px solid "+T.cardBorder, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:"20px", fontWeight:"700", color:T.text, fontFamily:FF }}>What's New</div>
            <div style={{ fontSize:"13px", color:T.textMuted, fontFamily:FF, marginTop:"2px" }}>Latest updates to Podcast Impact Content Studio</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid "+T.cardBorder, borderRadius:"8px", color:T.textMuted, fontSize:"13px", cursor:"pointer", padding:"6px 14px", fontFamily:FF }}>✕ Close</button>
        </div>
        <div style={{ overflowY:"auto", padding:"24px 32px" }}>
          {CHANGELOG.map((v, vi) => (
            <div key={vi} style={{ marginBottom:"32px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
                <div style={{ padding:"4px 12px", background:T.coralSoft, border:"1px solid "+T.coralMid, borderRadius:"20px", fontSize:"12px", fontWeight:"700", color:T.coral, fontFamily:FF, letterSpacing:"0.5px" }}>v{v.version}</div>
                <div style={{ fontSize:"13px", fontWeight:"600", color:T.text, fontFamily:FF }}>{v.label}</div>
                <div style={{ fontSize:"12px", color:T.textMuted, fontFamily:FF }}>{v.date}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {v.items.map((item, i) => (
                  <div key={i} style={{ display:"flex", gap:"12px", alignItems:"flex-start", padding:"12px 14px", background:T.surface, borderRadius:"10px", border:"1px solid "+T.cardBorder }}>
                    <div style={{ fontSize:"18px", flexShrink:0, marginTop:"1px" }}>{item.charAt(0)}</div>
                    <div style={{ fontSize:"13px", color:T.textSecondary, fontFamily:FF, lineHeight:"1.6" }}>{item.slice(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── HELP & GUIDE ───────────────────────────────────────────────────────────────
const GUIDE_SECTIONS = [
  { icon:"📋", title:"Show DNA Manager", body:"Go to Admin → Show DNA Manager. Each show has tabs for Basic Info, Voice DNA, Audience (including The ONE Person), Episode Prep, Platforms, Show Notes Builder, Boilerplate, Editor Companion, and Episode Formats.\n\nPaste any existing Show DNA document or episode transcript into the left sidebar — AI auto-detects the content type and fills all fields. You can also upload a .txt or .docx file.\n\nSave your show and it appears in your show library on the home screen." },
  { icon:"📦", title:"Full Content Package", body:"Select a show → Full Content Package mode → configure your episode (number, guest name, platforms) → paste or upload your transcript → click Generate.\n\nYou'll get: Show notes with your custom structure, YouTube description, social captions for every active platform, email newsletter, and blog post — all written in your show's voice.\n\nCopy individual sections, download the whole package as a Word doc, or revise any section with a custom instruction." },
  { icon:"✂️", title:"Clips & Shorts", body:"Select a show → Clips & Shorts mode → add your clips one by one. Each clip gets a transcript snippet and timestamps.\n\nFor each clip, Claude generates platform-specific hooks, captions, and CTAs — formatted for Instagram Reels, TikTok, YouTube Shorts, LinkedIn, and wherever your show lives.\n\nPerfect for repurposing your best moments across platforms." },
  { icon:"🎬", title:"Editor Companion", body:"Select a show → Editor Companion mode → paste your full transcript.\n\nYou get: hook moment recommendations with timestamps, clip selection suggestions, pacing notes, and a structured editing brief your video editor can follow.\n\nThe editing level (1, 2, or 3) is set per show in the Show DNA Manager → Editor Companion tab, and determines how aggressively the brief recommends cuts." },
  { icon:"📋", title:"Episode Prep", body:"Select a show → Episode Prep mode → choose your episode format (set up formats in Admin → Episode Formats tab) → fill in episode details.\n\nYou get a full pre-episode research package: guest profile, discussion questions, run-of-show, segment notes, and coaching reminders — all written for your show's specific format and audience.\n\nRequires Episode Formats to be set up in Show DNA first." },
  { icon:"✏️", title:"Revising Content", body:"On the results page, click the pencil icon (✏️) next to any section. Type your revision instruction — e.g. 'Make the hook more urgent' or 'Shorten this to 3 bullet points' — and click Revise.\n\nClaude rewrites just that section without touching the rest of your package." },
  { icon:"👥", title:"Team & Profiles", body:"Admins can invite team members from Admin → Settings → Team. Team members get an email invite and set up their own profile.\n\nEach user has a profile with their name and timezone. Publish schedules set per show automatically convert to each editor's local time." },
];

function HelpGuideModal({ onClose }) {
  const FF = "'DM Sans', system-ui, sans-serif";
  const [open, setOpen] = useState(null);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,26,26,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9997, padding:"20px" }}>
      <div style={{ background:T.card, border:"1px solid "+T.cardBorder, borderRadius:"20px", padding:"0", maxWidth:"620px", width:"100%", maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.22)", overflow:"hidden" }}>
        <div style={{ padding:"28px 32px 20px", borderBottom:"1px solid "+T.cardBorder, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:"20px", fontWeight:"700", color:T.text, fontFamily:FF }}>Help & Guide</div>
            <div style={{ fontSize:"13px", color:T.textMuted, fontFamily:FF, marginTop:"2px" }}>How to use every feature</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid "+T.cardBorder, borderRadius:"8px", color:T.textMuted, fontSize:"13px", cursor:"pointer", padding:"6px 14px", fontFamily:FF }}>✕ Close</button>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 24px" }}>
          {GUIDE_SECTIONS.map((s, i) => (
            <div key={i} style={{ border:"1px solid "+T.cardBorder, borderRadius:"12px", marginBottom:"8px", overflow:"hidden" }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width:"100%", padding:"16px 20px", background: open === i ? T.coralSoft : "transparent", border:"none", display:"flex", alignItems:"center", gap:"12px", cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontSize:"20px" }}>{s.icon}</span>
                <span style={{ flex:1, fontSize:"14px", fontWeight:"700", color: open === i ? T.coral : T.text, fontFamily:FF }}>{s.title}</span>
                <span style={{ fontSize:"12px", color:T.textMuted, transition:"transform .2s", display:"inline-block", transform: open === i ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </button>
              {open === i && (
                <div style={{ padding:"16px 20px 20px", borderTop:"1px solid "+T.cardBorder, background:T.surface }}>
                  <div style={{ fontSize:"13px", color:T.textSecondary, fontFamily:FF, lineHeight:"1.8", whiteSpace:"pre-line" }}>{s.body}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── HELP WIDGET ────────────────────────────────────────────────────────────────
function HelpWidget({ onWhatsNew, onHelpGuide }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const FF = "'DM Sans', system-ui, sans-serif";
  useEffect(() => {
    if (!open) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const items = [
    { icon:"💬", label:"Share Feedback", action: () => { window.location.href = "mailto:info@podimpactstudio.com?subject=PIS Content Creator Feedback"; setOpen(false); } },
    { icon:"🚀", label:"What's New", action: () => { onWhatsNew(); setOpen(false); } },
    { icon:"📖", label:"Help & Guide", action: () => { onHelpGuide(); setOpen(false); } },
  ];
  return (
    <div ref={ref} style={{ position:"fixed", bottom:"24px", right:"24px", zIndex:9000 }}>
      {open && (
        <div style={{ position:"absolute", bottom:"52px", right:0, background:T.surface, border:"1px solid "+T.cardBorder, borderRadius:"12px", boxShadow:"0 8px 32px rgba(0,0,0,0.3)", overflow:"hidden", minWidth:"190px", animation:"fadeUp .15s ease" }}>
          {items.map((item, i) => (
            <button key={i} onClick={item.action}
              style={{ width:"100%", padding:"11px 16px", background:"transparent", border:"none", display:"flex", alignItems:"center", gap:"10px", color:T.text, fontSize:"13px", fontFamily:FF, cursor:"pointer", textAlign:"left", borderBottom: i < items.length - 1 ? "1px solid "+T.cardBorder : "none" }}
              onMouseEnter={e => e.currentTarget.style.background = T.card}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize:"16px" }}>{item.icon}</span>
              <span style={{ fontWeight:"500" }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(v => !v)}
        style={{ width:"40px", height:"40px", borderRadius:"50%", background: open ? T.coral : T.surface, border:"1px solid "+(open ? T.coral : T.cardBorder), color: open ? "#fff" : T.textSecondary, fontSize:"18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 12px rgba(0,0,0,0.2)", transition:"all .15s", fontFamily:FF }}
        title="Help & Feedback">
        {open ? "✕" : "?"}
      </button>
    </div>
  );
}

// ── FIRST SHOW WIZARD ──────────────────────────────────────────────────────────
function FirstShowWizard({ onOpenAdmin, onSkip }) {
  const [step, setStep] = useState(1); // 1 = name, 2 = method
  const [showName, setShowName] = useState("");
  const FF = "'DM Sans', system-ui, sans-serif";

  const steps = ["Name Your Show", "Set Up Show DNA"];

  return (
    <div style={{ background:T.card, border:"1px solid "+T.cardBorder, borderRadius:"16px", padding:"48px 40px", maxWidth:"600px", margin:"0 auto", animation:"fadeUp .4s ease" }}>
      {/* Step indicator */}
      <div style={{ display:"flex", alignItems:"center", gap:"0", marginBottom:"40px" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
              <div style={{ width:"28px", height:"28px", borderRadius:"50%", background: step > i ? T.coral : (step === i+1 ? T.coral : T.bg), border:"2px solid "+(step >= i+1 ? T.coral : T.cardBorder), display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"700", color: step >= i+1 ? "#fff" : T.textMuted, transition:"all 0.2s" }}>
                {step > i+1 ? "✓" : i+1}
              </div>
              <span style={{ fontSize:"12px", fontWeight: step === i+1 ? "700" : "400", color: step === i+1 ? T.text : T.textMuted, fontFamily:FF, whiteSpace:"nowrap" }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex:1, height:"1px", background: step > i+1 ? T.coral : T.cardBorder, margin:"0 12px", transition:"background 0.2s" }} />}
          </div>
        ))}
      </div>

      {/* Step 1 — Name */}
      {step === 1 && (
        <div>
          <div style={{ fontSize:"28px", fontWeight:"700", color:T.text, marginBottom:"8px", fontFamily:FF }}>Let's name your show 🎙️</div>
          <p style={{ fontSize:"15px", color:T.textMuted, marginBottom:"32px", lineHeight:"1.6", fontFamily:FF }}>
            What's the podcast you're setting up content for? You can always edit this later.
          </p>
          <label style={{ fontSize:"12px", letterSpacing:"2px", textTransform:"uppercase", color:T.textMuted, display:"block", marginBottom:"8px", fontFamily:FF }}>Show Name *</label>
          <input
            type="text"
            placeholder="e.g. The Daily Wellness Podcast"
            value={showName}
            onChange={e => setShowName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && showName.trim() && setStep(2)}
            autoFocus
            style={{ width:"100%", background:T.surface, border:"1px solid "+T.cardBorder, borderRadius:"8px", padding:"14px 16px", color:T.text, fontSize:"16px", outline:"none", boxSizing:"border-box", fontFamily:FF, marginBottom:"24px" }}
          />
          <div style={{ display:"flex", gap:"12px", alignItems:"center" }}>
            <button onClick={() => showName.trim() && setStep(2)} disabled={!showName.trim()}
              style={{ padding:"14px 32px", background:showName.trim()?T.coral:"#ccc", border:"none", borderRadius:"8px", color:"#fff", fontSize:"15px", fontWeight:"700", cursor:showName.trim()?"pointer":"not-allowed", fontFamily:FF }}>
              Next →
            </button>
            <button onClick={onSkip} style={{ background:"none", border:"none", color:T.textMuted, fontSize:"14px", cursor:"pointer", fontFamily:FF, padding:"14px 8px" }}>
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — DNA method */}
      {step === 2 && (
        <div>
          <div style={{ fontSize:"28px", fontWeight:"700", color:T.text, marginBottom:"8px", fontFamily:FF }}>Set up your Show DNA ✨</div>
          <p style={{ fontSize:"15px", color:T.textMuted, marginBottom:"32px", lineHeight:"1.6", fontFamily:FF }}>
            Show DNA is what makes your content sound like <em>you</em> — your voice, audience, platforms, and style. How would you like to set it up?
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:"14px", marginBottom:"32px" }}>
            {[
              {
                icon: "🤖",
                title: "Generate from transcripts (recommended)",
                desc: "Upload 2–5 episode transcripts and we'll automatically extract your show's voice, audience, and content style using AI.",
                action: () => onOpenAdmin("transcript"),
              },
              {
                icon: "✍️",
                title: "Fill it in myself",
                desc: "Walk through each section of your Show DNA — voice, audience, platforms, show notes style, and boilerplate — at your own pace.",
                action: () => onOpenAdmin("manual"),
              },
            ].map((opt, i) => (
              <button key={i} onClick={opt.action}
                style={{ display:"flex", gap:"16px", alignItems:"flex-start", padding:"20px 22px", background:T.surface, border:"1px solid "+T.cardBorder, borderRadius:"12px", cursor:"pointer", textAlign:"left", transition:"all 0.15s", fontFamily:FF }}>
                <div style={{ fontSize:"28px", flexShrink:0 }}>{opt.icon}</div>
                <div>
                  <div style={{ fontSize:"15px", fontWeight:"700", color:T.text, marginBottom:"5px" }}>{opt.title}</div>
                  <div style={{ fontSize:"13px", color:T.textSecondary, lineHeight:"1.6" }}>{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} style={{ background:"none", border:"none", color:T.textMuted, fontSize:"14px", cursor:"pointer", fontFamily:FF, padding:0 }}>
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

export default function App(){
  const[shows,setShows]=useState({});
  const[loadingShows,setLoadingShows]=useState(true);
  const[step,setStep]=useState("welcome");
  const[show,setShow]=useState(null);
  const[showSelectorHighlight,setShowSelectorHighlight]=useState(false);
  const[mode,setMode]=useState(null);
  const[guest,setGuest]=useState(null);
  const[ep,setEp]=useState("");
  const[tx,setTx]=useState("");
  const[raw,setRaw]=useState("");
  const[secs,setSecs]=useState([]);
  const[err,setErr]=useState("");
  const[busy,setBusy]=useState(false);
  const[editing,setEditing]=useState(false);
  const[eSec,setESec]=useState(null);
  const[eTxt,setETxt]=useState("");
  const[rev,setRev]=useState(false);
  const[cpAll,setCpAll]=useState(false);
  const[dlOk,setDlOk]=useState(false);
  const[dlHtmlOk,setDlHtmlOk]=useState(false);
  const[dragging,setDragging]=useState(false);
  const[extraPlatforms,setExtraPlatforms]=useState([]);
  const[clipCount,setClipCount]=useState(3);
  const[editorClipCount,setEditorClipCount]=useState(5);
  const[descriptProjectId,setDescriptProjectId]=useState("");
  const[descriptApiKey,setDescriptApiKey]=useState("");

  useEffect(()=>{
    async function init(){
      // Load global settings
      try{
        const {data}=await supabase.from("settings").select("value").eq("key","global").single();
        if(data?.value?.descriptApiKey) setDescriptApiKey(data.value.descriptApiKey);
      }catch{}
    }
    init();
  },[]);
  const[descriptStatus,setDescriptStatus]=useState("");
  const[descriptSending,setDescriptSending]=useState(false);
  const[clipTexts,setClipTexts]=useState(Array(10).fill(""));
  const[clipResults,setClipResults]=useState([]);
  const[clipPlatforms,setClipPlatforms]=useState(["YouTube"]);
  const[showAdmin,setShowAdmin]=useState(false);
  const[showAdminGate,setShowAdminGate]=useState(false);
  const[isAdmin,setIsAdmin]=useState(false);
  const[isClient,setIsClient]=useState(false);
  const[clientConfig,setClientConfig]=useState(null); // {assignedShow, allowedModes, scheduleUrl}
  const[currentUser,setCurrentUser]=useState(null);
  const[authReady,setAuthReady]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[userProfile,setUserProfile]=useState(null);
  const[orgId,setOrgId]=useState(null);
  const[orgName,setOrgName]=useState("");
  const[onboardingComplete,setOnboardingComplete]=useState(true);
  const[onboardingStep,setOnboardingStep]=useState(null);
  const[accountType,setAccountType]=useState("agency");
  const fileRef=useRef(null);
  const[showUserMenu,setShowUserMenu]=useState(false);
  const userMenuRef=useRef(null);
  const[gDriveStatus,setGDriveStatus]=useState(""); // "" | "uploading" | "ok" | "error" | "disconnected"
  const[betaAcknowledged,setBetaAcknowledged]=useState(false);
  const[showTour,setShowTour]=useState(false);
  const[showWhatsNew,setShowWhatsNew]=useState(false);
  const[showHelpGuide,setShowHelpGuide]=useState(false);
  const[showFirstShowWizard,setShowFirstShowWizard]=useState(false);
  const[selectedFormat,setSelectedFormat]=useState(null);
  const[epGuest,setEpGuest]=useState("");
  const[epGuestUrl,setEpGuestUrl]=useState("");
  const[epTopic,setEpTopic]=useState("");
  const[epTakeaway,setEpTakeaway]=useState("");
  const[epMoments,setEpMoments]=useState("");
  const[epPanelists,setEpPanelists]=useState("");
  const[epPlanRequest,setEpPlanRequest]=useState("");

  const d=show?shows[show]:null;
  const clr=d?.clr||T.coral;
  const ci={welcome:0,configure:1,"clips-setup":2,input:2,generating:2,result:2,"prep-format":1,"prep-details":2}[step]||0;

  useEffect(()=>{
    if(!authReady)return;
    loadShows().then(s=>{setShows(s);setLoadingShows(false);const keys=Object.keys(s);if(keys.length===1)setShow(keys[0]);});
  },[authReady,orgId]);
  useEffect(()=>{
    if(!showUserMenu)return;
    function handleClick(e){if(userMenuRef.current&&!userMenuRef.current.contains(e.target))setShowUserMenu(false);}
    document.addEventListener("mousedown",handleClick);
    return()=>document.removeEventListener("mousedown",handleClick);
  },[showUserMenu]);
  async function refreshShows(){const s=await loadShows();setShows(s);}
  async function readFile(file){const name=file.name.toLowerCase();if(name.endsWith(".txt")||name.endsWith(".md")){const text=await file.text();setTx(text);setErr("");}else{setErr("Unsupported file type. Use .txt");}}
  function handleDrop(e){e.preventDefault();setDragging(false);const f=e.dataTransfer?.files?.[0];if(f)readFile(f);}
  function handleFileInput(e){const f=e.target?.files?.[0];if(f)readFile(f);}

  async function genClips(){
    if(clipTexts.slice(0,clipCount).every(t=>!t.trim())){setErr("Paste at least one clip transcript.");return;}
    setErr("");setClipResults([]);setBusy(true);setStep("generating");
    const results=[];const platList=clipPlatforms.join(", ");
    for(let i=0;i<clipCount;i++){
      const clipTx=clipTexts[i].trim();
      if(!clipTx){results.push({index:i+1,skipped:true,content:{}});continue;}
      try{
        const clipSys=`You are creating social media clip content for ${d.name}.

CRITICAL OUTPUT RULES:
- PLAIN TEXT only. No markdown, no asterisks, no bold.
- Hashtags: put the # symbol directly before EACH word. Example: #CancerRisk #Firefighters #ToxicSmoke
- Title: write ONLY the title text — no "SEO Title:" or "Title:" label before it
- Description: write ONLY the description text — no "Description:" label before it
- Never write label words like "Title:", "Description:", "Hashtags:", "Caption:"
- Section headers in ALL CAPS only

Show Voice: ${d.voice?.traits||""}
Tone: ${d.tag}
Platforms: ${platList}

Generate content for EACH platform below using EXACTLY this format — no extra labels:
${clipPlatforms.includes("YouTube")?`YOUTUBE CLIP ${i+1}
[title only — punchy, keyword-rich, under 60 chars, no show name]
[description only — 2-3 sentences optimized for YouTube search]
[hashtags only — 8-12 tags each starting with #, space separated]
KEYWORDS
[8-12 comma-separated keywords]`:""}
${clipPlatforms.includes("Instagram")?`INSTAGRAM REEL ${i+1}
[caption — hook in first line, 100-150 words, end with CTA]
[hashtags — 15-20 tags each starting with #, space separated]`:""}
${clipPlatforms.includes("Facebook")?`FACEBOOK REEL ${i+1}
[post — hook line, 80-120 words, CTA at end]`:""}
${clipPlatforms.includes("TikTok")?`TIKTOK ${i+1}
[caption — hook first, under 150 chars, include hashtags with # symbol]`:""}
${clipPlatforms.includes("Spotify")?`SPOTIFY CLIP ${i+1}
[title only]
[description — 1-2 sentences]`:""}

Write ONLY the sections above. No labels, no commentary, no extra text.`;
        // Add delay between clips to avoid rate limiting
        if(i>0) await new Promise(res=>setTimeout(res,2000));
        const j=await claudeAPI({model:"claude-sonnet-4-6",max_tokens:2000,system:clipSys,messages:[{role:"user",content:`CLIP ${i+1} TRANSCRIPT:\n${clipTx.substring(0,8000)}`}]});
        const t=j.content?.filter(b=>b.type==="text").map(b=>b.text).join("\n")||"";
        results.push({index:i+1,skipped:false,content:t});
      }catch(e){results.push({index:i+1,skipped:false,content:`Error: ${e.message}`});}
    }
    setClipResults(results);setBusy(false);setStep("result");
  }

  async function gen(){
    if(!tx.trim()){setErr("Paste the transcript.");return;}
    setErr("");setBusy(true);setRaw("");setSecs([]);setStep("generating");
    try{
      const j=await claudeAPI({model:"claude-sonnet-4-6",max_tokens:mode==="editor"?4000:8000,system:sys(d,show,guest,ep,mode,extraPlatforms,editorClipCount),messages:[{role:"user",content:mode==="editor"?`Analyze this transcript carefully and generate the Editor Brief as instructed.\n\nTRANSCRIPT:\n${tx.substring(0,90000)}`:`Generate the COMPLETE content package in plain text.\n\nTRANSCRIPT:\n${tx.substring(0,90000)}`}]});
      if(j.error){setErr(j.error.message);setStep("input");}
      else{const t=j.content?.filter(i=>i.type==="text").map(i=>i.text).join("\n")||"";if(!t.trim()){setErr("No content generated. Please try again.");setStep("input");return;}setRaw(strip(t));const parsed=parse(t);const bpRaw=d?.bp||null;// Attach original HTML boilerplate to show notes section (spread to ensure React detects change)
      const withBp=parsed.map(s=>s.id==="shownotes"&&bpRaw?{...s,bpHtml:bpRaw}:s);
      setSecs(withBp.length?withBp:[{id:"full",title:"Content Package",content:strip(t)}]);setStep("result");}
    }catch(e){setErr(e.message||"Network error.");setStep("input");}
    finally{setBusy(false);}
  }

  async function genPrep() {
    setErr(""); setBusy(true); setRaw(""); setSecs([]); setStep("generating");
    try {
      const fmt = selectedFormat;
      const onePerson = d?.epPrep?.onePerson || {};
      const permSlips = d?.epPrep?.permissionSlips || [];
      const storyMission = d?.epPrep?.storyMission || "";
      const listenerPersona = d?.aud?.who || "";
      // If structured ONE PERSON fields are empty but a Listener Persona exists, extract from it
      const hasOnePerson = onePerson.name || onePerson.question2AM || onePerson.wound;
      const systemPrompt = `You are generating a complete Episode Prep Package for ${d?.name}.

SHOW VOICE: ${d?.voice?.traits || ""} | ${d?.voice?.energy || ""}
AUDIENCE: ${listenerPersona}

THE ONE PERSON:
Name: ${onePerson.name || "[not set]"}
2AM Question: ${onePerson.question2AM || "[not set]"}
Core Wound: ${onePerson.wound || "[not set]"}
${!hasOnePerson && listenerPersona ? `
IMPORTANT — ONE PERSON CONTEXT: The structured ONE PERSON fields are not yet filled in, but the Listener Persona above contains detailed audience info. Extract a first name, a specific 2AM Question, and a Core Wound from that persona description and use them throughout this prep package. Label each extracted value with [From Listener Persona] so the user knows to review it.` : ""}

STORY-MISSION CONNECTION (use verbatim in Bridge — never invent):
${storyMission || "[not set — note this in output]"}

PERMISSION SLIP BANK (use only these — never invent):
${permSlips.length ? permSlips.map((s,i) => `${i+1}. ${s}`).join("\n") : "[not set — use placeholder brackets]"}

${fmt ? `EPISODE FORMAT: ${fmt.name} (${fmt.type})
Target Length: ${fmt.targetLength || "not specified"}
FORMAT STRUCTURE:
${fmt.structure}
SIGN-OFF LINE (use VERBATIM — never paraphrase): "${fmt.signOffLine || "[not set]"}"
${fmt.ratingSystem ? `RATING SYSTEM: ${fmt.ratingSystem}` : ""}` : "No format selected — use Show DNA to guide structure."}

EPISODE DETAILS:
Guest/Topic: ${epTopic || "[not specified]"}
${epGuest ? `Guest Name: ${epGuest}` : ""}
${epGuestUrl ? `Guest URL/Handle: ${epGuestUrl}` : ""}
One Takeaway: ${epTakeaway || "[not specified — suggest the single most listener-relevant takeaway from this guest/topic in the Episode Overview, labeled SUGGESTED TAKEAWAY]"}
${epMoments ? `Key Moments/Angles: ${epMoments}` : ""}
${epPanelists ? `Additional Panelists: ${epPanelists}` : ""}
${epPlanRequest ? `
WHAT THE HOST WANTS TO PLAN (their own words — treat this as the primary instruction for what to produce):
"${epPlanRequest}"

HOW TO HANDLE THIS REQUEST:
- This is what the host actually wants help planning. Honor it directly, using the Show DNA, THE ONE PERSON, voice, and ${fmt ? `the ${fmt.name} format` : "the show's usual style"} as your guardrails.
- If they are asking for a MULTI-PART SERIES (e.g. "a 5-part series on X"): before the standard sections, add a "SERIES PLAN" section that proposes the series arc — a one-line through-line, then each episode with a working title, the angle, and how it serves ${onePerson.name || "the ONE person"}. Then build the full prep package below for EPISODE 1 of that series.
- If they are asking you to SUGGEST or brainstorm topics: add a "SUGGESTED TOPICS" section near the top with 3–5 specific, on-brand topic ideas (each with a one-line why-it-fits), then prep the strongest one in full below.
- If it's a single solo or guest episode: just plan it in full as instructed below.
- TOPIC FRESHNESS: You do NOT have live web access. When you reference what's "trending," base it on general knowledge and clearly label it [BASED ON GENERAL KNOWLEDGE — please verify it's still current]. Never fabricate specific recent events, statistics, or headlines.` : ""}

ACCURACY RULES — NON-NEGOTIABLE:
- Never invent guest biographical details. If you cannot verify something, write: "[Could not verify — please fill in manually]"
- Never paraphrase the sign-off line. Use it exactly as written.
- Never invent permission slips. Only use slips from the Permission Slip Bank above.
- Flag anything inferred with [INFERRED — please verify]

OUTPUT FORMAT — use ALL CAPS headers, plain text, --- between sections:

---

EPISODE PREP PACKAGE
Show: ${d?.name}
${epGuest ? `Guest: ${epGuest}` : `Topic: ${epTopic}`}
Format: ${fmt?.name || "General"}
Generated: ${new Date().toLocaleDateString()}

---

HOOK (~30 seconds / ~75 words)
Write the actual hook script the host will record. Paint the listener's specific moment in vivid second-person ("You're...") or cinematic present tense ("She's staring at her laptop...") — NEVER use the listener archetype name or the host's name. Make the listener feel immediately seen. End with the show name. Root it in the 2AM question and this specific episode's angle.

---

BRIDGE (60–90 seconds)
[Host's personal connection to this episode topic — write as a scripted bridge the host can read and personalize. Extract from Story-Mission Connection if provided. If not provided, write a placeholder frame the host can fill in: "I remember the first time I [relevant moment]..." — clearly mark with [HOST: personalize this section].]

---

PERMISSION SLIP CLOSE (30–45 seconds)
Write the actual permission slip script the host will record. Address the listener directly as "you" — never use their archetype name. 2–3 slips from the Permission Slip Bank relevant to this episode. End with EXACT sign-off line verbatim.

---

EPISODE STRUCTURE
[Table of segments with timing, adapted to this specific episode based on the format structure above]

---

GUEST RESEARCH${epGuest ? ` — ${epGuest}` : ""}
Source: ${epGuestUrl ? epGuestUrl : "No URL provided — base only on topic description below."}
⚠️ ACCURACY: Only include what was explicitly provided or can be reasonably inferred from the topic. Flag anything uncertain with [UNVERIFIED — please check manually]. Never invent credentials, book titles, company names, or statistics.

Known Expertise: [What this guest/topic is known for, based strictly on the information provided above. If no URL given, draw only from the topic description. Use [UNVERIFIED — please check manually] for anything not confirmed.]
Potential Gaps or Blind Spots: [Areas where their perspective may be limited or where a probing question would add depth. Flag if inferred.]
Listener Relevance: [How their specific expertise directly addresses ${onePerson.name ? onePerson.name + "'s" : "the ONE person's"} 2AM question${onePerson.question2AM ? ` ("${onePerson.question2AM}")` : ""}. Be specific — connect their work to the wound.]

---

TAILORED INTERVIEW QUESTIONS
[Questions crafted to connect ${epGuest ? epGuest + "'s expertise" : "this topic"} → ${onePerson.name || "the ONE person"}'s specific needs. Every question should serve the listener, not just the guest.]

OPENING — Establish credibility and hook the listener in
- [Question that connects the guest's origin story to a moment ${onePerson.name || "the listener"} will immediately recognize — not a resume walkthrough]
- [Question that surfaces a "I didn't have it figured out either" moment — makes the guest relatable before they become the authority]

CORE QUESTIONS — Bridge expertise to the ONE Person's wound
- [Question that addresses "${onePerson.question2AM || "their 2AM question"}" directly through this guest's specific lens]
- [Question that names the core wound ("${onePerson.wound || "the underlying fear"}") indirectly — invites the guest to give the listener language for what they're feeling]
- [Question about the specific method, mindset shift, or moment the listener can walk away with and use today]

DEPTH QUESTIONS — For strong rapport or extended time
- ["What do most people get wrong about [topic]?" — surfaces nuance and positions guest as correcting a myth]
- [A gentle contrarian challenge: "Some people would argue the opposite — what would you say to them?" Use only if it would genuinely serve the listener.]

SETUP QUESTIONS — Plant seeds for the Permission Slip Close
- [A question that leads the guest to give the listener implicit permission — something like "What would you tell someone who feels like they're not ready yet?"]
- [Final question: what do you most want ${onePerson.name || "the listener"} to walk away knowing, feeling, or doing?]

---

CLIP PRIORITIES
[3–5 moments most likely to resonate with ${onePerson.name || "the ONE person"}. Note the estimated timestamp range if predictable from the structure. Include one "NEVER CLIP WITHOUT CONTEXT" moment.]

---

SUGGESTED EPISODE TITLES (SEO)
[5 title options. Optimized for podcast search and YouTube SEO. Each title should be specific, benefit-forward, and 50–70 characters. Mix formats: question, how-to, outcome-driven, and curiosity-gap. DO NOT include the show name in titles — titles only. Do NOT add a RECOMMENDED line.]

---

PRE-RECORDING CHECKLIST
[5–8 items specific to this episode and format. Include any guest prep items, tech checks, and one reminder tied to the ONE Person.]`;

      const j = await claudeAPI({ model: "claude-sonnet-4-6", max_tokens: 7000, system: systemPrompt, messages: [{ role: "user", content: "Generate the complete Episode Prep Package now." }] });
      const t = j.content?.filter(i => i.type === "text").map(i => i.text).join("\n") || "";
      if (!t.trim()) { setErr("No content generated. Please try again."); setStep("prep-details"); return; }
      const stripped = strip(t);
      setRaw(stripped);
      const parsed = parse(stripped);
      setSecs(parsed.length > 1 ? parsed : [{ id: "full", title: "Episode Prep Package", content: stripped }]);
      setStep("result");
    } catch(e) { setErr(e.message); setStep("prep-details"); }
    finally { setBusy(false); }
  }

  async function doRev(){
    if(!eSec||!eTxt.trim())return;setRev(true);setErr("");
    const label=ED.find(s=>s.id===eSec)?.l||eSec;
    try{
      const j=await claudeAPI({model:"claude-sonnet-4-6",max_tokens:4000,system:revSys(d),messages:[{role:"user",content:`Current:\n\n${raw}\n\n---\n\nRevise "${label}":\n${eTxt}\n\nPlain text only. Only the revised section.`}]});
      if(j.error)setErr(j.error.message);
      else{const v=strip(j.content.filter(i=>i.type==="text").map(i=>i.text).join("\n"));setRaw(p=>p+`\n\n${"═".repeat(40)}\nREVISION — ${label.toUpperCase()}\n${"═".repeat(40)}\n\n${v}`);setSecs(p=>[...p,{id:eSec+"-rev",title:`Revision — ${label}`,content:v}]);}
    }catch(e){setErr(e.message);}
    finally{setRev(false);setEditing(false);setESec(null);setETxt("");}
  }

  async function handleAuthenticated(user) {
    setCurrentUser(user);
    setAuthReady(true);
    setBetaAcknowledged(!!localStorage.getItem("pis_beta_ack_" + user.id));
    // Load user profile + org
    try {
      const { data } = await supabase
        .from("profiles")
        .select("name, timezone, role, org_id, organizations(name)")
        .eq("id", user.id)
        .single();
      setUserProfile(data);
      // Auto-repair: if profile is missing org_id but invite metadata has it, fix it now
      // so the subsequent show fetch (RLS uses org_id) works correctly
      let effectiveOrgId = data?.org_id || null;
      if (!effectiveOrgId && user.user_metadata?.org_id) {
        const metaOrgId = user.user_metadata.org_id;
        try {
          await supabase.from("profiles").update({ org_id: metaOrgId }).eq("id", user.id);
          effectiveOrgId = metaOrgId;
        } catch {}
      }
      const myOrgId = effectiveOrgId;
      setOrgId(myOrgId);
      setOrgName(data?.organizations?.name || "");
      // Check admin: role in profiles OR hardcoded admin emails
      const adminEmails = ["tamar@podcastimpactstudio.com", "tamarroutly@gmail.com"];
      const isAdminUser = data?.role === "admin" || adminEmails.includes(user.email?.toLowerCase());
      setIsAdmin(isAdminUser);
      // Check collaborator role (show-specific access)
      const COLLAB_ROLES = ["client", "collaborator", "host"];
      const isClientUser = !isAdminUser && COLLAB_ROLES.includes((data?.role || "").toLowerCase());
      setIsClient(isClientUser);
      if (isClientUser) {
        try {
          const { data: sData } = await supabase.from("settings").select("value").eq("key", "global").single();
          const teamList = sData?.value?.team || [];
          const myEntry = teamList.find(m => m.email?.toLowerCase() === user.email?.toLowerCase());
          // Support both new assignedShows[] and legacy assignedShow string
          const assignedShows = myEntry?.assignedShows || (myEntry?.assignedShow ? [myEntry.assignedShow] : []);
          const allowedModes = myEntry?.allowedModes || ["prep"];
          const scheduleUrl = sData?.value?.scheduleUrl || "";
          setClientConfig({ assignedShows, allowedModes, scheduleUrl });
          if (assignedShows.length === 1) setShow(assignedShows[0]);
          // Explicitly load assigned shows by ID — needed if org-level RLS blocks the generic loadShows()
          if (assignedShows.length > 0) {
            try {
              const { data: showRows } = await supabase.from("shows").select("*").in("id", assignedShows);
              if (showRows?.length > 0) {
                const loaded = {};
                for (const row of showRows) { loaded[row.id] = { ...row.dna, id: row.id, fromDB: true }; }
                setShows(loaded);
                setLoadingShows(false);
              }
            } catch {}
          }
        } catch {}
      }
      // Load onboarding state
      if (myOrgId) {
        const { data: orgData } = await supabase.from("organizations")
          .select("onboarding_complete, account_type").eq("id", myOrgId).single();
        const complete = orgData?.onboarding_complete ?? true;
        setOnboardingComplete(complete);
        setAccountType(orgData?.account_type || "agency");
        if (!complete) setOnboardingStep("profile");
      }
    } catch {
      // If no profile yet, check by email
      const adminEmails = ["tamar@podcastimpactstudio.com", "tamarroutly@gmail.com"];
      setIsAdmin(adminEmails.includes(user.email?.toLowerCase()));
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAuthReady(false);
    setIsAdmin(false);
    setIsClient(false);
    setClientConfig(null);
    setUserProfile(null);
    setOrgId(null);
    setOrgName("");
    setShowProfile(false);
    setOnboardingComplete(true);
    setOnboardingStep(null);
    setAccountType("agency");
    reset();
  }

  async function markOnboardingComplete() {
    if (orgId) {
      await supabase.from("organizations")
        .update({ onboarding_complete: true })
        .eq("id", orgId);
    }
    setOnboardingComplete(true);
    setOnboardingStep(null);
  }

  async function uploadToGDrive(){
    // Read token from localStorage (set in Settings → Integrations → Google Drive)
    let token=null;
    try{
      const s=localStorage.getItem("pis_gdrive_connection");
      if(s){const p=JSON.parse(s);if(Date.now()<p.expires_at)token=p.access_token;else localStorage.removeItem("pis_gdrive_connection");}
    }catch{}
    if(!token){setGDriveStatus("disconnected");setTimeout(()=>setGDriveStatus(""),4000);return;}
    const filename=`${d?.name||"Content Package"}${ep?` — Ep ${ep}`:""}`;
    const html=buildHtml(raw,filename,d?.bp);
    setGDriveStatus("uploading");
    try{
      const meta={name:filename,mimeType:"application/vnd.google-apps.document"};
      const form=new FormData();
      form.append("metadata",new Blob([JSON.stringify(meta)],{type:"application/json"}));
      form.append("file",new Blob([html],{type:"text/html"}));
      const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",{
        method:"POST",headers:{Authorization:`Bearer ${token}`},body:form
      });
      const j=await r.json();
      if(!r.ok){
        if(r.status===401){localStorage.removeItem("pis_gdrive_connection");setGDriveStatus("disconnected");setTimeout(()=>setGDriveStatus(""),4000);return;}
        throw new Error(j.error?.message||"Upload failed");
      }
      setGDriveStatus("ok");
      setTimeout(()=>setGDriveStatus(""),3500);
      window.open(`https://docs.google.com/document/d/${j.id}/edit`,"_blank");
    }catch(e){
      console.error("Drive upload error:",e);
      setGDriveStatus("error");
      setTimeout(()=>setGDriveStatus(""),3500);
    }
  }

  function reset(){setStep("welcome");setMode(null);if(Object.keys(shows).length>1)setShow(null);setGuest(null);setEp("");setTx("");setRaw("");setSecs([]);setErr("");setEditing(false);setESec(null);setETxt("");setExtraPlatforms([]);setClipCount(3);setClipTexts(Array(10).fill(""));setClipResults([]);setClipPlatforms(["YouTube"]);setSelectedFormat(null);setEpGuest("");setEpGuestUrl("");setEpTopic("");setEpTakeaway("");setEpMoments("");setEpPanelists("");setEpPlanRequest("");}

  function goBack(){
    setErr("");
    if(step==="show-select"){setStep("welcome");setMode(null);}
    else if(step==="configure"){setStep(Object.keys(shows).length>1?"show-select":"welcome");}
    else if(step==="clips-setup"){setStep("configure");}
    else if(step==="input"){
      if(mode==="editor")setStep(Object.keys(shows).length>1?"show-select":"welcome");
      else if(mode==="clips")setStep("clips-setup");
      else setStep("configure");
    }
    else if(step==="result"){if(mode==="prep")setStep("prep-details");else setStep("input");}
    else if(step==="prep-format"){setStep(Object.keys(shows).length>1?"show-select":"welcome");}
    else if(step==="prep-details"){const hasFmts=d?.episodeFormats?.length>0;setStep(hasFmts?"prep-format":(Object.keys(shows).length>1?"show-select":"welcome"));}
  }

  const lbl={fontSize:"15px",letterSpacing:"2px",textTransform:"uppercase",color:T.textMuted,marginBottom:"10px",display:"block",fontFamily:"'DM Sans', system-ui, sans-serif"};
  const field={width:"100%",background:T.surface,border:`1px solid ${T.cardBorder}`,borderRadius:"8px",padding:"14px 18px",color:T.text,fontSize:"15px",fontFamily:"'DM Sans', system-ui, sans-serif",outline:"none",boxSizing:"border-box"};
  const primary=c=>({width:"100%",padding:"16px",background:c||T.coral,border:"none",borderRadius:"8px",color:"#fff",fontSize:"16px",fontWeight:"700",cursor:"pointer",letterSpacing:"2px",fontFamily:"'DM Sans', system-ui, sans-serif",textTransform:"uppercase",marginTop:"20px"});
  const ghost={padding:"9px 18px",background:"transparent",border:`1px solid ${T.cardBorder}`,borderRadius:"6px",color:T.textMuted,fontSize:"14px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1.5px",textTransform:"uppercase"};

  async function sendToDescript(clipSections) {
    let apiKey = descriptApiKey.trim();
    if (!descriptProjectId.trim()) {
      setDescriptStatus("Please enter your Descript Project ID.");
      return;
    }
    setDescriptSending(true);
    setDescriptStatus("Sending clip instructions to Descript...");
    try {
      // Build agent prompt from clip timestamps
      const clipLines = clipSections.split("\n").filter(l =>
        l.includes("TIMESTAMP:") || l.includes("CLIP #") || l.includes("DURATION:")
      ).join("\n");
      const agentPrompt = `Create highlights from these timestamps. For each clip, add a marker or comment at the start timestamp so the editor can find them easily:\n\n${clipLines}\n\nLabel each one as CLIP 1, CLIP 2, etc.`;

      // Call our Vercel proxy instead of Descript directly (avoids CORS)
      const r = await fetch("/api/descript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        projectId: descriptProjectId.trim().split("/").pop().split("?")[0],
        prompt: agentPrompt
      })
      });
      const j = await r.json();
      if (!r.ok) {
        setDescriptStatus("Descript error: " + (j.error || "Unknown error"));
      } else {
        setDescriptStatus("Sent! Job ID: " + (j.job_id || "submitted") + " — check Descript for the highlighted clips.");
      }
    } catch(e) {
      setDescriptStatus("Error: " + e.message);
    } finally {
      setDescriptSending(false);
    }
  }

  // Show auth screen if not logged in
  if(!authReady||!currentUser){
    return <Auth onAuthenticated={handleAuthenticated}/>;
  }

  // Show onboarding for new users who haven't added a show yet
  if(!onboardingComplete && onboardingStep){
    return(
      <div style={{minHeight:"100vh",width:"100%",background:T.bg,color:T.text}}>
        <style>{`*{box-sizing:border-box}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}button:hover{opacity:.85}`}</style>
        {showAdmin&&<AdminPanel shows={shows} orgId={orgId} accountType={accountType} userEmail={currentUser?.email} userName={userProfile?.name||(currentUser?.email?.split("@")[0]||"")} onSignOut={handleSignOut} onClose={()=>setShowAdmin(false)} onSaved={async()=>{await refreshShows();await markOnboardingComplete();setShowAdmin(false);}}/>}
        <OnboardingScreen
          step={onboardingStep}
          user={currentUser}
          orgId={orgId}
          orgName={orgName}
          userProfile={userProfile}
          onProfileDone={(newName, newCompany, newTz)=>{
            setOrgName(newCompany||orgName);
            setUserProfile(p=>({...p,name:newName,timezone:newTz}));
            setOnboardingStep("guide");
          }}
          onAddShow={()=>setShowAdmin(true)}
        />
      </div>
    );
  }

  // Advance to the first step of a mode for the given show
  function advanceToMode(newMode, showKey){
    setMode(newMode); setShow(showKey);
    setErr("");setRaw("");setSecs([]);setSelectedFormat(null);
    if(newMode==="prep"){
      const hasFmts=shows[showKey]?.episodeFormats?.length>0;
      setStep(hasFmts?"prep-format":"prep-details");
    } else if(newMode==="editor") setStep("input");
    else setStep("configure");
  }

  // Sidebar nav click handler
  function handleSidebarNav(newMode){
    if(Object.keys(shows).length===0&&isAdmin){setShowAdmin(true);return;}
    const showKeys=Object.keys(shows);
    if(show){
      // Already have a show — just switch mode
      advanceToMode(newMode, show);
    } else if(showKeys.length===1){
      // Single show — auto-select and go
      advanceToMode(newMode, showKeys[0]);
    } else {
      // Multiple shows — ask which one
      setMode(newMode);
      setStep("show-select");
    }
  }

  const displayName=userProfile?.name||(currentUser?.email?.split("@")[0]||"");
  const userInitial=(userProfile?.name||currentUser?.email||"?").charAt(0).toUpperCase();

  return(
    <div style={{minHeight:"100vh",width:"100%",background:T.bg,color:T.text,display:"flex",flexDirection:"row"}}>
      <style>{`*{box-sizing:border-box}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}textarea::placeholder,input::placeholder{color:${T.textMuted}}button:hover{opacity:.85}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#3A3A3A;border-radius:2px}a{transition:opacity .2s}a:hover{opacity:.7}.sidebar-nav-item:hover{background:#252525}.sidebar-show-select:focus{outline:2px solid #C41230;border-color:#C41230}@media(max-width:900px){.welcome-cards{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:560px){.welcome-cards{grid-template-columns:1fr!important}}`}</style>

      {showProfile&&currentUser&&<Profile user={currentUser} onClose={()=>setShowProfile(false)} onSignOut={handleSignOut}/>}
      {showAdmin&&<AdminPanel shows={shows} orgId={orgId} accountType={accountType} userEmail={currentUser?.email} userName={userProfile?.name||(currentUser?.email?.split("@")[0]||"")} onSignOut={handleSignOut} onClose={()=>setShowAdmin(false)} onSaved={async()=>{await refreshShows();if(!onboardingComplete)await markOnboardingComplete();}}/>}

      {/* BETA DISCLAIMER — shown once per user account */}
      {!betaAcknowledged&&<BetaDisclaimerModal onAcknowledge={()=>{const key="pis_beta_ack_"+(currentUser?.id||"anon");localStorage.setItem(key,"1");setBetaAcknowledged(true);setShowTour(true);}}/>}

      {/* ONBOARDING TOUR — shown after first beta acknowledgment */}
      {showTour&&<TourModal onDone={()=>setShowTour(false)}/>}

      {/* WHAT'S NEW */}
      {showWhatsNew&&<WhatsNewModal onClose={()=>setShowWhatsNew(false)}/>}

      {/* HELP & GUIDE */}
      {showHelpGuide&&<HelpGuideModal onClose={()=>setShowHelpGuide(false)}/>}


      {/* ── SIDEBAR ── */}
      <div style={{width:"240px",minWidth:"240px",height:"100vh",background:"#222222",display:"flex",flexDirection:"column",position:"sticky",top:0,flexShrink:0,borderRight:"1px solid #2E2E2E",overflowY:"auto"}}>

        {/* Logo */}
        <div style={{padding:"24px 20px 20px",display:"flex",alignItems:"center",justifyContent:"center",borderBottom:"1px solid #2E2E2E"}}>
          <img src="/logo-nav.png" alt="Podcast Impact Content Studio" style={{height:"120px",objectFit:"contain",width:"100%"}}/>
        </div>

        {/* Active show indicator — shown once a show is selected */}
        {show&&shows[show]&&(
          <div style={{padding:"12px 16px",borderBottom:"1px solid #2E2E2E"}}>
            <div style={{fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:"#6B6B6B",marginBottom:"4px",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600"}}>SHOW</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
              <div style={{fontSize:"13px",color:"#FFFFFF",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shows[show].name}</div>
              {!isClient&&Object.keys(shows).length>1&&<button onClick={()=>{setShow(null);setMode(null);setStep("welcome");}} style={{background:"none",border:"none",color:"#6B6B6B",fontSize:"11px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",flexShrink:0,padding:"2px 0"}} title="Change show">change</button>}
            </div>
          </div>
        )}

        {/* Admin Settings — visible to admins only */}
        {isAdmin&&(
          <div style={{padding:"10px 16px",borderBottom:"1px solid #2E2E2E"}}>
            <button onClick={()=>setShowAdmin(true)}
              className="sidebar-nav-item"
              style={{width:"100%",padding:"9px 14px",background:T.coral,border:"1px solid "+T.coral,borderRadius:"6px",color:"#FFFFFF",fontSize:"13px",fontWeight:"700",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans', system-ui, sans-serif",display:"flex",alignItems:"center",gap:"8px"}}>
              <span>⚙</span><span>Admin Settings</span>
            </button>
          </div>
        )}

        {/* Spacer */}
        <div style={{flex:1}}/>

        {/* Bottom: help links + settings + user */}
        <div style={{borderTop:"1px solid #2E2E2E",padding:"8px 0"}}>
          {/* View Schedule — clients only, when scheduleUrl is configured */}
          {isClient&&clientConfig?.scheduleUrl&&(
            <a href={clientConfig.scheduleUrl} target="_blank" rel="noopener noreferrer"
              className="sidebar-nav-item"
              style={{width:"100%",padding:"9px 16px",background:"transparent",border:"none",borderLeft:"3px solid transparent",color:"#52B788",fontSize:"13px",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block",textDecoration:"none",fontWeight:"600"}}>
              📅 View Schedule
            </a>
          )}
          {[
            {label:"Share Feedback", action:()=>{ window.location.href="mailto:info@podimpactstudio.com?subject=PIS Content Creator Feedback"; }},
            {label:"What's New", action:()=>setShowWhatsNew(true)},
            {label:"Help & Guide", action:()=>setShowHelpGuide(true)},
          ].map(item=>(
            <button key={item.label} onClick={item.action}
              className="sidebar-nav-item"
              style={{width:"100%",padding:"9px 16px",background:"transparent",border:"none",borderLeft:"3px solid transparent",color:"#8A8A8A",fontSize:"13px",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block"}}>
              {item.label}
            </button>
          ))}
        </div>
        <div style={{height:"1px",background:"#2E2E2E",margin:"0 16px"}}/>
        <div style={{padding:"8px 0 4px"}}>
          <button
            className="sidebar-nav-item"
            onClick={()=>isAdmin?setShowAdmin(true):setShowProfile(true)}
            style={{width:"100%",padding:"9px 16px",background:"transparent",border:"none",borderLeft:"3px solid transparent",color:"#FFFFFF",fontSize:"13px",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block"}}>
            Settings
          </button>
          <div style={{padding:"8px 16px 0"}}>
            <div ref={userMenuRef} style={{position:"relative"}}>
              <button
                onClick={()=>setShowUserMenu(v=>!v)}
                style={{width:"100%",padding:"8px 0",background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"10px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
                <div style={{width:"30px",height:"30px",borderRadius:"50%",background:T.coral,color:"#fff",fontSize:"13px",fontWeight:"700",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{userInitial}</div>
                <div style={{flex:1,overflow:"hidden",textAlign:"left"}}>
                  <div style={{fontSize:"13px",color:"#FFFFFF",fontWeight:"500",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{displayName||currentUser?.email}</div>
                </div>
                <div style={{fontSize:"14px",color:"#6B6B6B",flexShrink:0}}>→</div>
              </button>
              {showUserMenu&&(
                <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,width:"200px",background:"#252525",border:"1px solid #3A3A3A",borderRadius:"10px",boxShadow:"0 8px 32px rgba(0,0,0,.6)",zIndex:999,overflow:"hidden",animation:"fadeUp .15s ease"}}>
                  <div style={{padding:"10px 14px",borderBottom:"1px solid #3A3A3A"}}>
                    <div style={{fontSize:"12px",color:"#6B6B6B",fontFamily:"'DM Sans', system-ui, sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser?.email}</div>
                  </div>
                  <div style={{padding:"4px 0"}}>
                    {[
                      {label:"My Profile",action:()=>{setShowProfile(true);setShowUserMenu(false);}},
                      ...(isAdmin?[{label:"Admin Settings",action:()=>{setShowAdmin(true);setShowUserMenu(false);}}]:[]),
                    ].map(item=>(
                      <button key={item.label} onClick={item.action}
                        style={{width:"100%",padding:"9px 14px",background:"transparent",border:"none",color:"#FFFFFF",fontSize:"13px",fontFamily:"'DM Sans', system-ui, sans-serif",cursor:"pointer",textAlign:"left",transition:"background .1s"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#3A3A3A"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        {item.label}
                      </button>
                    ))}
                    <div style={{height:"1px",background:"#3A3A3A",margin:"4px 0"}}/>
                    <button onClick={()=>{handleSignOut();setShowUserMenu(false);}}
                      style={{width:"100%",padding:"9px 14px",background:"transparent",border:"none",color:"#F09090",fontSize:"13px",fontFamily:"'DM Sans', system-ui, sans-serif",cursor:"pointer",textAlign:"left",transition:"background .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#3A3A3A"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>

        {/* Top bar — 48px, breadcrumb + back/start over */}
        <div style={{height:"48px",background:T.surface,borderBottom:`1px solid ${T.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",flexShrink:0}}>
          <div style={{fontSize:"12px",color:T.textMuted,fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1.5px",textTransform:"uppercase"}}>
            {step==="show-select"&&<span>Select Show</span>}
            {step==="configure"&&<span>Configure</span>}
            {step==="clips-setup"&&<span>Clips Setup</span>}
            {step==="input"&&<span>Transcript</span>}
            {step==="generating"&&<span>Generating</span>}
            {step==="result"&&<span>Results</span>}
            {step==="prep-format"&&<span>Select Format</span>}
            {step==="prep-details"&&<span>Episode Details</span>}
          </div>
          {/* Progress + nav buttons */}
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {step!=="welcome"&&step!=="generating"&&(
              <>
                {ci>0&&<div style={{display:"flex",gap:"3px",alignItems:"center"}}>
                  {[0,1,2].map(i=><div key={i} style={{width:i<ci?"20px":"6px",height:"4px",borderRadius:"2px",background:i<ci?T.coral:T.cardBorder,transition:"all .3s"}}/>)}
                </div>}
                <button onClick={goBack} style={ghost}>Back</button>
                <button onClick={reset} style={{...ghost,opacity:.5,fontSize:"12px",padding:"6px 12px"}}>Start Over</button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",padding:"40px 48px"}}>
          <div style={{maxWidth:"900px",margin:"0 auto",width:"100%"}}>

            {/* WELCOME SCREEN */}
            {step==="welcome"&&<div style={{animation:"fadeUp .4s ease",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh",padding:"40px 24px",textAlign:"center"}}>
              <div style={{marginBottom:"48px"}}>
                <h1 style={{fontSize:"42px",fontWeight:"700",color:T.text,margin:"0 0 10px",letterSpacing:"-1px",fontFamily:PF,lineHeight:"1.15"}}>
                  Welcome back{displayName?`, ${displayName.split(" ")[0]}`:""}.</h1>
                <p style={{fontSize:"17px",color:T.textMuted,margin:0,fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"400"}}>What are you creating today?</p>
              </div>
              {loadingShows&&!(isClient&&clientConfig?.assignedShows?.length>0)?(
                <div style={{textAlign:"center",padding:"60px",color:T.textMuted,fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"2px",fontSize:"12px"}}>LOADING SHOWS...</div>
              ):Object.keys(shows).length===0&&!(isClient&&clientConfig?.assignedShows?.length>0)?(
                isAdmin?(
                  showFirstShowWizard?(
                    <FirstShowWizard
                      onOpenAdmin={()=>{setShowFirstShowWizard(false);setShowAdmin(true);}}
                      onSkip={()=>{setShowFirstShowWizard(false);setShowAdmin(true);}}
                    />
                  ):(
                    <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:"16px",padding:"56px 48px",textAlign:"center",animation:"fadeUp .4s ease",maxWidth:"580px",margin:"0 auto"}}>
                      <h2 style={{fontSize:"28px",fontWeight:"700",color:T.text,margin:"0 0 12px",fontFamily:PF}}>Set up your first show</h2>
                      <p style={{fontSize:"15px",color:T.textMuted,margin:"0 0 32px",lineHeight:"1.7"}}>Add your show's DNA — the voice, audience, and platforms that make your content sound uniquely yours.</p>
                      <button onClick={()=>setShowFirstShowWizard(true)} style={{...primary(T.coral),width:"auto",padding:"16px 40px",fontSize:"15px",letterSpacing:"1.5px"}}>Get Started</button>
                      <div style={{marginTop:"16px"}}><button onClick={()=>setShowAdmin(true)} style={{background:"none",border:"none",color:T.textMuted,fontSize:"13px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",textDecoration:"underline"}}>Skip to admin panel</button></div>
                    </div>
                  )
                ):(
                  <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:"12px",padding:"48px",textAlign:"center"}}>
                    <p style={{fontSize:"16px",color:T.textMuted}}>Your admin hasn't added any shows yet. Check back soon!</p>
                  </div>
                )
              ):(()=>{
                const ALL_CARDS=[
                  {id:"full",  category:"CREATE",    name:"Content Package",     desc:"Turn any transcript into show notes, social posts, email newsletter, and blog — all written in your show's voice.",           headerBg:"linear-gradient(150deg,#7A0019 0%,#4A0010 100%)", accent:"#7A0019", icon:"📦"},
                  {id:"clips", category:"CREATE",    name:"Short-Form Content",  desc:"Generate SEO titles, captions, and hashtags for YouTube Shorts, Instagram Reels, TikTok, and more.",                          headerBg:"linear-gradient(150deg,#5C1F00 0%,#2E0F00 100%)", accent:"#8B4513", icon:"✂️"},
                  {id:"editor",category:"EDITORIAL", name:"Editor Companion",    desc:"A structured editing brief with hook recommendations, best clip moments, timestamps, and pacing guidance for your editor.",     headerBg:"linear-gradient(150deg,#1C2B3A 0%,#0A1520 100%)", accent:"#3A7BD5", icon:"🎬"},
                  {id:"prep",  category:"PLANNING",  name:"Episode Prep",        desc:"Build a complete episode outline — scripted hook, bridge, interview questions, and permission slip — before you hit record.",  headerBg:"linear-gradient(150deg,#1A1A3E 0%,#0A0A20 100%)", accent:"#6B6BAF", icon:"📋"},
                ];
                const visibleCards = isClient && clientConfig?.allowedModes?.length > 0
                  ? ALL_CARDS.filter(c => clientConfig.allowedModes.includes(c.id))
                  : ALL_CARDS;
                const colCount = visibleCards.length <= 2 ? visibleCards.length : 2;
                return(
                <div className="welcome-cards" style={{display:"grid",gridTemplateColumns:`repeat(${colCount},1fr)`,gap:"20px",width:"100%",maxWidth:"860px"}}>
                  {visibleCards.map(card=>(
                    <div key={card.id}
                      onClick={()=>handleSidebarNav(card.id)}
                      style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:"16px",cursor:"pointer",transition:"all .22s ease",overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,.06)",textAlign:"left"}}
                      onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 12px 36px rgba(0,0,0,.14)`;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.borderColor=card.accent;}}
                      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,.06)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=T.cardBorder;}}>
                      {/* Coloured header band */}
                      <div style={{height:"120px",background:card.headerBg,display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:"18px 24px",position:"relative"}}>
                        <div style={{position:"absolute",top:"18px",right:"20px",fontSize:"28px",opacity:0.35}}>{card.icon}</div>
                        <div style={{fontSize:"10px",letterSpacing:"2.5px",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",fontFamily:"'DM Sans',system-ui,sans-serif",fontWeight:"700",marginBottom:"6px"}}>{card.category}</div>
                        <div style={{fontSize:"20px",fontWeight:"700",color:"#FFFFFF",fontFamily:PF,lineHeight:"1.2",letterSpacing:"-0.3px"}}>{card.name}</div>
                      </div>
                      {/* Card body */}
                      <div style={{padding:"20px 24px 24px",display:"flex",flexDirection:"column",gap:"16px"}}>
                        <p style={{margin:0,fontSize:"14px",color:T.textSecondary,lineHeight:"1.7",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{card.desc}</p>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{fontSize:"11px",color:card.accent,fontWeight:"700",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1.5px",textTransform:"uppercase"}}>Get Started</span>
                          <div style={{width:"32px",height:"32px",borderRadius:"50%",background:`${card.accent}15`,border:`1px solid ${card.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",color:card.accent,fontSize:"14px",fontWeight:"700"}}>→</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()}
            </div>}

            {/* SHOW SELECT — shown after clicking a card when multiple shows exist */}
            {step==="show-select"&&<div style={{animation:"fadeUp .35s ease"}}>
              <div style={{marginBottom:"36px"}}>
                <div style={{fontSize:"13px",color:T.coral,fontWeight:"700",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",marginBottom:"10px"}}>{MODES.find(m=>m.id===mode)?.label||mode}</div>
                <h1 style={{fontSize:"40px",fontWeight:"700",color:T.text,margin:"0 0 8px",letterSpacing:"-0.5px",fontFamily:PF,lineHeight:"1.2"}}>Which show is this for?</h1>
                <p style={{fontSize:"16px",color:T.textMuted,margin:0,fontFamily:"'DM Sans', system-ui, sans-serif"}}>Select the podcast you're creating content for.</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {Object.entries(isClient&&clientConfig?.assignedShows?.length>0?Object.fromEntries(Object.entries(shows).filter(([k])=>clientConfig.assignedShows.includes(k))):shows).sort(([,a],[,b])=>a.name.localeCompare(b.name)).map(([k,s])=>(
                  <button key={k} onClick={()=>advanceToMode(mode,k)}
                    style={{width:"100%",padding:"18px 24px",background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:"12px",cursor:"pointer",textAlign:"left",transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px"}}
                    onMouseEnter={e=>{e.currentTarget.style.border=`2px solid ${T.coral}`;e.currentTarget.style.boxShadow=`0 4px 16px rgba(122,0,25,.1)`;}}
                    onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${T.cardBorder}`;e.currentTarget.style.boxShadow="none";}}>
                    <div>
                      <div style={{fontSize:"17px",fontWeight:"700",color:T.text,fontFamily:PF,marginBottom:"3px"}}>{s.name}</div>
                      {s.tag&&<div style={{fontSize:"13px",color:T.textMuted,fontFamily:"'DM Sans', system-ui, sans-serif",fontStyle:"italic"}}>{s.tag}</div>}
                    </div>
                    <div style={{fontSize:"18px",color:T.coral,flexShrink:0}}>→</div>
                  </button>
                ))}
              </div>
            </div>}

            {/* CONFIGURE */}
            {step==="configure"&&d&&<div style={{animation:"fadeUp .4s ease"}}>
              <div style={{marginBottom:"40px"}}>
                <p style={{fontSize:"14px",color:T.coral,margin:"0 0 10px",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600"}}>{MODES.find(m=>m.id===mode)?.label}</p>
                <h1 style={{fontSize:"52px",fontWeight:"700",color:T.text,margin:"0 0 8px",letterSpacing:"-1px",fontFamily:PF,lineHeight:"1.1"}}>{d.name}</h1>
                <p style={{fontSize:"15px",color:T.textMuted,margin:0,fontFamily:"'DM Sans', system-ui, sans-serif"}}>Tell us a bit about this episode so we can tailor the content.</p>
              </div>
              {mode!=="clips"&&<div style={{marginBottom:"20px"}}>
                {d?.publishDay&&d?.publishTime&&d?.publishTz&&(()=>{try{const sched=formatPublishSchedule(d,userProfile?.timezone);if(!sched)return null;return(<div style={{background:T.coralSoft,border:"1px solid "+T.coralMid,borderRadius:"8px",padding:"12px 16px",marginBottom:"20px",display:"flex",alignItems:"center",gap:"10px"}}><span>📅</span><div><div style={{fontSize:"13px",color:T.coral,fontWeight:"600"}}>PUBLISH SCHEDULE</div><div style={{fontSize:"14px",color:T.textSecondary,marginTop:"2px"}}>{sched.showTime}{sched.isDifferent?" · "+sched.localTime+" your time":""}</div></div></div>);}catch{return null;}})()}
                <label style={lbl}>Episode Number</label>
                <input style={field} placeholder="e.g. 42 (optional)" value={ep} onChange={e=>setEp(e.target.value)}/>
              </div>}
              {mode!=="clips"&&<div style={{marginBottom:"20px"}}>
                <label style={lbl}>Episode Type</label>
                <div style={{display:"flex",gap:"10px"}}>
                  {[true,false].map(v=>(
                    <button key={String(v)} onClick={()=>setGuest(v)} style={{flex:1,padding:"14px",background:guest===v?`${d.clr}18`:T.card,border:guest===v?`1px solid ${d.clr}`:`1px solid ${T.cardBorder}`,borderRadius:"8px",color:guest===v?T.text:T.textSecondary,fontSize:"14px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:guest===v?"700":"400",letterSpacing:"1px",transition:"all .15s"}}>
                      {v?"GUEST EPISODE":"SOLO / HOST ONLY"}
                    </button>
                  ))}
                </div>
              </div>}
              {mode==="clips"?(
                <div style={{marginBottom:"20px"}}>
                  <label style={lbl}>Platforms for Clips</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
                    {["YouTube","Instagram","Facebook","TikTok","Spotify"].map(p=>{const on=clipPlatforms.includes(p);return(
                      <button key={p} onClick={()=>setClipPlatforms(prev=>on&&prev.length>1?prev.filter(x=>x!==p):on?prev:[...prev,p])} style={{padding:"8px 18px",background:on?`${d.clr}18`:T.card,border:on?`1px solid ${d.clr}`:`1px solid ${T.cardBorder}`,borderRadius:"6px",fontSize:"13px",color:on?d.clr:T.textMuted,fontFamily:"'DM Sans', system-ui, sans-serif",cursor:"pointer",fontWeight:on?"700":"400",transition:"all .15s",letterSpacing:"1px"}}>
                        {on?"✓ ":""}{p.toUpperCase()}
                      </button>
                    );})}
                  </div>
                </div>
              ):(
                <div style={{marginBottom:"20px"}}>
                  <label style={lbl}>Platforms</label>
                  <div style={{fontSize:"14px",color:T.textSecondary,fontFamily:"'EB Garamond',serif",fontStyle:"italic",marginBottom:"8px"}}>Configured in Admin — generating content for all selected platforms</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
                    {[...(d.platforms?.social||[]),...(d.platforms?.podcast||[]),...(d.platforms?.community||[]),...(d.platforms?.email||[]),...(d.platforms?.blog||[]),...(d.platforms?.extras||[])].map(p=>(
                      <span key={p} style={{padding:"6px 14px",background:`${d.clr}18`,border:`1px solid ${d.clr}44`,borderRadius:"6px",fontSize:"12px",color:d.clr,fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600",letterSpacing:"1px"}}>✓ {p.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              )}
              {(mode==="clips"||guest!==null)&&<button onClick={()=>setStep(mode==="clips"?"clips-setup":"input")} style={primary(T.red)}>Continue →</button>}
            </div>}

            {/* CLIPS SETUP */}
            {step==="clips-setup"&&d&&<div style={{animation:"fadeUp .4s ease"}}>
              <div style={{marginBottom:"40px"}}>
                <p style={{fontSize:"14px",color:T.coral,margin:"0 0 10px",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600"}}>{d.name} · {clipPlatforms.join(", ")}</p>
                <h1 style={{fontSize:"52px",fontWeight:"700",color:T.text,margin:"0 0 8px",letterSpacing:"-1px",fontFamily:PF,lineHeight:"1.1"}}>How many clips?</h1>
                <p style={{fontSize:"15px",color:T.textMuted,margin:0,fontFamily:"'DM Sans', system-ui, sans-serif"}}>Each clip gets its own SEO-optimized title, caption, hashtags and platform copy.</p>
              </div>
              <label style={lbl}>Number of Clips</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"32px"}}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                  <button key={n} onClick={()=>setClipCount(n)} style={{width:"58px",height:"58px",background:clipCount===n?`${d.clr}18`:T.card,border:clipCount===n?`1px solid ${d.clr}`:`1px solid ${T.cardBorder}`,borderRadius:"8px",color:clipCount===n?d.clr:T.textMuted,fontSize:"18px",fontWeight:clipCount===n?"700":"400",cursor:"pointer",transition:"all .15s"}}>{n}</button>
                ))}
              </div>
              <button onClick={()=>setStep("input")} style={primary(T.red)}>Set Up {clipCount} Clip{clipCount>1?"s":""} →</button>
            </div>}

            {/* INPUT */}
            {step==="input"&&d&&<div style={{animation:"fadeUp .4s ease"}}>
              {mode==="clips"?(
                <>
                  <div style={{marginBottom:"32px"}}>
                    <p style={{fontSize:"14px",color:T.coral,margin:"0 0 10px",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600"}}>{d.name} · {clipPlatforms.join(", ")}</p>
                    <h1 style={{fontSize:"52px",fontWeight:"700",color:T.text,margin:"0 0 10px",letterSpacing:"-1px",fontFamily:PF,lineHeight:"1.1"}}>Paste your clip transcripts</h1>
                    <p style={{fontSize:"15px",color:T.textMuted,margin:0,fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"1.6"}}>Paste the transcript for each clip below. The AI will write SEO-optimized titles, captions and hashtags tailored for each platform.</p>
                  </div>
                  {err&&<div style={{background:"#D94F4F18",border:"1px solid #D94F4F44",borderRadius:"8px",padding:"12px 16px",color:"#F09090",fontSize:"14px",marginBottom:"16px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{err}</div>}
                  {Array.from({length:clipCount},(_,i)=>(
                    <div key={i} style={{marginBottom:"16px"}}>
                      <label style={{...lbl,color:d.clr}}>Clip {i+1}</label>
                      <textarea style={{...field,minHeight:"120px",lineHeight:"1.6",resize:"vertical",borderColor:clipTexts[i].trim()?`${d.clr}55`:T.cardBorder}} placeholder={`Paste transcript for Clip ${i+1}...`} value={clipTexts[i]} onChange={e=>{const next=[...clipTexts];next[i]=e.target.value;setClipTexts(next);}}/>
                      {clipTexts[i].trim()&&<div style={{fontSize:"11px",color:T.textMuted,marginTop:"4px",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px"}}>{clipTexts[i].trim().split(/\s+/).length} WORDS</div>}
                    </div>
                  ))}
                  <button onClick={genClips} disabled={clipTexts.slice(0,clipCount).every(t=>!t.trim())} style={{...primary(T.red),opacity:clipTexts.slice(0,clipCount).some(t=>t.trim())?1:.35}}>Generate {clipCount} Clip{clipCount>1?"s":""} →</button>
                </>
              ):(
                <>
                  <div style={{marginBottom:"32px"}}>
                    <p style={{fontSize:"14px",color:T.coral,margin:"0 0 10px",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600"}}>{d.name}{mode!=="clips"?` · ${guest?"Guest Episode":"Solo Episode"}`:""}{ ep?` · Ep ${ep}`:""}</p>
                    <h1 style={{fontSize:"52px",fontWeight:"700",color:T.text,margin:"0 0 10px",letterSpacing:"-1px",fontFamily:PF,lineHeight:"1.1"}}>{mode==="editor"?"Paste the transcript":"Add your transcript"}</h1>
                    <p style={{fontSize:"15px",color:T.textMuted,margin:0,fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"1.6"}}>{mode==="editor"?"Paste your raw transcript below — include timestamps if available. The AI will coach your editor through this episode at the level set for this show, flag what to cut, and surface the best clip moments.":mode==="clips"?"Paste your transcript below. The AI will extract the best short-form moments and write SEO-optimized copy for each clip across your selected platforms.":"Paste your full episode transcript below and the AI will generate your complete content package — show notes, social captions, newsletter, YouTube description and more."}</p>
                  </div>
                  {err&&<div style={{background:"#D94F4F18",border:"1px solid #D94F4F44",borderRadius:"8px",padding:"12px 16px",color:"#F09090",fontSize:"14px",marginBottom:"16px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{err}</div>}
                  {mode==="editor"&&(()=>{const editLevels={"1":{name:"Level 1 — Clean & Clear",desc:"Remove long awkward silences unless emotional or intentional. Cut mic bumps, false starts, hard stops, technical interruptions. Leave ums and filler words unless disruptive. Do not over-edit — the episode should sound like a real conversation, just cleaned up."},"2":{name:"Level 2 — Crafted",desc:"Everything in Level 1, plus: surface the strongest hook moment and restructure the opening if needed. Remove repetitive points, rambling tangents, and run-on sections. Tighten pacing. Add lower thirds at key moments. The episode should sound intentional without sounding produced."},"3":{name:"Level 3 — Story-Driven",desc:"Everything in Levels 1 and 2, plus: treat the recording as source material — reconstruct the arc, edit down aggressively, add b-roll and visuals to reinforce meaning. The episode should feel like a documentary, not a recording."}};const lvl=editLevels[d?.editingLevel||"1"];return(<div style={{background:T.coral+"12",border:"1px solid "+T.coral+"40",borderRadius:"12px",padding:"20px 24px",marginBottom:"24px"}}><div style={{fontSize:"11px",fontWeight:"700",color:T.coral,letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",marginBottom:"8px"}}>Editor Companion — Coaching Brief</div><div style={{fontSize:"16px",fontWeight:"700",color:T.text,fontFamily:"'DM Sans', system-ui, sans-serif",marginBottom:"8px"}}>{lvl.name}</div><div style={{fontSize:"13px",color:T.textSecondary,lineHeight:"1.7",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{lvl.desc}</div></div>);})()}
                  {mode==="editor"&&<div style={{marginBottom:"24px"}}>
                    <label style={lbl}>How many clip suggestions?</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
                      {[3,4,5,6,7,8,9,10].map(n=>(
                        <button key={n} onClick={()=>setEditorClipCount(n)}
                          style={{padding:"10px 20px",background:editorClipCount===n?T.coral:T.card,border:"1px solid "+(editorClipCount===n?T.coral:T.cardBorder),borderRadius:"6px",color:editorClipCount===n?"#fff":T.textSecondary,fontSize:"15px",fontWeight:editorClipCount===n?"700":"400",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px",transition:"all .15s"}}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>}
                  <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop} style={{border:`1px dashed ${dragging?T.coral:T.cardBorder}`,borderRadius:"8px",padding:"32px",textAlign:"center",marginBottom:"16px",background:dragging?T.coralSoft:T.card,transition:"all .2s",cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
                    <input ref={fileRef} type="file" accept=".txt,.md" style={{display:"none"}} onChange={handleFileInput}/>
                    <div style={{fontSize:"24px",marginBottom:"8px"}}>{dragging?"📥":"📄"}</div>
                    <div style={{fontSize:"14px",color:T.textSecondary,marginBottom:"4px"}}>Drag & drop a transcript file</div>
                    <div style={{fontSize:"12px",color:T.textMuted,fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px"}}>OR CLICK TO BROWSE · .TXT FILES</div>
                  </div>
                  <div style={{textAlign:"center",fontSize:"12px",color:T.textMuted,marginBottom:"16px",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px"}}>— OR PASTE BELOW —</div>
                  <textarea style={{...field,minHeight:"220px",lineHeight:"1.7",resize:"vertical"}} placeholder={mode==="editor"?"Paste your raw transcript here — timestamps from Descript or Rev work best. The AI will review this episode as an editor coach, flag what to cut, and surface the best clip moments for your editing level…":"Paste your full episode transcript here. The AI will read it in full and generate every piece of content in one go — no extra prompting needed…"} value={tx} onChange={e=>setTx(e.target.value)}/>
                  {tx.length>0&&<div style={{fontSize:"15px",color:T.textMuted,marginTop:"6px",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px"}}>{Math.round(tx.split(/\s+/).length).toLocaleString()} WORDS</div>}
                  <button onClick={gen} disabled={!tx.trim()} style={{...primary(T.red),opacity:tx.trim()?1:.35}}>Generate {MODES.find(m=>m.id===mode)?.label} →</button>
                </>
              )}
            </div>}

            {/* GENERATING */}
            {step==="generating"&&<div style={{textAlign:"center",padding:"100px 20px",animation:"fadeUp .4s ease"}}>
              <div style={{width:"40px",height:"40px",border:`2px solid ${T.cardBorder}`,borderTopColor:T.coral,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 28px"}}/>
              <h2 style={{fontSize:"38px",fontWeight:"600",color:T.text,marginBottom:"12px",fontFamily:PF,lineHeight:"1.2"}}>{mode==="editor"?"Preparing your editor companion brief…":mode==="clips"?"Writing your short-form copy…":mode==="prep"?"Building your episode prep package…":"Building your content package…"}</h2>
              <p style={{fontSize:"16px",color:T.textMuted,margin:"0 0 8px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{d?.name} · {MODES.find(m=>m.id===mode)?.label}</p>
              <p style={{fontSize:"13px",color:T.coral,animation:"pulse 2s ease-in-out infinite",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px"}}>THIS TAKES ABOUT 30 SECONDS</p>
            </div>}

            {step==="prep-format"&&d&&<div style={{animation:"fadeUp .4s ease"}}>
              <p style={{fontSize:"14px",color:T.coral,margin:"0 0 8px",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600"}}>{d.name}</p>
              <h2 style={{fontSize:"36px",fontWeight:"700",color:T.text,margin:"0 0 8px",letterSpacing:"-0.5px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>How would you like to plan?</h2>
              <p style={{fontSize:"15px",color:T.textMuted,margin:"0 0 32px",fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"1.6"}}>Pick one of this show's saved formats, or choose Custom to describe your own — a one-off episode, a reaction, or a whole series.</p>
              {(!d.episodeFormats || d.episodeFormats.length === 0) ? (
                <div style={{background:T.card,border:"1px solid "+T.cardBorder,borderRadius:"12px",padding:"40px",textAlign:"center"}}>
                  <div style={{fontSize:"32px",marginBottom:"12px"}}>📋</div>
                  <div style={{fontSize:"16px",fontWeight:"600",color:T.text,marginBottom:"8px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>No formats set up yet</div>
                  <div style={{fontSize:"14px",color:T.textMuted,fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"1.6",marginBottom:"20px"}}>Go to Settings → Episode Formats to add your first format, or continue without one and the AI will do its best with your Show DNA.</div>
                  <button onClick={()=>{setSelectedFormat(null);setStep("prep-details");}} style={{padding:"12px 24px",background:T.coral,border:"none",borderRadius:"8px",color:"#fff",fontSize:"14px",fontWeight:"700",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif"}}>✨ Custom planning — continue →</button>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                  {d.episodeFormats.map((fmt,i)=>(
                    <div key={fmt.id||i} onClick={()=>{setSelectedFormat(fmt);setStep("prep-details");}} style={{background:T.card,border:"1px solid "+T.cardBorder,borderRadius:"12px",padding:"20px 24px",cursor:"pointer",transition:"all .15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontSize:"16px",fontWeight:"700",color:T.text,marginBottom:"4px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{fmt.name}</div>
                          <div style={{fontSize:"13px",color:T.textMuted,fontFamily:"'DM Sans', system-ui, sans-serif"}}>{fmt.type}{fmt.targetLength?" · "+fmt.targetLength:""}</div>
                        </div>
                        <div style={{fontSize:"20px"}}>→</div>
                      </div>
                    </div>
                  ))}
                  <button onClick={()=>{setSelectedFormat(null);setStep("prep-details");}} style={{padding:"16px",background:T.coralSoft,border:"1px solid "+T.coralMid,borderRadius:"10px",color:T.coral,fontSize:"14px",fontWeight:"700",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",textAlign:"left"}}>✨ Custom — I'll describe what I want to plan →</button>
                </div>
              )}
            </div>}
            {step==="prep-details"&&d&&<div style={{animation:"fadeUp .4s ease"}}>
              <p style={{fontSize:"14px",color:T.coral,margin:"0 0 8px",letterSpacing:"2px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"600"}}>{d.name}{selectedFormat?" · "+selectedFormat.name:""}</p>
              <h2 style={{fontSize:"36px",fontWeight:"700",color:T.text,margin:"0 0 8px",letterSpacing:"-0.5px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>What would you like to plan?</h2>
              <p style={{fontSize:"15px",color:T.textMuted,margin:"0 0 32px",fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"1.6"}}>{selectedFormat?`Planning in your ${selectedFormat.name} format. `:"Custom planning — describe it in your own words below. "}The more detail you provide, the more tailored your plan will be.</p>
              <div style={{display:"flex",flexDirection:"column",gap:"20px",marginBottom:"32px"}}>
                <div>
                  <label style={{fontSize:"12px",fontWeight:"700",color:T.textMuted,letterSpacing:"1px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block",marginBottom:"8px"}}>Topic / Title / Content Being Covered *</label>
                  <input value={epTopic} onChange={e=>setEpTopic(e.target.value)} placeholder="e.g. 'The Body Keeps the Score' or 'Managing anxiety at work'" style={{width:"100%",padding:"12px 16px",border:"1px solid "+T.cardBorder,borderRadius:"8px",background:T.card,color:T.text,fontSize:"15px",fontFamily:"'DM Sans', system-ui, sans-serif",boxSizing:"border-box"}} />
                </div>
                {(!selectedFormat || selectedFormat.type==="Guest Interview" || selectedFormat.type==="Review & Reaction Panel") && <div>
                  <label style={{fontSize:"12px",fontWeight:"700",color:T.textMuted,letterSpacing:"1px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block",marginBottom:"8px"}}>Guest Name <span style={{fontWeight:"400",textTransform:"none"}}>(optional)</span></label>
                  <input value={epGuest} onChange={e=>setEpGuest(e.target.value)} placeholder="Full name" style={{width:"100%",padding:"12px 16px",border:"1px solid "+T.cardBorder,borderRadius:"8px",background:T.card,color:T.text,fontSize:"15px",fontFamily:"'DM Sans', system-ui, sans-serif",boxSizing:"border-box"}} />
                </div>}
                {(!selectedFormat || selectedFormat.type==="Guest Interview" || selectedFormat.type==="Review & Reaction Panel") && <div>
                  <label style={{fontSize:"12px",fontWeight:"700",color:T.textMuted,letterSpacing:"1px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block",marginBottom:"8px"}}>Guest URL or Social Handle <span style={{fontWeight:"400",textTransform:"none"}}>(optional — helps with accuracy)</span></label>
                  <input value={epGuestUrl} onChange={e=>setEpGuestUrl(e.target.value)} placeholder="https://guestwebsite.com or @handle" style={{width:"100%",padding:"12px 16px",border:"1px solid "+T.cardBorder,borderRadius:"8px",background:T.card,color:T.text,fontSize:"15px",fontFamily:"'DM Sans', system-ui, sans-serif",boxSizing:"border-box"}} />
                </div>}
                <div style={{background:T.coralSoft,border:"1px solid "+T.coralMid,borderRadius:"10px",padding:"16px 18px"}}>
                  <label style={{fontSize:"12px",fontWeight:"700",color:T.coral,letterSpacing:"1px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block",marginBottom:"4px"}}>✨ What would you like to plan together?</label>
                  <p style={{fontSize:"13px",color:T.textMuted,margin:"0 0 10px",fontFamily:"'DM Sans', system-ui, sans-serif",lineHeight:"1.5"}}>Plan this single episode, ask for topic ideas, or describe something bigger — e.g. "Plan a 5-part series on ADHD" or "I want to react to this article and tie it to our show."</p>
                  <textarea value={epPlanRequest} onChange={e=>setEpPlanRequest(e.target.value)} placeholder='Leave blank to plan a standard episode, or tell the AI exactly what you want to build…' rows={3} style={{width:"100%",padding:"12px 16px",border:"1px solid "+T.cardBorder,borderRadius:"8px",background:T.card,color:T.text,fontSize:"15px",fontFamily:"'DM Sans', system-ui, sans-serif",resize:"vertical",boxSizing:"border-box"}} />
                </div>
                <div>
                  <label style={{fontSize:"12px",fontWeight:"700",color:T.textMuted,letterSpacing:"1px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block",marginBottom:"8px"}}>The ONE Takeaway <span style={{fontWeight:"400",textTransform:"none"}}>(optional)</span></label>
                  <input value={epTakeaway} onChange={e=>setEpTakeaway(e.target.value)} placeholder="What should the ONE person walk away with? (one sentence)" style={{width:"100%",padding:"12px 16px",border:"1px solid "+T.cardBorder,borderRadius:"8px",background:T.card,color:T.text,fontSize:"15px",fontFamily:"'DM Sans', system-ui, sans-serif",boxSizing:"border-box"}} />
                </div>
                <div>
                  <label style={{fontSize:"12px",fontWeight:"700",color:T.textMuted,letterSpacing:"1px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block",marginBottom:"8px"}}>Specific Moments, Quotes, or Angles You Want to Include <span style={{fontWeight:"400",textTransform:"none"}}>(optional)</span></label>
                  <textarea value={epMoments} onChange={e=>setEpMoments(e.target.value)} placeholder="Any moments, quotes, or angles you already know you want to hit..." rows={4} style={{width:"100%",padding:"12px 16px",border:"1px solid "+T.cardBorder,borderRadius:"8px",background:T.card,color:T.text,fontSize:"15px",fontFamily:"'DM Sans', system-ui, sans-serif",resize:"vertical",boxSizing:"border-box"}} />
                </div>
                {selectedFormat?.type==="Review & Reaction Panel" && <div>
                  <label style={{fontSize:"12px",fontWeight:"700",color:T.textMuted,letterSpacing:"1px",textTransform:"uppercase",fontFamily:"'DM Sans', system-ui, sans-serif",display:"block",marginBottom:"8px"}}>Additional Panelists or Contributors <span style={{fontWeight:"400",textTransform:"none"}}>(optional)</span></label>
                  <input value={epPanelists} onChange={e=>setEpPanelists(e.target.value)} placeholder="Names of other panelists" style={{width:"100%",padding:"12px 16px",border:"1px solid "+T.cardBorder,borderRadius:"8px",background:T.card,color:T.text,fontSize:"15px",fontFamily:"'DM Sans', system-ui, sans-serif",boxSizing:"border-box"}} />
                </div>}
              </div>
              <button onClick={genPrep} disabled={!epTopic.trim()} style={{padding:"16px 32px",background:epTopic.trim()?T.coral:T.cardBorder,border:"none",borderRadius:"10px",color:"#fff",fontSize:"16px",fontWeight:"700",cursor:epTopic.trim()?"pointer":"not-allowed",fontFamily:"'DM Sans', system-ui, sans-serif",transition:"background 0.2s"}}>Start Planning →</button>
            </div>}

            {/* RESULT */}
            {step==="result"&&<div style={{animation:"fadeUp .4s ease"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"28px",flexWrap:"wrap",gap:"12px"}}>
                <div>
                  <h2 style={{fontSize:"36px",fontWeight:"700",color:T.text,margin:"0 0 4px",letterSpacing:"-0.5px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{mode==="clips"?"Clips Ready":mode==="prep"?"Episode Prep Ready":"Content Package Ready"}</h2>
                  <p style={{fontSize:"16px",color:T.textMuted,margin:0,fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px"}}>{d?.name.toUpperCase()}{ep?` · EP ${ep}`:""}{mode==="clips"?` · ${clipResults.filter(r=>!r.skipped).length} CLIPS`:` · ${secs.length} SECTIONS`}</p>
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  {mode!=="clips"&&<button onClick={()=>{copyText(raw);setCpAll(true);setTimeout(()=>setCpAll(false),2000);}} style={{...ghost,background:cpAll?T.coralSoft:"transparent",borderColor:cpAll?T.coralMid:T.cardBorder,color:cpAll?T.coral:T.textMuted}}>{cpAll?"✓ COPIED":"COPY ALL"}</button>}
                  {mode!=="clips"&&<button onClick={()=>{dlDoc(raw,`${d?.name}${mode==="prep"?` — Episode Prep${epTopic?` — ${epTopic}`:""}`:ep?` — Ep ${ep}`:""} Content Package`,d?.bp);setDlOk(true);setTimeout(()=>setDlOk(false),2500);}} style={{...ghost,background:dlOk?T.coralSoft:"transparent",borderColor:dlOk?T.coralMid:T.cardBorder,color:dlOk?T.coral:T.textMuted}}>{dlOk?"✓ DOWNLOADED":"📄 WORD DOC"}</button>}
                  {mode==="clips"&&<button onClick={()=>{const clipDoc=clipResults.filter(r=>!r.skipped).map(r=>`CLIP ${r.index}\n\n${r.content}`).join("\n\n");dlDoc(clipDoc,`${d?.name}${ep?` — Ep ${ep}`:""} — Clips`);setDlOk(true);setTimeout(()=>setDlOk(false),2500);}} style={{...ghost,background:dlOk?T.coralSoft:"transparent",borderColor:dlOk?T.coralMid:T.cardBorder,color:dlOk?T.coral:T.textMuted}}>{dlOk?"✓ DOWNLOADED":"📄 WORD DOC"}</button>}
                  {mode!=="clips"&&<button onClick={uploadToGDrive} disabled={gDriveStatus==="uploading"} title="Export to Google Drive as a Google Doc" style={{...ghost,background:gDriveStatus==="ok"?T.coralSoft:gDriveStatus==="error"||gDriveStatus==="disconnected"?"#D94F4F18":"transparent",borderColor:gDriveStatus==="ok"?T.coralMid:gDriveStatus==="error"||gDriveStatus==="disconnected"?"#D94F4F44":T.cardBorder,color:gDriveStatus==="ok"?T.coral:gDriveStatus==="error"||gDriveStatus==="disconnected"?"#D94F4F":T.textMuted,opacity:gDriveStatus==="uploading"?.6:1}}>{gDriveStatus==="uploading"?"UPLOADING…":gDriveStatus==="ok"?"✓ EXPORTED TO DRIVE":gDriveStatus==="error"?"✕ EXPORT FAILED":gDriveStatus==="disconnected"?"⚙ CONNECT IN SETTINGS":"📁 EXPORT TO GOOGLE DRIVE"}</button>}
                  <button onClick={()=>{setStep(mode==="clips"?"clips-setup":"input");setRaw("");setSecs([]);setClipResults([]);}} style={ghost}>{mode==="clips"?"NEW CLIPS":"NEW EPISODE"}</button>
                </div>
              </div>
              {d?.publishDay&&d?.publishTime&&d?.publishTz&&(()=>{try{const sched=formatPublishSchedule(d,userProfile?.timezone);if(!sched)return null;return(<div style={{background:T.coralSoft,border:"1px solid "+T.coralMid,borderRadius:"8px",padding:"12px 18px",marginBottom:"20px",display:"flex",alignItems:"center",gap:"10px"}}><span style={{fontSize:"18px"}}>📅</span><div><div style={{fontSize:"11px",color:T.coral,fontWeight:"700",letterSpacing:"1.5px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>PUBLISH SCHEDULE</div><div style={{fontSize:"14px",color:T.textSecondary,marginTop:"2px",fontFamily:"'DM Sans', system-ui, sans-serif",fontWeight:"500"}}>{sched.showTime}{sched.isDifferent?" · "+sched.localTime+" your time":""}</div></div></div>);}catch{return null;}})()}
              {err&&<div style={{background:"#D94F4F18",border:"1px solid #D94F4F44",borderRadius:"8px",padding:"12px 16px",color:"#F09090",fontSize:"14px",marginBottom:"12px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{err}</div>}
              {mode==="clips"?(
                <div>
                  {clipResults.map((clip,i)=>clip.skipped?null:(
                    <div key={i} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:"10px",marginBottom:"10px",overflow:"hidden"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",borderBottom:`1px solid ${T.cardBorder}`,background:T.surface}}>
                        <span style={{fontSize:"11px",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"2px",color:d.clr,fontWeight:"700"}}>✂️ CLIP {clip.index}</span>
                        <button onClick={()=>copyText(clip.content)} style={ghost}>COPY</button>
                      </div>
                      <div style={{padding:"20px 24px"}}>{renderContent(clip.content)}</div>
                    </div>
                  ))}
                </div>
              ):(
                <>
                  <div>{secs.map((s,i)=><Sec key={s.id+i} s={s} clr={clr}/>)}</div>
                  <div style={{display:"flex",gap:"10px",marginTop:"16px",flexWrap:"wrap"}}>
                    <button onClick={()=>setEditing(!editing)} style={{flex:1,padding:"13px",background:editing?T.coralSoft:T.card,border:`1px solid ${editing?T.coralMid:T.cardBorder}`,borderRadius:"8px",color:editing?T.coral:T.textSecondary,fontSize:"14px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1.5px",textTransform:"uppercase",transition:"all .2s"}}>{editing?"CLOSE EDITOR":"✏️  REVISE A SECTION"}</button>
                    {mode!=="editor"&&<button onClick={()=>{dlDoc(raw,`${d?.name}${mode==="prep"?` — Episode Prep${epTopic?` — ${epTopic}`:""}`:ep?` — Ep ${ep}`:""} Content Package`,d?.bp);setDlOk(true);setTimeout(()=>setDlOk(false),2500);}} style={{flex:1,padding:"13px",background:dlOk?T.coralSoft:T.card,border:`1px solid ${dlOk?T.coralMid:T.cardBorder}`,borderRadius:"8px",color:dlOk?T.coral:T.textSecondary,fontSize:"14px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1.5px",textTransform:"uppercase",transition:"all .2s"}}>{dlOk?"✓ DOWNLOADED":"📄  WORD DOC"}</button>}
                    {mode!=="editor"&&<button onClick={uploadToGDrive} disabled={gDriveStatus==="uploading"} title="Export to Google Drive as a Google Doc" style={{flex:1,padding:"13px",background:gDriveStatus==="ok"?T.coralSoft:gDriveStatus==="error"||gDriveStatus==="disconnected"?"#D94F4F18":T.card,border:`1px solid ${gDriveStatus==="ok"?T.coralMid:gDriveStatus==="error"||gDriveStatus==="disconnected"?"#D94F4F44":T.cardBorder}`,borderRadius:"8px",color:gDriveStatus==="ok"?T.coral:gDriveStatus==="error"||gDriveStatus==="disconnected"?"#D94F4F":T.textSecondary,fontSize:"14px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1.5px",textTransform:"uppercase",transition:"all .2s",opacity:gDriveStatus==="uploading"?.6:1}}>{gDriveStatus==="uploading"?"UPLOADING…":gDriveStatus==="ok"?"✓ EXPORTED TO DRIVE":gDriveStatus==="error"?"✕ EXPORT FAILED":gDriveStatus==="disconnected"?"⚙ CONNECT IN SETTINGS":"📁 EXPORT TO GOOGLE DRIVE"}</button>}
                  </div>
                  {mode==="editor"&&<div style={{background:T.card,border:"1px solid "+T.cardBorder,borderRadius:"10px",padding:"18px 20px",marginTop:"14px"}}>
                    <div style={{fontSize:"13px",color:T.coral,letterSpacing:"2px",fontFamily:"'DM Sans', system-ui, sans-serif",marginBottom:"12px",fontWeight:"700"}}>🎬 SEND CLIPS TO DESCRIPT</div>
                    <div style={{fontSize:"13px",color:T.textSecondary,fontFamily:"'DM Sans', system-ui, sans-serif",fontStyle:"italic",marginBottom:"12px"}}>Paste your Descript Project ID (last part of the project URL) to highlight clips in Descript.</div>
                    <div style={{display:"flex",gap:"8px",marginBottom:"8px",flexWrap:"wrap"}}>
                      <input value={descriptProjectId} onChange={e=>setDescriptProjectId(e.target.value)} placeholder="Project ID (from Descript URL)"
                        style={{flex:1,minWidth:"160px",background:T.surface,border:"1px solid "+T.cardBorder,borderRadius:"6px",padding:"10px 12px",color:T.text,fontSize:"13px",outline:"none",fontFamily:"monospace"}}/>
                      <button onClick={()=>{const clipSec=secs.find(s=>s.id==="editor-clips");sendToDescript(clipSec?.content||raw);}}
                        disabled={descriptSending||!descriptProjectId.trim()}
                        style={{padding:"10px 20px",background:descriptSending||!descriptProjectId.trim()?"#555":T.coral,border:"none",borderRadius:"6px",color:"#fff",fontSize:"13px",fontWeight:"700",cursor:descriptSending||!descriptProjectId.trim()?"not-allowed":"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px",whiteSpace:"nowrap"}}>
                        {descriptSending?"Sending...":"Send to Descript →"}
                      </button>
                    </div>
                    {descriptStatus&&<div style={{fontSize:"13px",color:descriptStatus.startsWith("Sent")||descriptStatus.startsWith("Job")?"#52B788":"#F09090",fontFamily:"monospace",marginTop:"6px"}}>{descriptStatus}</div>}
                    <div style={{fontSize:"11px",color:T.textMuted,fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px",marginTop:"8px"}}>API KEY: Settings → API Tokens in Descript · PROJECT ID: Last part of your Descript project URL</div>
                  </div>}
                  {editing&&<div style={{background:T.surface,border:`1px solid ${T.cardBorder}`,borderRadius:"10px",padding:"24px",marginTop:"10px",animation:"fadeUp .3s ease"}}>
                    <label style={lbl}>Section to Revise</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"16px"}}>
                      {ED.filter(s=>(!s.g||guest)&&(!s.pm||false)&&(!s.cm||mode==="clips")).map(s=>(
                        <button key={s.id} onClick={()=>setESec(s.id)} style={{padding:"6px 14px",background:eSec===s.id?`${clr}18`:T.card,border:eSec===s.id?`1px solid ${clr}55`:`1px solid ${T.cardBorder}`,borderRadius:"6px",color:eSec===s.id?T.text:T.textMuted,fontSize:"12px",cursor:"pointer",fontFamily:"'DM Sans', system-ui, sans-serif",letterSpacing:"1px",transition:"all .15s"}}>{s.l}</button>
                      ))}
                    </div>
                    {eSec&&<>
                      <label style={lbl}>Instructions</label>
                      <textarea style={{...field,minHeight:"80px",resize:"vertical",marginBottom:"10px",fontSize:"14px"}} placeholder='e.g. "Make the hook punchier" or "Tighten the LinkedIn post"' value={eTxt} onChange={e=>setETxt(e.target.value)}/>
                      <button onClick={doRev} disabled={!eTxt.trim()||rev} style={{...primary(clr),marginTop:"0",opacity:eTxt.trim()&&!rev?1:.35}}>{rev?"REVISING...":"SUBMIT REVISION →"}</button>
                    </>}
                  </div>}
                </>
              )}
            </div>}

          </div>
        </div>
      </div>
    </div>
  );
}