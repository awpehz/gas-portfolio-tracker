#!/usr/bin/env python3
# Builds the sales / showcase page -> docs/index.html (+ docs/tour.html).
# Assets (screenshots, the app-demo gif, the font) are referenced relatively and
# live alongside in docs/, so the page stays small and GitHub Pages serves it.
# Version comes from package.json.
import json, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
VERSION = json.loads((ROOT / "package.json").read_text())["version"]
REPO = "https://github.com/awpehz/gas-portfolio-tracker"

# make the font available next to the page
shutil.copyfile(ROOT / "src/fonts/InterVariable.woff2", DOCS / "InterVariable.woff2")

FEATURES = [
    ("home.png", "right", "One glance tells you if you're on track",
     "A pressure gauge for your total hours, a red line at the 275&#8209;hour pass mark, and the four numbers that actually matter &mdash; the pace you need, what you did this week, and the earliest you can realistically be finished.",
     ["Animated gauge", "Rate needed vs. flat&#8209;out", "Deadline maths that counts college weeks &amp; holidays"]),
    ("jobs.png", "left", "Every write-up, every box ticked",
     "Five installs, five services, four repairs &mdash; and every boiler type and every fault covered. The bars fill, the tags turn green, and a missing category can't hide from you.",
     ["Boiler &amp; fault coverage", "Linked to the supervising engineer", "Turn a logged day into a write&#8209;up"]),
    ("hours.png", "right", "Log a day in three taps",
     "Big number, quick&#8209;add steppers, done. Back&#8209;date it, set a whole week at once, or log straight from the menu bar without opening the app.",
     ["+0.5 / +1 / +2 / +4", "Whole&#8209;week total", "Menu&#8209;bar quick log"]),
    ("report.png", "left", "Hand your assessor a clean PDF",
     "One page, your name on it, in the app's own colours &mdash; hours, pace, counts, coverage, the engineers you've worked under and the full log. Export and email it.",
     ["No photos, just the record", "Your Gas&nbsp;Safe engineers listed", "One click"]),
    ("widget.png", "right", "It lives on your desktop",
     "A menu&#8209;bar icon and a frosted desktop widget with the same gauge, sitting behind your windows and running even when the app is closed. Small, medium or large.",
     ["Always&#8209;there widget", "Starts at login", "Nothing uploaded &mdash; your data stays on your machine"]),
]

def feat(img, side, title, body, pills):
    lis = "".join(f"<li>{p}</li>" for p in pills)
    return f"""
    <section class="feat {side}" data-reveal>
      <div class="copy">
        <h2>{title}</h2>
        <p>{body}</p>
        <ul class="pills">{lis}</ul>
      </div>
      <div class="shot"><div class="frame"><img src="{img}" alt="{title}" loading="lazy"></div></div>
    </section>"""

FLAME = ('<svg class="flame" viewBox="0 0 24 24" aria-hidden>'
         '<defs><linearGradient id="fg" x1="0" y1="1" x2="0" y2="0">'
         '<stop offset="0" stop-color="#2338a8"/><stop offset=".36" stop-color="#2c78f2"/>'
         '<stop offset=".7" stop-color="#5cb4ff"/><stop offset="1" stop-color="#eaf5ff"/></linearGradient>'
         '<linearGradient id="cg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#84cbff"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>'
         '<path class="fo" d="M12.3 1.7C15.9 6 18.7 9.1 18.7 13.1 18.7 18.1 15.5 21.8 12 22.3 8.5 21.8 5.3 18.4 5.3 13 5.3 8.6 8.7 4.7 12.3 1.7Z" fill="url(#fg)"/>'
         '<path class="fc" d="M12 9C13.7 11.8 14.6 13.8 14.6 16 14.6 19 13.2 20.9 12 21.1 10.6 20.9 9.4 19 9.4 16.3 9.4 13.9 10.6 11.7 12 9Z" fill="url(#cg)"/>'
         '<ellipse class="fk" cx="12" cy="17.3" rx="1.8" ry="3" fill="#fff"/></svg>')

HTML = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gas Portfolio Tracker</title>
<meta name="description" content="Know if you'll actually hit the deadline. A desktop tracker for a gas SVQ/NVQ portfolio — hours, write-ups, coverage, and the one date that matters.">
<style>
  @font-face {{ font-family:"Inter"; font-weight:100 900; font-display:swap; src:url("InterVariable.woff2") format("woff2"); }}
  *{{box-sizing:border-box;margin:0;padding:0}}
  :root{{--bg:#0a0c11;--bg2:#0e1119;--ink:#eef2f8;--ink2:rgba(255,255,255,.62);--ink3:rgba(255,255,255,.4);
    --accent:#4ea8ff;--accent2:#7cc4ff;--violet:#6d3ff2;--line:rgba(255,255,255,.09)}}
  html{{scroll-behavior:smooth}}
  body{{font-family:"Inter","SF Pro Text",-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;font-synthesis:none;
    -webkit-font-smoothing:antialiased;background:var(--bg);color:var(--ink);line-height:1.6;overflow-x:hidden}}
  a{{text-decoration:none;color:inherit}}
  .foot a:hover{{text-decoration:underline}}
  .bg{{position:fixed;inset:0;z-index:0;pointer-events:none;
    background:radial-gradient(60% 42% at 80% 4%,rgba(78,168,255,.16),transparent 60%),
    radial-gradient(52% 40% at 10% 24%,rgba(109,63,242,.13),transparent 60%),linear-gradient(180deg,var(--bg),var(--bg2))}}
  .bg::after{{content:"";position:absolute;inset:0;opacity:.45;
    background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);
    background-size:46px 46px;mask-image:radial-gradient(circle at 50% 26%,#000 18%,transparent 74%)}}
  .wrap{{position:relative;z-index:1;max-width:1060px;margin:0 auto;padding:0 26px}}

  .flame{{width:1em;height:1.18em;overflow:visible;vertical-align:-.16em;animation:g 3.6s ease-in-out infinite;filter:drop-shadow(0 0 6px rgba(78,168,255,.5))}}
  .flame .fo{{transform-box:fill-box;transform-origin:50% 100%;animation:sw 2.8s ease-in-out infinite}}
  .flame .fc{{transform-box:fill-box;transform-origin:50% 100%;animation:br 1.8s ease-in-out infinite}}
  .flame .fk{{transform-box:fill-box;transform-origin:50% 70%;animation:fl 1s ease-in-out infinite}}
  @keyframes g{{0%,100%{{filter:drop-shadow(0 0 5px rgba(78,168,255,.45))}}50%{{filter:drop-shadow(0 0 12px rgba(124,196,255,.8))}}}}
  @keyframes sw{{0%,100%{{transform:skewX(0) scale(1,1)}}25%{{transform:skewX(-3deg) scale(.97,1.05)}}60%{{transform:skewX(2deg) scale(1.03,.96)}}}}
  @keyframes br{{0%,100%{{transform:scale(1,1);opacity:.92}}40%{{transform:scale(.92,1.13);opacity:1}}}}
  @keyframes fl{{0%,100%{{opacity:.8;transform:scale(1)}}40%{{opacity:1;transform:scale(1.2,1.3)}}}}

  header{{text-align:center;padding:104px 0 40px}}
  .badge{{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
    color:var(--ink3);border:1px solid var(--line);border-radius:999px;padding:7px 15px}}
  h1{{font-size:clamp(36px,7vw,66px);font-weight:800;letter-spacing:-.03em;line-height:1.04;margin:24px 0 14px;
    background:linear-gradient(180deg,#fff,#a7c4e4);-webkit-background-clip:text;background-clip:text;color:transparent}}
  .sub{{font-size:clamp(16px,2.3vw,20px);color:var(--ink2);max-width:600px;margin:0 auto}}
  .cta{{display:inline-flex;align-items:center;gap:8px;margin-top:26px;padding:13px 24px;border-radius:12px;font-weight:700;
    background:linear-gradient(180deg,#7cc4ff,#4ea8ff);color:#071018;box-shadow:0 12px 34px -12px rgba(78,168,255,.7)}}
  .cta.ghost{{background:transparent;color:var(--ink);border:1px solid var(--line);box-shadow:none;margin-left:10px}}

  .demo{{margin:52px auto 0;max-width:392px}}
  .frame{{border-radius:22px;overflow:hidden;border:1px solid var(--line);
    box-shadow:0 44px 100px -34px rgba(0,0,0,.85),0 0 0 1px rgba(78,168,255,.08),0 0 70px -12px rgba(78,168,255,.28)}}
  .frame img,.frame video{{display:block;width:100%}}
  .demo .cap{{text-align:center;color:var(--ink3);font-size:12px;margin-top:12px}}

  .band{{padding:64px 0}}
  .band h3{{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent2);text-align:center;margin-bottom:26px}}
  .three{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}}
  .three .card{{background:rgba(255,255,255,.028);border:1px solid var(--line);border-radius:16px;padding:20px}}
  .three .n{{font-size:12px;font-weight:800;color:var(--accent2)}}
  .three h4{{margin:6px 0 6px;font-size:16px}}
  .three p{{color:var(--ink2);font-size:14px}}

  .feat{{display:grid;grid-template-columns:1fr 1fr;gap:54px;align-items:center;padding:64px 0;opacity:0;transform:translateY(26px);
    transition:opacity .7s ease,transform .7s cubic-bezier(.16,.84,.36,1)}}
  .feat.in{{opacity:1;transform:none}}
  .feat.left .copy{{order:2}} .feat.left .shot{{order:1}}
  .feat .shot{{max-width:420px}}
  .feat h2{{font-size:clamp(23px,3.3vw,32px);font-weight:800;letter-spacing:-.02em;margin-bottom:12px}}
  .feat p{{color:var(--ink2);font-size:15.5px}}
  .pills{{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}}
  .pills li{{font-size:12px;font-weight:600;color:var(--accent2);background:rgba(78,168,255,.09);border:1px solid rgba(78,168,255,.22);border-radius:999px;padding:5px 12px}}

  .quote{{max-width:680px;margin:20px auto;text-align:center;padding:40px 0}}
  .quote p{{font-size:clamp(18px,2.6vw,24px);font-weight:600;letter-spacing:-.01em}}
  .quote .by{{color:var(--ink3);font-size:13px;margin-top:14px}}

  .foot{{text-align:center;padding:70px 0 80px;color:var(--ink3);font-size:13px}}
  .foot .big{{color:var(--ink);font-size:18px;font-weight:700;margin:12px 0 4px}}
  .foot a{{color:var(--accent2)}}

  @media(max-width:820px){{
    .three{{grid-template-columns:1fr}}
    .feat{{grid-template-columns:1fr;gap:24px;padding:48px 0;text-align:center}}
    .feat.left .copy,.feat.left .shot{{order:initial}} .feat .shot{{margin:0 auto}} .pills{{justify-content:center}}
  }}
  @media(prefers-reduced-motion:reduce){{*,*::before,*::after{{animation:none!important}} .feat{{opacity:1;transform:none}}}}
</style>
</head>
<body>
<div class="bg"></div>

<header class="wrap">
  <span class="badge">{FLAME} Gas Portfolio Tracker · v{VERSION}</span>
  <h1>Know if you'll actually<br>hit the deadline.</h1>
  <p class="sub">A desktop tracker for a gas SVQ / NVQ portfolio &mdash; assisted hours, unassisted write&#8209;ups, boiler and fault coverage, and the one date that says whether you're on track. Free. Yours. Nothing uploaded.</p>
  <div>
    <a class="cta" href="{REPO}/releases/latest">Download for macOS &amp; Windows</a>
    <a class="cta ghost" href="{REPO}">View the code</a>
  </div>
  <div class="demo">
    <div class="frame">
      <video src="app-demo.mp4" poster="home.png" autoplay muted loop playsinline preload="metadata"
             aria-label="The app in motion — gauge, tabs, logging an entry">
        <img src="app-demo.gif" alt="The app in motion">
      </video>
    </div>
    <div class="cap">the actual app &mdash; nothing staged</div>
  </div>
</header>

<div class="band wrap">
  <h3>The bit a spreadsheet never answers</h3>
  <div class="three">
    <div class="card"><div class="n">THE PROBLEM</div><h4>&ldquo;Am I on track?&rdquo;</h4><p>You log hours in a spreadsheet, but it never tells you the pace you need, or whether the deadline is realistic once college weeks and holidays come out.</p></div>
    <div class="card"><div class="n">THE FIX</div><h4>One honest number</h4><p>Hours per working day needed &mdash; and the earliest you can actually be finished, hours <em>and</em> all fourteen write&#8209;ups, at your pace.</p></div>
    <div class="card"><div class="n">THE POINT</div><h4>Know in September</h4><p>Not in December. If you're behind, you see it with months to fix it &mdash; and exactly which category is holding you up.</p></div>
  </div>
</div>

<main class="wrap">
{"".join(feat(*f) for f in FEATURES)}
</main>

<div class="quote wrap">
  <p>&ldquo;Built it for my own portfolio because nothing did this. Turns out every apprentice needs it.&rdquo;</p>
  <div class="by">&mdash; Connor W, gas apprentice</div>
</div>

<div class="foot">
  {FLAME}
  <div class="big">Gas Portfolio Tracker</div>
  <div>Free · macOS + Windows · in&#8209;app updates · <a href="{REPO}/releases/latest">Download v{VERSION}</a> · <a href="{REPO}">Source</a></div>
</div>

<script>
  const io=new IntersectionObserver(es=>es.forEach(e=>{{if(e.isIntersecting){{e.target.classList.add("in");io.unobserve(e.target)}}}}),{{threshold:.2}});
  document.querySelectorAll("[data-reveal]").forEach(el=>io.observe(el));
</script>
</body>
</html>
"""

for name in ("index.html", "tour.html"):
    (DOCS / name).write_text(HTML)
print(f"wrote docs/index.html + docs/tour.html  v{VERSION}  ({len(HTML)/1024:.0f} KB + assets)")
