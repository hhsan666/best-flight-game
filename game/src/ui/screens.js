// The game's screens as plain DOM over the 3D view: title with the mission list, briefing with
// conditions and objectives, pause, how-to-fly, settings, and the results card with its medal,
// landing grade and score breakdown. Buttons report through data-action attributes.
import { MISSIONS } from '../missions/mission-catalog.js';
import { CONTROL_HELP } from '../input/pilot-input.js';

const SKY_ICONS = { morning: '☀', noon: '☼', golden: '◐', storm: '☂', dusk: '☾' };
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A plan view of the runway: the touchdown zone, where the wheels met it (off-centre exaggerated) and where it stopped. */
function landingPlot(p) {
  const x = (m) => 12 + (Math.max(0, Math.min(p.length, m)) / p.length) * 376;
  const y = (off) => 30 + Math.max(-1, Math.min(1, off / (p.width / 2))) * 9;
  const td = x(p.touchdown);
  const stop = p.stop === null || p.stop === undefined ? null : x(p.stop);
  const side = Math.abs(p.offset) < 0.05 ? 'on' : p.offset < 0 ? 'left of' : 'right of';
  const bars = [0, 1, 2, 3].map((i) => `<rect x="15" y="${21.5 + i * 5}" width="7" height="2.4" fill="#e9e8e2"/>`).join('');
  return `<svg class="landing-plot" viewBox="0 0 400 58" role="img" aria-label="Touchdown ${Math.round(p.touchdown)} m past the threshold, ${Math.abs(p.offset).toFixed(1)} m ${side} the centreline${stop === null ? '' : `, stopped at ${Math.round(p.stop)} m`}">
    <rect x="12" y="19" width="376" height="22" rx="2" fill="#2f3236" stroke="rgba(255,255,255,0.35)"/>
    <rect x="${x(150).toFixed(1)}" y="19" width="${(x(450) - x(150)).toFixed(1)}" height="22" fill="rgba(70,224,122,0.25)"/>
    <line x1="26" y1="30" x2="384" y2="30" stroke="rgba(255,255,255,0.65)" stroke-dasharray="7 6"/>${bars}
    ${stop === null ? '' : `<line x1="${td.toFixed(1)}" y1="${y(p.offset).toFixed(1)}" x2="${stop.toFixed(1)}" y2="30" stroke="#ffc23a" stroke-width="1.6" stroke-dasharray="3 3"/><rect x="${(stop - 3.5).toFixed(1)}" y="26.5" width="7" height="7" fill="#ffffff"/>`}
    <circle cx="${td.toFixed(1)}" cy="${y(p.offset).toFixed(1)}" r="5" fill="#ffc23a" stroke="#1a1206" stroke-width="1.2"/>
    <text x="${Math.max(60, Math.min(340, td)).toFixed(1)}" y="12" text-anchor="middle" class="plot-touchdown">TOUCHDOWN ${Math.round(p.touchdown)} m</text>
    <text x="${((x(150) + x(450)) / 2).toFixed(1)}" y="54" text-anchor="middle" class="plot-zone">ZONE</text>
    ${stop === null ? '' : `<text x="${Math.max(40, Math.min(360, stop)).toFixed(1)}" y="54" text-anchor="middle" class="plot-stop">STOP ${Math.round(p.stop)} m</text>`}
  </svg>`;
}

function medalBadge(medal, big = false) {
  if (!medal) return big ? '' : '<span class="medal"></span>';
  const letter = { gold: 'G', silver: 'S', bronze: 'B' }[medal];
  return big ? `<div class="big-medal medal-${medal}">${letter}</div>` : `<span class="medal medal-${medal}" title="${medal}">${letter}</span>`;
}

function describeWind(w) {
  return `${String(w.from).padStart(3, '0')}° ${w.knots} kt${w.gust ? ` gusting ${w.knots + w.gust}` : ''}`;
}

function describeStep(step) {
  if (step.type === 'takeoff') return 'Take off from the runway';
  if (step.type === 'rings') return { harbour: 'Fly the seven harbour rings', silverrun: 'Fly the ten Silverrun gates', lantern: 'Fly the seven lantern rings' }[step.course];
  if (step.type === 'fly-to') return 'Navigate to Ostmere Strip';
  if (step.type === 'land') return `Land at ${step.airfield === 'ostmere' ? 'Ostmere Strip' : 'Halloway Field'} and stop on the runway`;
  return 'Explore, then land anywhere to log the flight';
}

export function createScreens(root, onAction) {
  root.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (button) onAction(button.dataset.action, button.dataset);
  });
  root.addEventListener('input', (e) => {
    const field = e.target.closest('[data-setting]');
    if (field) onAction('setting', { name: field.dataset.setting, value: field.type === 'checkbox' ? field.checked : Number(field.value) });
  });
  const show = (html) => {
    root.innerHTML = html;
    root.querySelector('.primary, .mission-card')?.focus({ preventScroll: true });
  };

  return {
    hide() {
      root.innerHTML = '';
    },
    title(progress) {
      const cards = MISSIONS.map((m) => `
        <button class="mission-card" data-action="brief" data-mission="${m.id}">
          <span class="sky-badge sky-${m.sky}">${SKY_ICONS[m.sky]}</span>
          <span><strong>${escape(m.title)}</strong><em>${escape(m.tagline)}</em></span>
          <span class="record">${progress[m.id]?.score ? `<b>${progress[m.id].score}</b>` : ''}${medalBadge(progress[m.id]?.medal)}</span>
        </button>`).join('');
      show(`<div class="screen title">
        <header class="logo"><h1>SKERRY<span>WIND</span></h1><p>Island Air Courier</p></header>
        <nav class="missions" aria-label="Missions">${cards}</nav>
        <footer class="title-footer"><button class="ghost" data-action="help">How to fly</button><button class="ghost" data-action="settings">Settings</button><span>Keyboard &amp; mouse</span></footer>
        <div class="tagline-strip">Saltrunner SR-2 · The Skerrywind Isles</div>
      </div>`);
    },
    briefing(mission, routeKm = null) {
      show(`<div class="screen centre"><div class="card panel">
        <h3>Briefing</h3><h2>${escape(mission.title)}</h2>
        <p>${escape(mission.brief)}</p>
        <div class="facts"><span class="fact">Sky <b>${escape(mission.sky)}</b></span><span class="fact">Wind <b>${describeWind(mission.wind)}</b></span><span class="fact">Fuel <b>${Math.round(mission.fuel * 100)}%</b></span>${routeKm ? `<span class="fact">Route <b>${routeKm.toFixed(1)} km</b></span>` : ''}${mission.par ? `<span class="fact">Par <b>${Math.floor(mission.par / 60)}:${String(mission.par % 60).padStart(2, '0')}</b></span>` : ''}</div>
        <h3>Objectives</h3><ol class="steps">${mission.steps.map((s) => `<li>${escape(describeStep(s))}</li>`).join('')}</ol>
        <div class="actions"><button class="primary" data-action="fly">TAKE OFF</button><button class="ghost" data-action="help">How to fly</button><button class="ghost" data-action="title">Back</button></div>
      </div></div>`);
    },
    pause() {
      show(`<div class="screen centre"><div class="card panel">
        <h3>Paused</h3><h2>Holding</h2>
        <div class="actions"><button class="primary" data-action="resume">RESUME</button><button class="ghost" data-action="restart">Restart</button><button class="ghost" data-action="help">How to fly</button><button class="ghost" data-action="settings">Settings</button><button class="ghost" data-action="title">Missions</button></div>
      </div></div>`);
    },
    help(back) {
      show(`<div class="screen centre"><div class="card panel">
        <h3>How to fly</h3><h2>Saltrunner SR-2</h2>
        <table class="controls-table">${CONTROL_HELP.map(([k, d]) => `<tr><td>${escape(k)}</td><td>${escape(d)}</td></tr>`).join('')}</table>
        <p>Rotate at 55 kt. Cruise at 100 kt with about 65% throttle. Stall comes at 50 kt clean, 44 kt with full flaps. On final, fly 60–65 kt with full flaps and keep two white and two red lights on the PAPI beside the runway. Flare gently: under 380 ft/min is a smooth landing.</p>
        <div class="actions"><button class="primary" data-action="${back}">BACK</button></div>
      </div></div>`);
    },
    settings(s, back) {
      show(`<div class="screen centre"><div class="card panel">
        <h3>Settings</h3><h2>Cockpit</h2>
        <label class="setting-row">Flight assist (holds bank and climb when you let go)<input type="checkbox" data-setting="assist" ${s.assist ? 'checked' : ''}></label>
        <label class="setting-row">Invert pitch (W pulls the nose up)<input type="checkbox" data-setting="invertPitch" ${s.invertPitch ? 'checked' : ''}></label>
        <label class="setting-row">Mouse sensitivity<input type="range" min="0.4" max="2" step="0.1" value="${s.mouseSensitivity}" data-setting="mouseSensitivity"></label>
        <label class="setting-row">Volume<input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-setting="volume"></label>
        <label class="setting-row">HUD size<input type="range" min="0.8" max="1.4" step="0.05" value="${s.hudScale}" data-setting="hudScale"></label>
        <div class="actions"><button class="primary" data-action="${back}">DONE</button></div>
      </div></div>`);
    },
    results(mission, card, failed, reason, next) {
      const rows = card.lines.map(([a, b, p]) => `<tr><td>${escape(a)}</td><td>${escape(b)}</td><td>${p > 0 ? '+' : ''}${p}</td></tr>`).join('');
      show(`<div class="screen results"><div class="result-card panel ${failed ? 'failed' : 'complete'}">
        <div class="result-head">${failed ? '' : medalBadge(card.medal, true)}
          <div><div class="sub">${escape(mission.title)}</div><h2>${failed ? 'MISSION FAILED' : 'MISSION COMPLETE'}</h2></div>
          ${card.grade ? `<div class="grade">${card.grade}<small>LANDING</small></div>` : ''}
        </div>
        ${failed ? `<div class="reason">${escape(reason)}</div>` : `${card.plot ? landingPlot(card.plot) : ''}<table class="score-table">${rows}</table><div class="score-total"><span>Total${card.medal ? ` · ${card.medal} medal` : ''}</span><span>${card.total}</span></div>`}
        <div class="actions"><button class="primary" data-action="restart">FLY AGAIN</button>${next ? `<button class="ghost" data-action="brief" data-mission="${next.id}">Next: ${escape(next.title)}</button>` : ''}<button class="ghost" data-action="title">Missions</button></div>
      </div></div>`);
    },
  };
}
