#!/usr/bin/env python3
import base64, pathlib

ROOT = pathlib.Path("/Users/user/Developer/gas-portfolio-tracker")
DOCS = ROOT / "docs"

def b64(p, mime):
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()

img = {k: b64(DOCS / f"{k}.png", "image/png") for k in
       ["home", "hours", "jobs", "report", "widget", "settings"]}
inter = b64(ROOT / "src/fonts/InterVariable.woff2", "font/woff2")

SECTIONS = [
    ("The gauge", "home", "right",
     "Your total hours against your goal, read like a pressure gauge. The red line is the 275&#8209;hour pass mark; the needle sweeps to where you are the moment you open it.",
     ["Needle sweeps on load", "Redline at the pass mark", "Live as you log"]),
    ("The one number that matters", "home", "left",
     "&ldquo;Earliest realistic finish&rdquo; is the later of two dates &mdash; every hour done, and all fourteen write&#8209;ups done at your pace. It tells you which one is holding you back.",
     ["Hours gate vs write&#8209;ups gate", "Coverage still missing", "Days of slack to the deadline"]),
    ("Log it in seconds", "hours", "right",
     "A big value, quick&#8209;add steppers, one button. Log today or back&#8209;date it. Set a whole week in one go. And turn any logged day straight into an unassisted write&#8209;up &mdash; the hours move across, they never double&#8209;count.",
     ["+0.5 / +1 / +2 / +4", "&rarr; write&#8209;up in one click", "Whole&#8209;week total"]),
    ("Write-ups &amp; coverage", "jobs", "left",
     "Five installs, five services, four repairs &mdash; and every boiler type and every repair fault covered. The bars fill, the pills turn green, and the app won&rsquo;t let a gap hide.",
     ["Boiler + fault coverage", "Per&#8209;type progress bars", "Linked to the supervising engineer"]),
    ("Assessor-ready PDF", "report", "right",
     "One page, your name on it, the app&rsquo;s own graphics &mdash; hours, pace, counts, coverage, the engineers you&rsquo;ve worked under, and the full log. Export and hand it over.",
     ["No photos, just the numbers", "Your Gas&nbsp;Safe engineers listed", "One click"]),
    ("Always on your desktop", "widget", "left",
     "A menu&#8209;bar icon and a translucent desktop widget that sits behind your windows and keeps going after you close the app. Total, pace and the pass mark at a glance.",
     ["Menu&#8209;bar quick&#8209;log", "Frosted desktop card", "Starts at login"]),
]

FLAME = ('<svg class="flame" viewBox="0 0 24 24" aria-hidden="true">'
         '<defs><linearGradient id="fg" x1="0" y1="1" x2="0" y2="0">'
         '<stop offset="0" stop-color="#2338a8"/><stop offset=".36" stop-color="#2c78f2"/>'
         '<stop offset=".7" stop-color="#5cb4ff"/><stop offset="1" stop-color="#eaf5ff"/></linearGradient>'
         '<linearGradient id="cg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#84cbff"/>'
         '<stop offset="1" stop-color="#fff"/></linearGradient></defs>'
         '<path class="f-outer" d="M12.3 1.7C15.9 6 18.7 9.1 18.7 13.1 18.7 18.1 15.5 21.8 12 22.3 8.5 21.8 5.3 18.4 5.3 13 5.3 8.6 8.7 4.7 12.3 1.7Z" fill="url(#fg)"/>'
         '<path class="f-cone" d="M12 9C13.7 11.8 14.6 13.8 14.6 16 14.6 19 13.2 20.9 12 21.1 10.6 20.9 9.4 19 9.4 16.3 9.4 13.9 10.6 11.7 12 9Z" fill="url(#cg)"/>'
         '<ellipse class="f-core" cx="12" cy="17.3" rx="1.8" ry="3" fill="#fff"/></svg>')

def section_html(title, key, side, body, pills):
    pill_html = "".join(f"<li>{p}</li>" for p in pills)
    return f"""
    <section class="feat {side}" data-reveal>
      <div class="feat-copy">
        <h2>{title}</h2>
        <p>{body}</p>
        <ul class="pills">{pill_html}</ul>
      </div>
      <div class="feat-shot">
        <div class="frame"><img src="{img[key]}" alt="{title}" loading="lazy"></div>
      </div>
    </section>"""

body_sections = "\n".join(section_html(*s) for s in SECTIONS)

HTML = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gas Portfolio Tracker &mdash; a walkthrough</title>
<style>
  @font-face {{ font-family:"Inter"; font-weight:100 900; font-display:swap; src:url({inter}) format("woff2"); }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  :root {{
    --bg:#0b0d12; --bg2:#0f1219; --ink:#eef2f8; --ink2:rgba(255,255,255,.62); --ink3:rgba(255,255,255,.38);
    --accent:#4ea8ff; --accent2:#7cc4ff; --violet:#6d3ff2; --line:rgba(255,255,255,.09);
  }}
  html {{ scroll-behavior:smooth; }}
  body {{
    font-family:"Inter","SF Pro Text",-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;
    font-synthesis:none; -webkit-font-smoothing:antialiased;
    background:var(--bg); color:var(--ink); line-height:1.6; overflow-x:hidden;
  }}
  .bgfx {{ position:fixed; inset:0; z-index:0; pointer-events:none;
    background:
      radial-gradient(60% 40% at 78% 8%, rgba(78,168,255,.16), transparent 60%),
      radial-gradient(50% 40% at 12% 30%, rgba(109,63,242,.14), transparent 60%),
      linear-gradient(180deg, var(--bg), var(--bg2));
  }}
  .bgfx::after {{ content:""; position:absolute; inset:0; opacity:.5;
    background-image:linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
    background-size:44px 44px; mask-image:radial-gradient(circle at 50% 30%, #000 20%, transparent 75%);
  }}
  .wrap {{ position:relative; z-index:1; max-width:1080px; margin:0 auto; padding:0 28px; }}

  .flame {{ width:1em; height:1.18em; overflow:visible; vertical-align:-.16em;
    animation:glow 3.6s ease-in-out infinite; filter:drop-shadow(0 0 6px rgba(78,168,255,.5)); }}
  .flame .f-outer {{ transform-box:fill-box; transform-origin:50% 100%; animation:sway 2.8s ease-in-out infinite; }}
  .flame .f-cone  {{ transform-box:fill-box; transform-origin:50% 100%; animation:breath 1.8s ease-in-out infinite; }}
  .flame .f-core  {{ transform-box:fill-box; transform-origin:50% 70%; animation:flick 1s ease-in-out infinite; }}
  @keyframes glow {{ 0%,100%{{filter:drop-shadow(0 0 5px rgba(78,168,255,.45));}} 50%{{filter:drop-shadow(0 0 12px rgba(124,196,255,.8));}} }}
  @keyframes sway {{ 0%,100%{{transform:skewX(0) scale(1,1);}} 25%{{transform:skewX(-3deg) scale(.97,1.05);}} 60%{{transform:skewX(2deg) scale(1.03,.96);}} }}
  @keyframes breath {{ 0%,100%{{transform:scale(1,1);opacity:.92;}} 40%{{transform:scale(.92,1.13);opacity:1;}} }}
  @keyframes flick {{ 0%,100%{{opacity:.8;transform:scale(1);}} 40%{{opacity:1;transform:scale(1.2,1.3);}} }}

  header.hero {{ text-align:center; padding:120px 0 60px; }}
  .badge {{ display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:700; letter-spacing:.14em;
    text-transform:uppercase; color:var(--ink3); border:1px solid var(--line); border-radius:999px; padding:7px 16px; }}
  .hero h1 {{ font-size:clamp(38px,7vw,68px); font-weight:800; letter-spacing:-.03em; line-height:1.05; margin:26px 0 14px;
    background:linear-gradient(180deg,#fff,#a9c6e6); -webkit-background-clip:text; background-clip:text; color:transparent; }}
  .hero .sub {{ font-size:clamp(16px,2.3vw,21px); color:var(--ink2); max-width:620px; margin:0 auto; }}
  .hero .shot {{ margin:56px auto 0; max-width:430px; animation:float 7s ease-in-out infinite; }}
  @keyframes float {{ 0%,100%{{transform:translateY(0);}} 50%{{transform:translateY(-14px);}} }}
  .frame {{ border-radius:20px; overflow:hidden; border:1px solid var(--line);
    box-shadow:0 40px 90px -30px rgba(0,0,0,.8), 0 0 0 1px rgba(78,168,255,.08), 0 0 60px -10px rgba(78,168,255,.25); }}
  .frame img {{ display:block; width:100%; }}

  .feat {{ display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:center; padding:70px 0;
    opacity:0; transform:translateY(28px); transition:opacity .7s ease, transform .7s cubic-bezier(.16,.84,.36,1); }}
  .feat.in {{ opacity:1; transform:none; }}
  .feat.left .feat-copy {{ order:2; }}
  .feat.left .feat-shot {{ order:1; }}
  .feat-shot {{ max-width:420px; }}
  .feat h2 {{ font-size:clamp(24px,3.4vw,34px); font-weight:800; letter-spacing:-.02em; margin-bottom:14px; }}
  .feat p {{ color:var(--ink2); font-size:15.5px; }}
  .pills {{ list-style:none; display:flex; flex-wrap:wrap; gap:8px; margin-top:20px; }}
  .pills li {{ font-size:12px; font-weight:600; color:var(--accent2); background:rgba(78,168,255,.09);
    border:1px solid rgba(78,168,255,.22); border-radius:999px; padding:5px 12px; }}

  footer {{ text-align:center; padding:90px 0 70px; color:var(--ink3); font-size:13.5px; position:relative; z-index:1; }}
  footer .flame {{ font-size:22px; }}
  footer a {{ color:var(--accent2); text-decoration:none; }}
  footer .big {{ color:var(--ink); font-size:18px; font-weight:700; margin:14px 0 6px; }}

  @media (max-width:820px) {{
    .feat {{ grid-template-columns:1fr; gap:26px; padding:52px 0; text-align:center; }}
    .feat.left .feat-copy, .feat.left .feat-shot {{ order:initial; }}
    .feat-shot {{ margin:0 auto; }} .pills {{ justify-content:center; }}
  }}
  @media (prefers-reduced-motion:reduce) {{ *,*::before,*::after {{ animation:none !important; }} .feat {{ opacity:1; transform:none; }} }}
</style>
</head>
<body>
<div class="bgfx"></div>

<header class="hero wrap">
  <span class="badge">{FLAME} Gas Portfolio Tracker &nbsp;&middot;&nbsp; v2.2.0</span>
  <h1>Know if you&rsquo;ll actually<br>hit the deadline.</h1>
  <p class="sub">A desktop tracker for a gas SVQ / NVQ portfolio &mdash; assisted hours, unassisted write&#8209;ups, boiler and fault coverage, and the one date that says whether you&rsquo;re on track.</p>
  <div class="shot"><div class="frame"><img src="{img['home']}" alt="Home dashboard"></div></div>
</header>

<main class="wrap">
{body_sections}

  <section class="feat right" data-reveal>
    <div class="feat-copy">
      <h2>Yours. Private. Current.</h2>
      <p>Everything is stored on your machine &mdash; nothing is uploaded. The app checks for updates on launch and swaps itself in on restart, so your logged hours and settings are never touched. macOS and Windows, built from the same code, identical.</p>
      <ul class="pills"><li>Local&#8209;only data</li><li>In&#8209;app updates</li><li>macOS + Windows</li></ul>
    </div>
    <div class="feat-shot"><div class="frame"><img src="{img['settings']}" alt="Settings" loading="lazy"></div></div>
  </section>
</main>

<footer>
  {FLAME}
  <div class="big">Gas Portfolio Tracker</div>
  <div>Made by Connor W &nbsp;&middot;&nbsp; v2.2.0 &nbsp;&middot;&nbsp; <a href="https://github.com/awpehz/gas-portfolio-tracker">github.com/awpehz/gas-portfolio-tracker</a></div>
</footer>

<script>
  const io = new IntersectionObserver((es) => {{
    es.forEach((e) => {{ if (e.isIntersecting) {{ e.target.classList.add("in"); io.unobserve(e.target); }} }});
  }}, {{ threshold: 0.2 }});
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
</script>
</body>
</html>
"""

out = DOCS / "tour.html"
out.write_text(HTML)
print("wrote", out, f"({len(HTML)/1024/1024:.1f} MB)")
