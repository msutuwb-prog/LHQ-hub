/* LHQ Hub › a sound for each kind of alert, while LHQ Hub is open (with it closed, the phone's own notification sound plays).
   Made in the browser, so nothing to download. Each person picks per alert, or Off; ▶ to hear it. */
window.SOUNDS = (function(){
  const TONES = {chime: ['Soft chime', [880, 1320], .18, 'sine'], ping2: ['Double ping', [1200, 0, 1200], .1, 'triangle'], bell: ['Bell', [660, 990, 1320], .22, 'sine'],
    rise: ['Rising notes', [523, 659, 784, 1047], .12, 'sine'], ping: ['Single ping', [1050], .15, 'triangle'], gong: ['Gentle gong', [220, 330], .5, 'sine'], tick2: ['Two ticks', [2000, 0, 2000], .04, 'square']};
  const ALERTS = [['sra', 'SRA days', 'chime'], ['handin', 'Hand-in days', 'ping2'], ['sreport', 'Daily report', 'bell'], ['report', 'Daily report', 'bell'], ['assess', 'Assessments and countdowns', 'rise'], ['change', 'Session changes', 'ping'],
    ['answer', 'Your tutor answered', 'ping'], ['block', 'Study blocks', 'rise'], ['focus', 'Focus round over', 'gong'], ['brk', 'Break over', 'tick2'], ['notice', 'Absent or late', 'ping'], ['decided', 'Decisions', 'ping'], ['dispute', 'Not right on a session', 'ping2']];
  const role = () => ((((window.hub && hub.session && hub.session()) || {}).me) || {}).role || '';
  const mine = () => role() === 'tutor' ? ['notice', 'decided', 'dispute', 'report'] : role() === 'parent' ? ['sra', 'change', 'answer', 'assess'] : role() === 'student' ? ['sra', 'handin', 'sreport', 'assess', 'change', 'answer', 'block', 'focus', 'brk'] : ['notice', 'dispute', 'decided'];
  const prefs = () => { try{ return JSON.parse(localStorage.getItem('lhq_sounds') || '{}'); }catch(e){ return {}; } };
  const toneOf = k => { const p = prefs()[k]; return p === 'off' ? null : TONES[p] ? p : ((ALERTS.find(a => a[0] === k) || [0, 0, 'ping'])[2]); };
  let AC = null;
  function tone(name){ const t = TONES[name]; if(!t) return; try{ AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if(AC.state === 'suspended') AC.resume();
    let at = AC.currentTime + .02; t[1].forEach(f => { if(f){ const o = AC.createOscillator(), g = AC.createGain(); o.type = t[3]; o.frequency.value = f; g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(.22, at + .01); g.gain.exponentialRampToValueAtTime(.0001, at + t[2] * 1.8); o.connect(g).connect(AC.destination); o.start(at); o.stop(at + t[2] * 2); } at += t[2]; }); }catch(e){} }
  const play = kind => { const n = toneOf(kind); if(n) tone(n); };
  /* a notification arriving while LHQ Hub is open */
  if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if(e.data && e.data.type === 'lhq-push') play(e.data.kind); });
  function page(back){
    const P = prefs();
    return `<a class="crumb" href="${back || '#me/reminders'}">‹ ${back ? 'Notifications' : 'Reminders'}</a><div class="ph"><div class="tt"><h1>Sounds</h1><p>While LHQ Hub is open</p></div></div>
      <div class="card">${mine().map(k => { const a = ALERTS.find(x => x[0] === k), n = toneOf(k); return `<div class="it"><span class="t"><b>${a[1]}</b><small>${n ? TONES[n][0] : 'Off'}</small></span>${n ? `<button type="button" class="snd-p" data-sndp="${n}" aria-label="Play">▶</button>` : ''}<button type="button" class="btn sm" data-snd="${k}">Change</button></div>`; }).join('')}</div>
      <p class="note">With LHQ Hub closed, the phone's own notification sound plays. Quiet hours: <a href="#set/notifications">Notifications</a>.</p>`;
  }
  function pick(k){
    const cur = prefs()[k] || toneOf(k) || 'off', a = ALERTS.find(x => x[0] === k);
    openSheet(`<div class="hx"><h3>${a[1]}</h3><button class="ib" data-close>✕</button></div><div class="card">${Object.entries(TONES).map(([n, t]) => `<div class="it"><button type="button" class="tk" data-sndset="${k}|${n}" style="flex:1"><span class="f-mk ${cur === n ? 'ok' : ''}">${cur === n ? '✓' : ''}</span>${t[0]}</button><button type="button" class="snd-p" data-sndp="${n}" aria-label="Play">▶</button></div>`).join('')}
      <div class="it"><button type="button" class="tk" data-sndset="${k}|off" style="flex:1"><span class="f-mk ${cur === 'off' ? 'ok' : ''}">${cur === 'off' ? '✓' : ''}</span>Off</button></div></div>`);
    bind();
  }
  function bind(){
    document.querySelectorAll('[data-sndp]').forEach(b => b.onclick = () => tone(b.dataset.sndp));
    document.querySelectorAll('[data-snd]').forEach(b => b.onclick = () => pick(b.dataset.snd));
    document.querySelectorAll('[data-sndset]').forEach(b => b.onclick = () => { const [k, n] = b.dataset.sndset.split('|'), P = prefs(); P[k] = n; try{ localStorage.setItem('lhq_sounds', JSON.stringify(P)); }catch(e){} if(n !== 'off') tone(n); closeSheet(); render(); });
    if(!document.getElementById('sndCss')){ const s = document.createElement('style'); s.id = 'sndCss'; s.textContent = '.snd-p{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--surface);cursor:pointer;color:var(--accent);font-size:12px;flex:none;margin-right:6px}'; document.head.appendChild(s); }
  }
  return {play, tone, page, bind, TONES};
})();
