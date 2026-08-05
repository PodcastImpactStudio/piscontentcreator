import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { useTheme } from "./lib/theme";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

// ── PASSWORD STRENGTH ─────────────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak",        color: "#E55353", bars: 1 };
  if (score === 2) return { label: "Fair",        color: "#F5A623", bars: 2 };
  if (score === 3) return { label: "Good",        color: "#4CAF84", bars: 3 };
  return              { label: "Strong",          color: "#52B788", bars: 4 };
}

function StrengthBar({ password }) {
  const s = getStrength(password);
  if (!s) return null;
  return (
    <div style={{ marginTop: "-6px", marginBottom: "12px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "5px" }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex: 1, height: "3px", borderRadius: "2px",
            background: i <= s.bars ? s.color : "#3A3A3A",
            transition: "background 0.2s ease",
          }}/>
        ))}
      </div>
      <div style={{ fontSize: "12px", color: s.color, fontFamily: "'DM Sans', system-ui, sans-serif", letterSpacing: "1px" }}>
        {s.label}
      </div>
    </div>
  );
}

const TIMEZONES = [
  // ── North America ──────────────────────────────────────────────
  ["Pacific/Honolulu",              "Hawaii (HST, UTC-10)"],
  ["America/Anchorage",             "Alaska — Anchorage (AKST, UTC-9)"],
  ["America/Los_Angeles",           "Pacific Time — Los Angeles, Seattle (PT)"],
  ["America/Vancouver",             "Pacific Time — Vancouver, BC (PST/PDT)"],
  ["America/Phoenix",               "Mountain Time — Phoenix, AZ (MST, no DST)"],
  ["America/Denver",                "Mountain Time — Denver, Calgary (MT)"],
  ["America/Chicago",               "Central Time — Chicago, Dallas (CT)"],
  ["America/Mexico_City",           "Central Time — Mexico City (CST)"],
  ["America/New_York",              "Eastern Time — New York, Miami (ET)"],
  ["America/Toronto",               "Eastern Time — Toronto, Ottawa (ET)"],
  ["America/Halifax",               "Atlantic Time — Halifax, Nova Scotia (AT)"],
  ["America/St_Johns",              "Newfoundland Time — St. John's (NT)"],
  // ── Latin America ─────────────────────────────────────────────
  ["America/Bogota",                "Colombia — Bogotá (COT, UTC-5)"],
  ["America/Lima",                  "Peru — Lima (PET, UTC-5)"],
  ["America/Caracas",               "Venezuela — Caracas (VET, UTC-4)"],
  ["America/Santiago",              "Chile — Santiago (CLT)"],
  ["America/Sao_Paulo",             "Brazil — São Paulo (BRT, UTC-3)"],
  ["America/Argentina/Buenos_Aires","Argentina — Buenos Aires (ART, UTC-3)"],
  // ── Europe ────────────────────────────────────────────────────
  ["Europe/London",                 "London, Dublin (GMT/BST)"],
  ["Europe/Lisbon",                 "Lisbon, Porto (WET/WEST)"],
  ["Europe/Paris",                  "Paris, Berlin, Rome, Madrid (CET)"],
  ["Europe/Amsterdam",              "Amsterdam, Brussels, Zurich (CET)"],
  ["Europe/Stockholm",              "Stockholm, Oslo, Copenhagen (CET)"],
  ["Europe/Warsaw",                 "Warsaw, Prague, Budapest (CET)"],
  ["Europe/Helsinki",               "Helsinki, Tallinn, Riga (EET)"],
  ["Europe/Athens",                 "Athens, Bucharest, Sofia (EET)"],
  ["Europe/Moscow",                 "Moscow, St. Petersburg (MSK, UTC+3)"],
  ["Europe/Istanbul",               "Istanbul, Ankara (TRT, UTC+3)"],
  // ── Africa ────────────────────────────────────────────────────
  ["Africa/Casablanca",             "Morocco — Casablanca (WET)"],
  ["Africa/Lagos",                  "West Africa — Lagos, Accra (WAT, UTC+1)"],
  ["Africa/Cairo",                  "Egypt — Cairo (EET, UTC+2)"],
  ["Africa/Johannesburg",           "South Africa — Johannesburg, Cape Town (SAST, UTC+2)"],
  ["Africa/Nairobi",                "East Africa — Nairobi, Kampala (EAT, UTC+3)"],
  // ── Middle East ───────────────────────────────────────────────
  ["Asia/Riyadh",                   "Saudi Arabia — Riyadh, Jeddah (AST, UTC+3)"],
  ["Asia/Dubai",                    "UAE — Dubai, Abu Dhabi (GST, UTC+4)"],
  ["Asia/Kolkata",                  "India — Mumbai, Delhi, Bangalore (IST, UTC+5:30)"],
  ["Asia/Karachi",                  "Pakistan — Karachi, Lahore (PKT, UTC+5)"],
  ["Asia/Dhaka",                    "Bangladesh — Dhaka (BST, UTC+6)"],
  // ── Asia ──────────────────────────────────────────────────────
  ["Asia/Bangkok",                  "Southeast Asia — Bangkok, Jakarta (ICT, UTC+7)"],
  ["Asia/Singapore",                "Singapore, Kuala Lumpur (SGT, UTC+8)"],
  ["Asia/Shanghai",                 "China — Beijing, Shanghai (CST, UTC+8)"],
  ["Asia/Hong_Kong",                "Hong Kong (HKT, UTC+8)"],
  ["Asia/Taipei",                   "Taiwan — Taipei (CST, UTC+8)"],
  ["Asia/Manila",                   "Philippines — Manila (PHT, UTC+8)"],
  ["Asia/Seoul",                    "South Korea — Seoul (KST, UTC+9)"],
  ["Asia/Tokyo",                    "Japan — Tokyo, Osaka (JST, UTC+9)"],
  // ── Australia & Pacific ───────────────────────────────────────
  ["Australia/Perth",               "Western Australia — Perth (AWST, UTC+8)"],
  ["Australia/Darwin",              "Northern Territory — Darwin (ACST, UTC+9:30)"],
  ["Australia/Adelaide",            "South Australia — Adelaide (ACST)"],
  ["Australia/Brisbane",            "Queensland — Brisbane (AEST, UTC+10)"],
  ["Australia/Sydney",              "NSW — Sydney, Melbourne, Canberra (AEST)"],
  ["Pacific/Auckland",              "New Zealand — Auckland, Wellington (NZST, UTC+12)"],
  ["Pacific/Fiji",                  "Fiji (FJT, UTC+12)"],
];


// ── LANDING SCREEN ────────────────────────────────────────────────────────────
function LandingScreen({ onSignup, onLogin }) {
  const FF = "'DM Sans', system-ui, sans-serif";
  const SF = "Georgia, 'Times New Roman', serif";
  const BG = "#F5F0E8";
  const DR = "#7A0019";
  const DRH = "#9B0020";

  const tools = [
    { icon: "📦", label: "Full Episode Package", desc: "Show notes, YouTube description, social captions, newsletter, and blog post — all from one transcript." },
    { icon: "✂️", label: "Clips & Shorts", desc: "Identify the highest-impact moments and get ready-to-post short-form content for every platform." },
    { icon: "🎬", label: "Editor Companion", desc: "A structured editing brief with hook moments, pacing notes, and clip suggestions your editor can actually use." },
    { icon: "📋", label: "Episode Planning", desc: "Pre-episode prep, run-of-show, guest questions, and talking points — built around your show's format." },
    { icon: "🔍", label: "Guest Research", desc: "Audience-matched podcast booking targets with personalized pitch angles — ready to send." },
    { icon: "🎥", label: "Reel Ideas", desc: "Original to-camera reel concepts written in the host's voice, not pulled from the episode." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FF }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .lp-tool-card:hover { border-color: rgba(122,0,25,0.25) !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.07); }
        .lp-tool-card { transition: all .2s; }
      `}</style>

      {/* ── Nav ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(245,240,232,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E2D9CC", padding: "0 40px", height: "68px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onLogin}
            onMouseEnter={e => { e.currentTarget.style.color = DR; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#6B5E52"; }}
            style={{ padding: "8px 20px", background: "transparent", border: "none", color: "#6B5E52", fontSize: "14px", cursor: "pointer", fontFamily: FF, fontWeight: "500", transition: "color .15s" }}>
            Sign In
          </button>
          <button onClick={onSignup}
            onMouseEnter={e => { e.currentTarget.style.background = DRH; }}
            onMouseLeave={e => { e.currentTarget.style.background = DR; }}
            style={{ padding: "9px 20px", background: DR, border: "none", borderRadius: "7px", color: "#fff", fontSize: "14px", cursor: "pointer", fontFamily: FF, fontWeight: "600", transition: "background .15s" }}>
            Start Free Trial
          </button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "72px 24px 80px", textAlign: "center", animation: "fadeUp .5s ease both" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <img src="/logo-nav.png" alt="Podcast Impact Content Studio" style={{ height: "160px", objectFit: "contain" }} />
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", border: "1px solid rgba(122,0,25,0.25)", background: "rgba(122,0,25,0.06)", borderRadius: "20px", padding: "5px 16px", fontSize: "12px", color: DR, fontWeight: "600", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "36px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: DR, display: "inline-block" }} />
          7-Day Free Trial — No Credit Card
        </div>

        <h1 style={{ fontSize: "clamp(38px, 6vw, 66px)", fontWeight: "normal", color: "#1A1A1A", margin: "0 0 24px", lineHeight: "1.08", letterSpacing: "-1.5px", fontFamily: SF }}>
          Your show's voice.<br />
          <span style={{ color: DR }}>Your content. Done.</span>
        </h1>

        <p style={{ fontSize: "18px", color: "#4A3F35", margin: "0 0 48px", lineHeight: "1.75", fontWeight: "400", maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>
          Six tools built for podcast creators — content packages, clip scripts, editor briefs, episode planning, guest research, and reel ideas. All written in your show's exact voice, every time.
        </p>

        <button onClick={onSignup}
          onMouseEnter={e => { e.currentTarget.style.background = DRH; e.currentTarget.style.boxShadow = "0 8px 28px rgba(122,0,25,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = DR; e.currentTarget.style.boxShadow = "0 4px 18px rgba(122,0,25,0.3)"; }}
          style={{ padding: "17px 52px", background: DR, border: "none", borderRadius: "9px", color: "#fff", fontSize: "17px", fontWeight: "700", cursor: "pointer", fontFamily: FF, letterSpacing: "0.2px", boxShadow: "0 4px 18px rgba(122,0,25,0.3)", transition: "all .2s" }}>
          Start Your Free Trial →
        </button>

        <p style={{ marginTop: "16px", fontSize: "13px", color: "#9B8D82", margin: "16px 0 0" }}>
          7 days free · No credit card required · Cancel anytime
        </p>
      </div>

      {/* ── Divider ── */}
      <div style={{ maxWidth: "900px", margin: "0 auto 0", padding: "0 24px" }}>
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #D4C9BC, transparent)" }} />
      </div>

      {/* ── How it works ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "80px 24px 64px" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "3px", textTransform: "uppercase", color: DR, margin: "0 0 14px" }}>How it works</p>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: "normal", color: "#1A1A1A", margin: "0 0 14px", fontFamily: SF, letterSpacing: "-0.5px" }}>Set it up once. Use it for every episode.</h2>
          <p style={{ fontSize: "16px", color: "#6B5E52", margin: 0, maxWidth: "520px", marginLeft: "auto", marginRight: "auto" }}>Your Show DNA is the foundation. Every tool pulls from it so the output always sounds like you — not like AI.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", background: "#E2D9CC", borderRadius: "14px", overflow: "hidden" }}>
          {[
            { step: "01", title: "Build your Show DNA", body: "Set your show's voice, audience, platforms, and style once. The more detail you add, the better every output gets." },
            { step: "02", title: "Paste a transcript", body: "Drop in your episode transcript and choose your tool. The AI reads the full conversation before writing anything." },
            { step: "03", title: "Publish in minutes", body: "Get a complete, ready-to-use content package written in your voice — no rewrites, no generic filler." },
          ].map(s => (
            <div key={s.step} style={{ background: "#FFFFFF", padding: "36px 32px" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: DR, letterSpacing: "2px", marginBottom: "14px" }}>{s.step}</div>
              <div style={{ fontSize: "17px", fontWeight: "600", color: "#1A1A1A", marginBottom: "10px", fontFamily: SF }}>{s.title}</div>
              <div style={{ fontSize: "14px", color: "#6B5E52", lineHeight: "1.7" }}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tools grid ── */}
      <div style={{ background: "#FFFFFF", borderTop: "1px solid #E2D9CC", borderBottom: "1px solid #E2D9CC", padding: "80px 24px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <p style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "3px", textTransform: "uppercase", color: DR, margin: "0 0 14px" }}>Six tools. One studio.</p>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: "normal", color: "#1A1A1A", margin: "0 0 14px", fontFamily: SF, letterSpacing: "-0.5px" }}>Everything a podcast creator needs.</h2>
            <p style={{ fontSize: "16px", color: "#6B5E52", margin: 0 }}>Each tool is voice-aware, show-specific, and built to produce publish-ready output.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {tools.map(t => (
              <div key={t.label} className="lp-tool-card" style={{ background: BG, border: "1px solid #E2D9CC", borderRadius: "12px", padding: "28px 28px 24px" }}>
                <div style={{ fontSize: "26px", marginBottom: "14px" }}>{t.icon}</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#1A1A1A", marginBottom: "8px", fontFamily: SF }}>{t.label}</div>
                <div style={{ fontSize: "13px", color: "#6B5E52", lineHeight: "1.65" }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quote ── */}
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px", color: DR, marginBottom: "20px", fontFamily: SF, lineHeight: 1 }}>"</div>
          <p style={{ fontSize: "20px", color: "#2A2020", lineHeight: "1.75", margin: "0 0 32px", fontFamily: SF, fontStyle: "italic", fontWeight: "normal" }}>
            I built this for podcast producers who are tired of spending hours on content that should take minutes. Set your Show DNA once — and every episode practically writes itself.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: DR, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", color: "#fff", fontFamily: FF }}>T</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#1A1A1A" }}>Tamar Routly</div>
              <div style={{ fontSize: "12px", color: "#8B7D72" }}>Founder, Podcast Impact Studio</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background: "#1A1A1A", padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: "normal", color: "#F5F0E8", margin: "0 0 16px", fontFamily: SF, letterSpacing: "-0.5px" }}>
          Ready to stop rewriting?
        </h2>
        <p style={{ fontSize: "16px", color: "#A09080", margin: "0 0 40px", lineHeight: "1.6" }}>
          Start your free trial today. No credit card. No commitment.
        </p>
        <button onClick={onSignup}
          onMouseEnter={e => { e.currentTarget.style.background = DRH; }}
          onMouseLeave={e => { e.currentTarget.style.background = DR; }}
          style={{ padding: "17px 52px", background: DR, border: "none", borderRadius: "9px", color: "#fff", fontSize: "17px", fontWeight: "700", cursor: "pointer", fontFamily: FF, transition: "background .2s" }}>
          Start Your Free Trial →
        </button>
        <p style={{ marginTop: "16px", fontSize: "13px", color: "#6B5E52" }}>7 days free · No credit card required</p>
      </div>

      {/* ── Footer ── */}
      <div style={{ background: "#111111", borderTop: "1px solid #2A2A2A", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ fontSize: "12px", color: "#4A4A4A" }}>© {new Date().getFullYear()} Podcast Impact Studio</div>
        <div style={{ display: "flex", gap: "20px", fontSize: "12px" }}>
          <span style={{ cursor: "pointer", color: "#6B6B6B", transition: "color .15s" }} onClick={onLogin}>Sign In</span>
          <a href="/privacy.html" target="_blank" rel="noopener" style={{ color: "#6B6B6B", textDecoration: "none" }}>Privacy Policy</a>
          <a href="mailto:tamar@podcastimpactstudio.com" style={{ color: "#6B6B6B", textDecoration: "none" }}>Contact</a>
        </div>
      </div>

    </div>
  );
}

function LoginScreen({ onLogin, onSignup }) {
  const { T } = useTheme();
  const SF = "Georgia, 'Times New Roman', serif";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const inp = {
    width: "100%", background: T.card, border: "1px solid " + T.cardBorder,
    borderRadius: "8px", padding: "14px 18px", color: T.text,
    fontSize: "17px", outline: "none", boxSizing: "border-box",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    marginBottom: "14px",
  };
  const btn = (primary) => ({
    width: "100%", padding: "16px", border: "none", borderRadius: "8px",
    fontSize: "17px", fontWeight: "700", cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    background: primary ? T.coral : T.card,
    color: primary ? "#fff" : T.textMuted,
    marginTop: primary ? "8px" : "0",
  });

  async function handleForgotPassword() {
    if (!email.trim()) { setError("Enter your email address first, then click Forgot Password."); return; }
    setLoading(true); setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + "/#type=recovery",
      });
      if (error) throw error;
      setResetSent(true);
    } catch(e) {
      setError(e.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      onLogin(data.user);
    } catch (e) {
      setError(e.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img src="/logo-auth.png" alt="Podcast Impact Studio" style={{ height: "112px", width: "auto", marginBottom: "16px" }} />
          <div style={{ fontSize: "36px", fontWeight: "normal", color: T.text, letterSpacing: "-0.5px", fontFamily: SF }}>Podcast Impact Studio</div>
          <div style={{ fontSize: "18px", color: T.textMuted, marginTop: "8px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Content Creator</div>
        </div>
        <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", padding: "32px" }}>
          <div style={{ fontSize: "26px", fontWeight: "normal", color: T.text, marginBottom: "24px", fontFamily: SF }}>Sign in</div>
          <input
            type="email" placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={inp} autoFocus
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={inp}
          />
          {error && <div style={{ color: "#F09090", fontSize: "16px", marginBottom: "10px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{error}</div>}
          {resetSent ? (
            <div style={{ padding: "14px", background: "#52B78820", border: "1px solid #52B78844", borderRadius: "8px", textAlign: "center", color: "#52B788", fontSize: "16px", marginTop: "8px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              ✓ Password reset email sent — check your inbox.
            </div>
          ) : (
            <button onClick={handleLogin} disabled={loading} style={btn(true)}>
              {loading ? "Signing in..." : "Sign in →"}
            </button>
          )}
          <button onClick={handleForgotPassword} disabled={loading} style={{ ...btn(false), marginTop: "8px", fontSize: "15px", opacity: 0.7 }}>
            Forgot password?
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "15px", color: T.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          New here?{" "}
          <button onClick={onSignup} style={{ background: "none", border: "none", color: T.coral, cursor: "pointer", fontSize: "15px", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 0 }}>
            Create an account →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SIGNUP SCREEN ─────────────────────────────────────────────────────────────
const ROLES = [
  "Podcast Producer",
  "Agency Owner",
  "Freelance Editor",
  "Podcast Host",
  "Content Strategist",
  "Virtual Assistant",
  "Other",
];

function SignupScreen({ onSwitch, onAuthenticated }) {
  const { T } = useTheme();
  const SF = "Georgia, 'Times New Roman', serif";
  const [accountType, setAccountType] = useState("solo");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Vancouver");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false); // show "check your email" screen
  const turnstileRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    let localWidgetId = null;

    const doRender = () => {
      if (cancelled || !turnstileRef.current || !window.turnstile) return;
      try {
        localWidgetId = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          appearance: "always",
          callback: (token) => { if (!cancelled) setCaptchaToken(token); },
          "expired-callback": () => { if (!cancelled) setCaptchaToken(""); },
          "error-callback": () => { if (!cancelled) setCaptchaToken(""); },
        });
      } catch (e) {
        console.warn("Turnstile render failed:", e);
      }
    };

    if (window.__turnstileReady) {
      doRender();
    } else {
      window.__turnstileCallback = doRender;
    }

    return () => {
      cancelled = true;
      window.__turnstileCallback = null;
      try {
        if (localWidgetId != null && window.turnstile) window.turnstile.remove(localWidgetId);
      } catch (e) {}
    };
  }, []);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !orgName.trim() || !password) {
      setError("Please fill in all required fields."); return;
    }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true); setError("");
    try {

      const signupOptions = { email: email.trim().toLowerCase(), password };
      if (TURNSTILE_SITE_KEY && captchaToken) signupOptions.options = { captchaToken };
      const { data, error: signupError } = await supabase.auth.signUp(signupOptions);
      if (signupError) throw signupError;
      if (!data.user) throw new Error("Signup failed — please try again.");

      const r = await fetch("/api/create-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.user.id,
          orgName: orgName.trim(),
          userName: name.trim(),
          timezone,
          role: role || "Other",
          accountType,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Failed to create workspace.");

      // Check if email confirmation is required (session will be null if so)
      if (data.session) {
        // Email confirmation disabled — go straight in
        onAuthenticated(data.user);
      } else {
        // Email confirmation required — show the check-your-inbox screen
        setConfirming(true);
      }
    } catch (e) {
      const msg = e.message || "";
      if (msg.toLowerCase().includes("captcha") || msg.toLowerCase().includes("security")) {
        setError("Security check failed. Please refresh the page and try again.");
      } else {
        setError(msg || "Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inp = {
    width: "100%", background: T.card, border: "1px solid " + T.cardBorder,
    borderRadius: "8px", padding: "14px 18px", color: T.text,
    fontSize: "17px", outline: "none", boxSizing: "border-box",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    marginBottom: "14px",
  };
  const btn = (primary) => ({
    width: "100%", padding: "16px", border: "none", borderRadius: "8px",
    fontSize: "17px", fontWeight: "700", cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    background: primary ? T.coral : T.card,
    color: primary ? "#fff" : T.textMuted,
    marginTop: primary ? "8px" : "0",
  });
  const lbl = { fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.text, display: "block", marginBottom: "6px", fontFamily: "'DM Sans', system-ui, sans-serif" };

  // ── CONFIRMATION SCREEN ────────────────────────────────────────────────────
  if (confirming) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ width: "100%", maxWidth: "440px", textAlign: "center" }}>
          <img src="/logo-auth.png" alt="Podcast Impact Studio" style={{ height: "80px", width: "auto", marginBottom: "32px" }} />
          <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "16px", padding: "48px 40px" }}>
            <div style={{ fontSize: "48px", marginBottom: "20px" }}>📬</div>
            <div style={{ fontSize: "26px", fontWeight: "normal", color: T.text, fontFamily: SF, marginBottom: "14px", letterSpacing: "-0.3px" }}>
              Check your inbox
            </div>
            <div style={{ fontSize: "15px", color: T.textSecondary, fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: "1.7", marginBottom: "28px" }}>
              We sent a confirmation link to <strong style={{ color: T.text }}>{email}</strong>.<br />
              Click the link in that email to activate your account, then come back here and sign in.
            </div>
            <div style={{ background: T.coralSoft, border: "1px solid " + T.coralMid, borderRadius: "10px", padding: "16px 20px", marginBottom: "28px", textAlign: "left" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: T.coral, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: "8px" }}>Didn't get the email?</div>
              <div style={{ fontSize: "13px", color: T.textSecondary, fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: "1.6" }}>
                Check your spam or junk folder. The email comes from <em>noreply@mail.app.supabase.io</em>
              </div>
            </div>
            <button onClick={onSwitch} style={btn(true)}>
              Back to Sign In →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 20px 40px" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <img src="/logo-auth.png" alt="Podcast Impact Studio" style={{ height: "112px", width: "auto", marginBottom: "16px" }} />
          <div style={{ fontSize: "34px", fontWeight: "normal", color: T.text, letterSpacing: "-0.5px", fontFamily: SF, lineHeight: "1.2" }}>Create your workspace</div>
          <div style={{ fontSize: "15px", color: T.textMuted, marginTop: "8px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>All your podcasts, team, and content in one place.</div>
        </div>
        <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", padding: "32px" }}>

          {/* Account Type Selector */}
          <label style={lbl}>I am a... *</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            {[
              { id: "solo", icon: "🎙️", label: "Solo Podcaster", sub: "Just me & my show(s)" },
              { id: "agency", icon: "🏢", label: "Production Company", sub: "I manage shows & have a team" },
            ].map(opt => (
              <button key={opt.id} type="button" onClick={() => setAccountType(opt.id)}
                style={{ padding: "14px 10px", background: accountType === opt.id ? T.coralSoft : T.surface, border: "2px solid " + (accountType === opt.id ? T.coral : T.cardBorder), borderRadius: "10px", cursor: "pointer", textAlign: "center", transition: "all .15s" }}>
                <div style={{ fontSize: "26px", marginBottom: "6px" }}>{opt.icon}</div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: accountType === opt.id ? T.coral : T.text, fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: "3px" }}>{opt.label}</div>
                <div style={{ fontSize: "11px", color: T.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>{opt.sub}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "0" }}>
            <div>
              <label style={lbl}>Your First Name *</label>
              <input type="text" placeholder="Jane" value={name} onChange={e => setName(e.target.value)} style={{ ...inp, marginBottom: "0" }} autoFocus />
            </div>
            <div>
              <label style={lbl}>Your Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inp, marginBottom: "0", cursor: "pointer" }}>
                <option value="">Select role…</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={{ height: "12px" }} />
          <label style={lbl}>{accountType === "solo" ? "Podcast / Brand Name *" : "Business / Agency Name *"}</label>
          <input type="text" placeholder={accountType === "solo" ? "e.g. The Daily Wellness Podcast" : "e.g. Sound & Story Productions"} value={orgName} onChange={e => setOrgName(e.target.value)} style={inp} />

          <label style={lbl}>Email Address *</label>
          <input type="email" placeholder="jane@yourstudio.com" value={email} onChange={e => setEmail(e.target.value)} style={inp} />

          <label style={lbl}>Your Timezone</label>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
            {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          <label style={lbl}>Password *</label>
          <input type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
          <StrengthBar password={password} />
          <input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignup()} style={{ ...inp, marginBottom: "16px" }} />

          <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "16px", fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: "1.5" }}>
            Once you're in, you'll add your first podcast and can invite your team members from the admin panel.
          </div>

          {TURNSTILE_SITE_KEY && (
            <div ref={turnstileRef} style={{ marginBottom: "16px" }} />
          )}

          {error && <div style={{ color: "#F09090", fontSize: "14px", marginBottom: "12px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{error}</div>}
          <button onClick={handleSignup} disabled={loading} style={btn(true)}>
            {loading ? "Creating your workspace…" : "Create Account & Get Started →"}
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: T.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          Already have an account?{" "}
          <button onClick={onSwitch} style={{ background: "none", border: "none", color: T.coral, cursor: "pointer", fontSize: "13px", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 0 }}>
            Sign in →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ACCOUNT SETUP SCREEN (for invited users) ──────────────────────────────────
function AccountSetupScreen({ onComplete }) {
  const { T } = useTheme();
  const inp = {
    width: "100%", background: T.card, border: "1px solid " + T.cardBorder,
    borderRadius: "8px", padding: "14px 18px", color: T.text,
    fontSize: "17px", outline: "none", boxSizing: "border-box",
    fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: "14px",
  };
  const btn = (primary) => ({
    width: "100%", padding: "16px", border: "none", borderRadius: "8px",
    fontSize: "17px", fontWeight: "700", cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    background: primary ? T.coral : T.card,
    color: primary ? "#fff" : T.textMuted,
    marginTop: primary ? "8px" : "0",
  });
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Vancouver");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSetup() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!timezone) { setError("Please select your timezone."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError("");
    try {
      // Update password
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;
      // Update profile — include org_id from invite metadata
      const { data: { user } } = await supabase.auth.getUser();
      const orgId = user.user_metadata?.org_id || null;
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        name: name.trim(),
        timezone,
        role: user.user_metadata?.role || "editor",
        org_id: orgId,
      });
      if (profileError) throw profileError;
      onComplete();
    } catch (e) {
      setError(e.message || "Setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-detect timezone label
  const tzLabel = TIMEZONES.find(([v]) => v === timezone)?.[1] || timezone;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img src="/logo-auth.png" alt="Podcast Impact Studio" style={{ height: "112px", width: "auto", marginBottom: "16px" }} />
          <div style={{ fontSize: "28px", fontWeight: "800", color: T.text, letterSpacing: "-0.5px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Welcome!</div>
          <div style={{ fontSize: "15px", color: T.textMuted, marginTop: "6px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Set up your account to get started.</div>
        </div>
        <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: "12px", padding: "32px" }}>
          <div style={{ fontSize: "20px", fontWeight: "700", color: T.text, marginBottom: "6px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Account Setup</div>
          <div style={{ fontSize: "14px", color: T.textMuted, marginBottom: "24px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>This only takes a minute.</div>

          <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.text, display: "block", marginBottom: "6px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Your Name</label>
          <input type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={inp} autoFocus />

          <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.text, display: "block", marginBottom: "6px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Your Timezone</label>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
            {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div style={{ fontSize: "12px", color: T.textMuted, marginTop: "-8px", marginBottom: "14px", fontStyle: "italic", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            Detected: {tzLabel} — publish schedules will display in your local time.
          </div>

          <label style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: T.text, display: "block", marginBottom: "6px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Create Password</label>
          <input type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
          <input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSetup()} style={inp} />

          {error && <div style={{ color: "#F09090", fontSize: "14px", marginBottom: "10px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{error}</div>}
          <button onClick={handleSetup} disabled={loading} style={btn(true)}>
            {loading ? "Setting up..." : "Complete Setup →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN AUTH WRAPPER ─────────────────────────────────────────────────────────
export default function Auth({ onAuthenticated }) {
  const { T } = useTheme();
  const [mode, setMode] = useState("loading"); // loading | login | signup | setup

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
    const searchParams = new URLSearchParams(window.location.search);
    const type = hashParams.get("type") || searchParams.get("type");
    const tokenHash = searchParams.get("token_hash");
    const isInviteOrRecovery = type === "invite" || type === "recovery" || type === "signup" || !!tokenHash;

    function checkProfileAndRoute(session) {
      supabase.from("profiles").select("name, timezone").eq("id", session.user.id).single()
        .then(({ data }) => {
          if (!data?.name || !data?.timezone) { setMode("setup"); }
          else { onAuthenticated(session.user); }
        });
    }

    if (isInviteOrRecovery) {
      const exchangePromise = tokenHash
        ? supabase.auth.verifyOtp({ token_hash: tokenHash, type: type || "invite" })
        : Promise.resolve({ data: { session: null } });
      exchangePromise.then(({ data: { session: exchangedSession } }) => {
        if (exchangedSession) { checkProfileAndRoute(exchangedSession); return; }
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) { checkProfileAndRoute(session); }
        });
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) { onAuthenticated(session.user); }
        else { setMode("landing"); }
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        supabase.from("profiles").select("name, timezone").eq("id", session.user.id).single()
          .then(({ data }) => {
            if (!data?.name || !data?.timezone) { setMode("setup"); }
            else { onAuthenticated(session.user); }
          });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (mode === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "2px solid #3A3A3A", borderTopColor: T.coral, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (mode === "setup") {
    return <AccountSetupScreen onComplete={async () => {
      const { data: { user } } = await supabase.auth.getUser();
      onAuthenticated(user);
    }} />;
  }

  if (mode === "signup") {
    return <SignupScreen onSwitch={() => setMode("login")} onAuthenticated={onAuthenticated} />;
  }

  if (mode === "login") {
    return <LoginScreen onLogin={onAuthenticated} onSignup={() => setMode("signup")} />;
  }

  return <LandingScreen onSignup={() => setMode("signup")} onLogin={() => setMode("login")} />;
}
