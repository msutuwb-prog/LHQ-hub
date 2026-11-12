/* LHQ Hub › marks charts: weekly assessments over time and SRA scores by topic and review.
   Used by the student's and parent's Progress (from the family data) and LHQ's Marks tab on a student's page (from the logs).
   One series per chart (no legend); SRA cells on one-hue steps, light = low, dark = high, with the number in each cell. */
window.MARKS = (function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dl = d => +d.slice(8) + ' ' + MON[+d.slice(5, 7) - 1];
  /* assessment types: Weekly, Monthly, Past paper (older Topical counts as Weekly, Mock as Past paper) */
  const akN = k => k === 't' ? 'w' : k === 'k' ? 'p' : (k || 'w');
  /* the ARS before an SRA: its % (score out of the topic's objectives), -1 when no ARS was handed in */
  const arsPc = e => e.na ? -1 : Number(e.ao) > 0 && e.ars != null && e.ars !== '' ? Math.max(0, Math.min(100, Math.round(+e.ars / +e.ao * 100))) : -1;
  const pc = e => Number(e.mx) > 0 && e.sc != null && e.sc !== '' && !isNaN(+e.sc) ? Math.max(0, Math.min(100, Math.round(+e.sc / +e.mx * 100))) : null;
  /* from log entries (LHQ's side) to the same shape the family data sends: {w:[{sub,d,p}], r:[{sub,tk,rv,p,d}]} */
  function fromEntries(E){
    return {
      w: E.filter(e => e && !e.x && e.ty === 'w' && !e.abs && pc(e) != null).map(e => ({sub: e.sub, d: e.d, p: pc(e), ak: akN(e.ak)})),
      r: E.filter(e => e && !e.x && e.ty === 'r' && e.tk && pc(e) != null).map(e => ({sub: e.sub, tk: e.tk, rv: +e.rv || 0, p: pc(e), d: e.d, a: arsPc(e)})),
    };
  }
  /* per subject: weekly results in date order, the latest and the change, and each topic's reviews R1–R5 */
  function bySubject(M){
    const subs = [...new Set((M.w || []).map(x => x.sub).concat((M.r || []).map(x => x.sub)))].sort();
    return subs.map(sub => {
      const w = (M.w || []).filter(x => x.sub === sub).sort((a, b) => a.d.localeCompare(b.d)).slice(-12);
      /* a cell: the tutor's mark (a number), a self-marked take-home sheet ({p, self}), or a sheet still at home ('P'); the tutor's mark wins */
      /* a cell per review, Learning Day to R5: {p, a} the tutor's SRA % and the ARS % (-1 none), {p, self} self-marked, {pk} still at home in the pack */
      const T = {}, row = tk => (T[tk] = T[tk] || [null, null, null, null, null, null]);
      (M.p || []).filter(x => x.sub === sub && x.rv >= 0 && x.rv <= 5).forEach(x => { const r = row(x.tk); if(r[x.rv] == null) r[x.rv] = {pk: 1}; });
      (M.r || []).filter(x => x.sub === sub && x.rv >= 0 && x.rv <= 5).sort((a, b) => (a.self ? 0 : 1) - (b.self ? 0 : 1) || a.d.localeCompare(b.d)).forEach(x => { row(x.tk)[x.rv] = x.self ? {p: x.p, self: 1} : {p: x.p, a: x.a == null ? -1 : x.a}; });
      const last = w.length ? w[w.length - 1].p : null, prev = w.length > 1 ? w[w.length - 2].p : null;
      return {sub, w, last, diff: last != null && prev != null ? last - prev : null, sra: Object.entries(T).slice(-8)};
    });
  }
  function spark(w, W = 90, H = 28){
    if(w.length < 2) return '';
    const a = w.map(x => x.p), mn = Math.min(...a) - 5, mx = Math.max(...a) + 5, X = i => 3 + i / (a.length - 1) * (W - 6), Y = v => H - 3 - (v - mn) / (mx - mn || 1) * (H - 6);
    return `<svg class="mk-sp" width="${W}" height="${H}" aria-hidden="true"><path d="${a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(a.length - 1)}" cy="${Y(a[a.length - 1])}" r="3" fill="var(--accent)"/></svg>`;
  }
  /* assessment types: a point shape each (one colour: one subject is one series) */
  const TY = {w:'Weekly', m:'Monthly', p:'Past paper'};
  const shp = (ty, x, y, r = 4.5) => ty === 'm' ? `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="1.5"/>` : ty === 't' ? `<path d="M${x} ${y - r - 1.5}L${x + r + 1.5} ${y}L${x} ${y + r + 1.5}L${x - r - 1.5} ${y}Z"/>`
    : ty === 'k' ? `<path d="M${x} ${y - r - 1}L${x + r + 1} ${y + r}L${x - r - 1} ${y + r}Z"/>` : ty === 'p' ? `<path d="M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}" stroke-width="2.6" stroke-linecap="round"/>` : `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  const ico = (ty, n = 13) => `<svg width="${n}" height="${n}" viewBox="0 0 14 14" aria-hidden="true"><g fill="var(--accent)" stroke="var(--accent)" stroke-width="0">${shp(ty, 7, 7, 4)}</g></svg>`;
  const types = s => [...new Set((s.w || []).map(x => akN(x.ak)))];
  /* each type's average, shown when there is more than one type */
  function avgs(s){
    const T = types(s); if(T.length < 2) return '';
    return `<div class="mk-key">${Object.keys(TY).filter(k => T.includes(k)).map(k => `<span>${ico(k)}${TY[k]}</span>`).join('')}</div><div class="mk-avg">${Object.keys(TY).filter(k => T.includes(k)).map(k => { const L = s.w.filter(x => akN(x.ak) === k); return `<div><small>${ico(k, 11)} ${TY[k]}</small><b>${Math.round(L.reduce((a, x) => a + x.p, 0) / L.length)}%</b></div>`; }).join('')}</div>`;
  }
  /* one line, 0–100%; a point for each assessment (its type's shape) with its date, type and score on hover or tap */
  function line(s, W = 340, H = 170){
    const w = s.w; if(!w.length) return '<p class="mk-none">No weekly assessments marked yet.</p>';
    const L = 30, R = 12, T = 14, B = 22, n = w.length, X = i => n === 1 ? (L + W - R) / 2 : L + i / (n - 1) * (W - L - R), Y = v => T + (100 - v) / 100 * (H - T - B);
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line2)"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`).join('');
    const xi = n === 1 ? [0] : [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
    const xl = xi.map(i => `<text x="${X(i)}" y="${H - 6}" text-anchor="${n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" font-size="10" fill="var(--muted)">${dl(w[i].d)}</text>`).join('');
    const path = w.map((x, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x.p).toFixed(1)).join('');
    const hit = Math.max(16, (W - L - R) / Math.max(1, n - 1));
    const dots = w.map((x, i) => `<g><title>${dl(x.d)} · ${TY[akN(x.ak)]} · ${x.p}%</title><g fill="var(--accent)" stroke="${akN(x.ak) === 'p' ? 'var(--accent)' : 'var(--surface)'}" stroke-width="${akN(x.ak) === 'p' ? 2.6 : 1.5}">${shp(akN(x.ak), X(i), Y(x.p))}</g><rect x="${X(i) - hit / 2}" y="${T}" width="${hit}" height="${H - T - B}" fill="transparent"/></g>`).join('');
    const lx = X(n - 1), ly = Y(w[n - 1].p);
    return `<svg class="mk-ln" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(s.sub)} assessments">${grid}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}<text x="${lx - 8}" y="${ly - 10}" text-anchor="end" font-size="12" font-weight="800" fill="var(--ink)">${w[n - 1].p}%</text>${xl}</svg>`;
  }
  const step = v => v >= 85 ? 5 : v >= 70 ? 4 : v >= 55 ? 3 : v >= 40 ? 2 : 1;
  /* SRAs card: ARS average · SRA average · ARS with SRA (tap one), as a grid or a graph (not for ARS with SRA) */
  const ST = {}, CACHE = {}, HDR = ['LD', 'R1', 'R2', 'R3', 'R4', 'R5'], TCOL = ['#2f6fdf', '#d68a00', '#0f9b8e', '#c03dbb', '#7a5af8', '#e5484d', '#5b8c00', '#8a6d3b'];
  const mean = L => L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : null;
  const stats = s => { const C = s.sra.flatMap(([, a]) => a).filter(c => c && c.p != null && !c.self), A = C.filter(c => c.a >= 0);
    return {ars: mean(A.map(c => c.a)), sra: mean(C.map(c => c.p)), k: A.length, n: C.length}; };
  const ICG = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5.5" height="5.5" rx="1"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1"/><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1"/></svg>';
  const ICL = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17l5-4 4 2 7-10"/></svg>';
  function cellH(c, m, tp, i){
    const lab = `${esc(tp)} · ${HDR[i] === 'LD' ? 'Learning Day' : 'review ' + i}`;
    if(!c) return '<td class="no">–</td>';
    if(c.pk) return `<td class="pk" title="${lab} · in the take-home pack">P</td>`;
    if(c.self) return m === 'sra' ? `<td class="sm" title="${lab} · ${c.p}% · self-marked, not in averages">${c.p}</td>` : `<td class="no" title="${lab} · self-marked">·</td>`;
    if(m === 'both') return c.a >= 0 ? `<td class="bo" title="${lab} · ARS and SRA">✓</td>` : `<td class="so" title="${lab} · SRA only, no ARS">SRA</td>`;
    const v = m === 'ars' ? c.a : c.p;
    return v >= 0 ? `<td class="s${step(v)}" title="${lab} · ${m === 'ars' ? 'ARS' : 'SRA'} ${v}%">${v}</td>` : `<td class="no" title="${lab} · no ARS">–</td>`;
  }
  function graphH(s, m){
    const W = 340, H = 170, L = 30, R = 12, T = 12, B = 22, X = i => L + i * (W - L - R) / 5, Y = v => T + (100 - v) / 100 * (H - T - B);
    const gl = [0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line2)"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`).join('');
    const xl = HDR.map((h, i) => `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--muted)">${h}</text>`).join('');
    const lines = s.sra.map(([tp, a], t) => { const P = a.map((c, i) => { const v = c && !c.pk && !c.self ? (m === 'ars' ? c.a : c.p) : null; return v != null && v >= 0 ? [X(i), Y(v), v, i] : null; }).filter(Boolean), col = TCOL[t % TCOL.length];
      return (P.length > 1 ? `<path d="${P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('')}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>` : '') + P.map(p => `<g><title>${esc(tp)} · ${HDR[p[3]]} · ${p[2]}%</title><circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${col}" stroke="var(--surface)" stroke-width="1.5"/></g>`).join(''); }).join('');
    return `<svg class="mk-ln" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(s.sub)} ${m === 'ars' ? 'ARS recall' : 'SRA marks'} by review">${gl}${xl}${lines}</svg>
      <div class="mk-lg">${s.sra.map(([tp], t) => `<span><i style="background:${TCOL[t % TCOL.length]}"></i>${esc(tp)}</span>`).join('')}</div>`;
  }
  function inner(s){
    const st = ST[s.sub] || (ST[s.sub] = {m: 'ars', v: 'grid'}), m = st.m, x = stats(s), key = encodeURIComponent(s.sub);
    const tiles = `<div class="mk-t3">${[['ars', 'ARS average', x.ars != null ? x.ars + '%' : '–'], ['sra', 'SRA average', x.sra != null ? x.sra + '%' : '–'], ['both', 'ARS with SRA', x.n ? `${x.k} of ${x.n}` : '–']].map(([k, l, v]) => `<button type="button" class="${m === k ? 'on' : ''}" data-mkm="${key}|${k}" aria-pressed="${m === k}"><span>${l}</span><b>${v}</b></button>`).join('')}</div>`;
    const head = `<div class="mk-hd"><b>${m === 'ars' ? 'ARS recall' : m === 'sra' ? 'SRA marks' : 'Handed in'}</b>${m === 'both' ? '' : `<span class="seg sm mk-vw">${[['grid', ICG, 'Grid'], ['graph', ICL, 'Graph']].map(([k, ic, l]) => `<button type="button" class="${st.v === k ? 'on' : ''}" data-mkv="${key}|${k}" aria-label="${l}" title="${l}">${ic}</button>`).join('')}</span>`}</div>`;
    const body = m !== 'both' && st.v === 'graph' ? graphH(s, m)
      : `<table class="mk-g"><tr><th>Topic</th>${HDR.map(h => `<th>${h}</th>`).join('')}</tr>${s.sra.map(([tp, a]) => `<tr><td class="tp" title="${esc(tp)}">${esc(tp)}</td>${a.map((c, i) => cellH(c, m, tp, i)).join('')}</tr>`).join('')}</table>
      ${m === 'both' ? '<div class="mk-sc"><i class="bo"></i> ARS and SRA <i class="so"></i> SRA only · – not yet</div>' : `<div class="mk-sc">Low <i class="s1"></i><i class="s2"></i><i class="s3"></i><i class="s4"></i><i class="s5"></i> High · – ${m === 'ars' ? 'no ARS or ' : ''}not yet</div>`}
      ${m === 'sra' && s.sra.some(([, a]) => a.some(c => c && (c.pk || c.self))) ? '<div class="mk-sc"><i class="sm"></i> Self-marked · not in averages <i class="pk"></i> P · in the take-home pack</div>' : ''}`;
    return tiles + head + body;
  }
  function grid(s){
    if(!s.sra.length) return '<p class="mk-none">No SRA marks yet.</p>';
    CACHE[s.sub] = s; return `<div data-mkc="${encodeURIComponent(s.sub)}">${inner(s)}</div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-mkm],[data-mkv]'); if(!b) return;
    const [key, v] = (b.dataset.mkm || b.dataset.mkv).split('|'), sub = decodeURIComponent(key), st = ST[sub] || (ST[sub] = {m: 'ars', v: 'grid'});
    if(b.dataset.mkm) st.m = v; else st.v = v;
    const s = CACHE[sub], box = b.closest('[data-mkc]'); if(s && box) box.innerHTML = inner(s); });
  const change = d => d == null ? '' : `<small class="${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}</small>`;
  const css = document.createElement('style');
  css.textContent = `:root{--mk1:#e3ebf5;--mk2:#b9cde6;--mk3:#7fa3cf;--mk4:#3f73ae;--mk5:#0b3f7a}
[data-theme=dark]{--mk1:#1f2b3b;--mk2:#2f4d73;--mk3:#4a77ab;--mk4:#79a5d8;--mk5:#b9d3f1}
.mk-ln text{font-family:inherit}.mk-key{display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--muted);margin-top:6px}.mk-key svg{vertical-align:-2px;margin-right:3px}
.mk-avg{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:6px;margin-top:8px}.mk-avg div{background:var(--bg);border-radius:9px;padding:6px 8px}.mk-avg small{display:block;color:var(--muted);font-size:11px;font-weight:700;white-space:nowrap}.mk-avg b{font-size:16px;color:var(--brand,var(--accent))}.mk-none{color:var(--muted);font-size:13px;margin:6px 0}
.mk-g{border-collapse:separate;border-spacing:2px;width:100%;font-size:12px;font-variant-numeric:tabular-nums;table-layout:fixed}
.mk-g th{font-size:10.5px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:2px}
.mk-g th:first-child{text-align:left;width:32%}
.mk-g td{height:30px;border-radius:5px;text-align:center;font-weight:700}
.mk-g td.tp{text-align:left;color:var(--ink);padding-right:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-g td.no{color:var(--muted);font-weight:600;box-shadow:inset 0 0 0 1px var(--line2)}
.mk-g .s1{background:var(--mk1);color:var(--ink)}.mk-g .s2{background:var(--mk2);color:#14213d}.mk-g .s3{background:var(--mk3);color:#14213d}.mk-g .s4{background:var(--mk4);color:#fff}.mk-g .s5{background:var(--mk5);color:#fff}
[data-theme=dark] .mk-g .s3{color:#fff}[data-theme=dark] .mk-g .s4,[data-theme=dark] .mk-g .s5{color:#0d1420}[data-theme=dark] .mk-g .s2{color:#e8edf4}
.mk-sc{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);margin-top:8px}.mk-sc i{width:20px;height:10px;border-radius:3px;display:inline-block;background:var(--mk1)}
.mk-g td.sm,.mk-sc i.sm{background:repeating-linear-gradient(135deg,var(--surface) 0 4px,var(--line2) 4px 8px);color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--am)}
.mk-g td.pk{color:var(--muted);box-shadow:inset 0 0 0 1px var(--muted);background:none}.mk-sc i.pk{background:none;box-shadow:inset 0 0 0 1px var(--muted)}
.mk-g td.bo,.mk-sc i.bo{background:var(--ok-bg,#e3f4ea);color:var(--ok)}.mk-g td.so,.mk-sc i.so{background:#f3d38a;color:#5a3d00;font-size:10px}
.mk-t3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:12px}.mk-t3 button{background:var(--surface);border:1.5px solid var(--line);border-radius:12px;padding:8px 10px;text-align:left;font:inherit;color:var(--ink);cursor:pointer;min-width:0}
.mk-t3 button span{display:block;font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mk-t3 button b{font-size:18px;font-variant-numeric:tabular-nums;white-space:nowrap}
.mk-t3 button.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.mk-t3 button.on span{color:var(--accent)}
.mk-hd{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;min-height:34px}.mk-vw{margin:0!important;display:inline-flex!important}.mk-vw button{display:inline-flex;align-items:center;justify-content:center;min-width:40px;padding:5px 10px!important}
.mk-lg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--muted);margin-top:4px}.mk-lg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}
.mk-sc .s2{background:var(--mk2)}.mk-sc .s3{background:var(--mk3)}.mk-sc .s4{background:var(--mk4)}.mk-sc .s5{background:var(--mk5)}
.mk-big{font-size:20px;font-weight:800;color:var(--brand,var(--accent));font-variant-numeric:tabular-nums;text-align:right;line-height:1.1;white-space:nowrap}
.mk-big small{display:block;font-size:11.5px;font-weight:700;color:var(--muted)}.mk-big small.up{color:var(--ok)}.mk-big small.dn{color:var(--am)}
.mk-cards{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
@container (min-width:560px){.mk-cards{grid-template-columns:repeat(min(var(--n,2),2),minmax(0,1fr))}}
@container (min-width:860px){.mk-cards{grid-template-columns:repeat(var(--c,3),minmax(0,1fr))}}`;
  document.head.appendChild(css);
  /* balanced columns on wide screens: 4 subjects sit 2 × 2, never 3 + 1 */
  const cols = n => `--n:${n};--c:${n <= 3 ? n : n === 4 ? 2 : 3}`;
  return {akN, fromEntries, bySubject, spark, line, grid, change, pc, cols, avgs, ico, TY};
})();
