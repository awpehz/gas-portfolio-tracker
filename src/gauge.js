// The pressure-gauge SVG — shared by the main window (Home hero) and the desktop
// widget so they look and animate identically. Pure string builder, no DOM.
// Needs a matching <linearGradient id="gaugeGrad"> + <radialGradient id="gaugeFace">
// in the host document, and the rules in gauge.css.
(function () {
  const G = { cx: 120, cy: 116, start: -125, end: 125 };

  function polar(deg, r) {
    const a = (deg * Math.PI) / 180;
    return [G.cx + r * Math.sin(a), G.cy - r * Math.cos(a)];
  }
  function arc(r, d0, d1) {
    const [x0, y0] = polar(d0, r);
    const [x1, y1] = polar(d1, r);
    const large = Math.abs(d1 - d0) > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  function line(deg, r0, r1) {
    const [x0, y0] = polar(deg, r0);
    const [x1, y1] = polar(deg, r1);
    return `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
  }

  // s: { total, goal, required }
  function svg(s) {
    const span = G.end - G.start;
    const f = (x) => G.start + Math.max(0, Math.min(1, x)) * span;
    const valAng = f(s.goal ? s.total / s.goal : 0);
    const passAng = f(s.goal ? s.required / s.goal : 0);
    const overGoal = s.total >= s.goal;

    const N = 40;
    let minor = "", major = "", labels = "";
    for (let i = 0; i <= N; i++) {
      const ang = G.start + (i / N) * span;
      if (i % 5 === 0) {
        major += line(ang, 64, 78);
        if (i === 0 || i === N) {
          const [lx, ly] = polar(ang, 50);
          labels += `<text class="g-num" x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}">${i === 0 ? 0 : s.goal}</text>`;
        }
      } else {
        minor += line(ang, 71, 78);
      }
    }
    const [px, py] = polar(passAng, 46);
    const [tx, ty] = polar(valAng, 80);

    return `
      <svg class="gauge ${overGoal ? "full" : ""}" viewBox="0 0 240 214">
        <circle class="g-bezel-o" cx="120" cy="116" r="102"/>
        <circle class="g-bezel-i" cx="120" cy="116" r="95"/>
        <circle class="g-face" cx="120" cy="116" r="92"/>
        <ellipse class="g-glass" cx="100" cy="78" rx="70" ry="44"/>

        <path class="g-zone g-zone-lo" d="${arc(80, G.start, passAng)}"/>
        <path class="g-zone g-zone-hi" d="${arc(80, passAng, G.end)}"/>

        <g class="g-ticks-minor">${minor}</g>
        <g class="g-ticks-major">${major}</g>
        ${labels}

        <path class="g-track" d="${arc(80, G.start, G.end)}"/>
        <path class="g-val" pathLength="100" d="${arc(80, G.start, valAng)}"/>
        <circle class="g-val-tip" cx="${tx.toFixed(2)}" cy="${ty.toFixed(2)}" r="3.6"/>

        <g class="g-redwrap" style="--at:${passAng.toFixed(2)}deg">
          <line class="g-red" x1="120" y1="${(116 - 87).toFixed(1)}" x2="120" y2="${(116 - 66).toFixed(1)}"/>
        </g>
        <text class="g-passlabel" x="${px.toFixed(1)}" y="${(py + 3).toFixed(1)}">${s.required}</text>

        <g class="g-needle" style="--to:${valAng.toFixed(2)}deg">
          <g class="g-needle-in">
            <path class="g-needle-tail" d="M120 116 L117.5 131 L122.5 131 Z"/>
            <path class="g-needle-tip" d="M120 116 L116.5 48 L120 38 L123.5 48 Z"/>
          </g>
        </g>
        <circle class="g-hub-o" cx="120" cy="116" r="12"/>
        <circle class="g-hub-m" cx="120" cy="116" r="7.5"/>
        <circle class="g-hub-c" cx="120" cy="116" r="3.2"/>
      </svg>`;
  }

  const defsSVG =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="#2338a8"/><stop offset="0.5" stop-color="#2c78f2"/>' +
    '<stop offset="1" stop-color="#5cb4ff"/></linearGradient>' +
    '<radialGradient id="gaugeFace" cx="0.4" cy="0.34" r="0.85">' +
    '<stop offset="0" stop-color="#212736"/><stop offset="0.6" stop-color="#141925"/>' +
    '<stop offset="1" stop-color="#0a0d14"/></radialGradient></defs></svg>';

  window.GaugeUI = { svg, defsSVG };
})();
