/* LHQ Hub › marks charts: weekly assessments over time and SRA scores by topic and review.
   Used by the student's and parent's Progress (from the family data) and LHQ's Marks tab on a student's page (from the logs).
   One series per chart (no legend); SRA cells on one-hue steps, light = low, dark = high, with the number in each cell. */
window.MARKS = (function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dl = d => +d.slice(8) + ' ' + MON[+d.slice(5, 7) - 1];
  const pc = e => Number(e.mx) > 0 && e.sc != null && e.sc !== '' && !isNaN(+e.sc) ? Math.max(0, Math.min(100, Math.round(+e.sc / +e.mx * 100))) : null;
  /* from log entries (LHQ's side) to the same shape the family data sends: {w:[{sub,d,p}], r:[{sub,tk,rv,p,d}]} */
  function fromEntries(E){
    return {
      w: E.filter(e => e && !e.x && e.ty === 'w' && !e.abs && pc(e) != null).map(e => ({sub: e.sub, d: e.d, p: pc(e)})),
      r: E.filter(e => e && !e.x && e.ty === 'r' && e.tk && pc(e) != null).map(e => ({sub: e.sub, tk: e.tk, rv: +e.rv || 0, p: pc(e), d: e.d})),
    };
  }
  /* per subject: weekly results in date order, the latest and the change, and each topic's reviews R1–R5 */
  function bySubject(M){
    const subs = [...new Set((M.w || []).map(x => x.sub).concat((M.r || []).map(x => x.sub)))].sort();
    return subs.map(sub => {
      const w = (M.w || []).filter(x => x.sub === sub).sort((a, b) => a.d.localeCompare(b.d)).slice(-12);
      /* a cell: the tutor's mark (a number), a self-marked take-home sheet ({p, self}), or a sheet still at home ('P'); the tutor's mark wins */
      const T = {}, row = tk => (T[tk] = T[tk] || [null, null, null, null, null]);
      (M.p || []).filter(x => x.sub === sub && x.rv >= 1 && x.rv <= 5).forEach(x => { const r = row(x.tk); if(r[x.rv - 1] == null) r[x.rv - 1] = 'P'; });
      (M.r || []).filter(x => x.sub === sub && x.rv >= 1 && x.rv <= 5).sort((a, b) => (a.self ? 0 : 1) - (b.self ? 0 : 1) || a.d.localeCompare(b.d)).forEach(x => { row(x.tk)[x.rv - 1] = x.self ? {p: x.p, self: 1} : x.p; });
      const last = w.length ? w[w.length - 1].p : null, prev = w.length > 1 ? w[w.length - 2].p : null;
      return {sub, w, last, diff: last != null && prev != null ? last - prev : null, sra: Object.entries(T).slice(-8)};
    });
  }
  function spark(w, W = 90, H = 28){
    if(w.length < 2) return '';
    const a = w.map(x => x.p), mn = Math.min(...a) - 5, mx = Math.max(...a) + 5, X = i => 3 + i / (a.length - 1) * (W - 6), Y = v => H - 3 - (v - mn) / (mx - mn || 1) * (H - 6);
    return `<svg class="mk-sp" width="${W}" height="${H}" aria-hidden="true"><path d="${a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(a.length - 1)}" cy="${Y(a[a.length - 1])}" r="3" fill="var(--accent)"/></svg>`;
  }
  /* one line, 0–100%; a dot for each assessment with its date and score on hover or tap */
  function line(s, W = 340, H = 170){
    const w = s.w; if(!w.length) return '<p class="mk-none">No weekly assessments marked yet.</p>';
    const L = 30, R = 12, T = 14, B = 22, n = w.length, X = i => n === 1 ? (L + W - R) / 2 : L + i / (n - 1) * (W - L - R), Y = v => T + (100 - v) / 100 * (H - T - B);
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line2)"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`).join('');
    const xi = n === 1 ? [0] : [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
    const xl = xi.map(i => `<text x="${X(i)}" y="${H - 6}" text-anchor="${n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" font-size="10" fill="var(--muted)">${dl(w[i].d)}</text>`).join('');
    const path = w.map((x, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x.p).toFixed(1)).join('');
    const hit = Math.max(16, (W - L - R) / Math.max(1, n - 1));
    const dots = w.map((x, i) => `<g><title>${dl(x.d)} · ${x.p}%</title><circle cx="${X(i)}" cy="${Y(x.p)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/><rect x="${X(i) - hit / 2}" y="${T}" width="${hit}" height="${H - T - B}" fill="transparent"/></g>`).join('');
    const lx = X(n - 1), ly = Y(w[n - 1].p);
    return `<svg class="mk-ln" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(s.sub)} weekly assessments">${grid}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}<text x="${lx - 8}" y="${ly - 10}" text-anchor="end" font-size="12" font-weight="800" fill="var(--ink)">${w[n - 1].p}%</text>${xl}</svg>`;
  }
  const step = v => v >= 85 ? 5 : v >= 70 ? 4 : v >= 55 ? 3 : v >= 40 ? 2 : 1;
  function grid(s){
    if(!s.sra.length) return '<p class="mk-none">No SRA marks yet.</p>';
    return `<table class="mk-g"><tr><th>Topic</th>${[1, 2, 3, 4, 5].map(r => `<th>R${r}</th>`).join('')}</tr>${s.sra.map(([tp, a]) => `<tr><td class="tp" title="${esc(tp)}">${esc(tp)}</td>${a.map((v, i) => v == null ? '<td class="no">–</td>' : v === 'P' ? `<td class="pk" title="${esc(tp)} · review ${i + 1} · in the take-home pack">P</td>` : v.self ? `<td class="sm" title="${esc(tp)} · review ${i + 1} · ${v.p}% · self-marked, not in averages">${v.p}</td>` : `<td class="s${step(v)}" title="${esc(tp)} · review ${i + 1} · ${v}%">${v}</td>`).join('')}</tr>`).join('')}</table>
    <div class="mk-sc">Low <i class="s1"></i><i class="s2"></i><i class="s3"></i><i class="s4"></i><i class="s5"></i> High · – not yet</div>${s.sra.some(([, a]) => a.some(v => v === 'P' || (v && v.self))) ? '<div class="mk-sc"><i class="sm"></i> Self-marked · not in averages <i class="pk"></i> P · in the take-home pack</div>' : ''}`;
  }
  const change = d => d == null ? '' : `<small class="${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}</small>`;
  const css = document.createElement('style');
  css.textContent = `:root{--mk1:#e3ebf5;--mk2:#b9cde6;--mk3:#7fa3cf;--mk4:#3f73ae;--mk5:#0b3f7a}
[data-theme=dark]{--mk1:#1f2b3b;--mk2:#2f4d73;--mk3:#4a77ab;--mk4:#79a5d8;--mk5:#b9d3f1}
.mk-ln text{font-family:inherit}.mk-none{color:var(--muted);font-size:13px;margin:6px 0}
.mk-g{border-collapse:separate;border-spacing:2px;width:100%;font-size:12px;font-variant-numeric:tabular-nums;table-layout:fixed}
.mk-g th{font-size:10.5px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:2px}
.mk-g th:first-child{text-align:left;width:38%}
.mk-g td{height:30px;border-radius:5px;text-align:center;font-weight:700}
.mk-g td.tp{text-align:left;color:var(--ink);padding-right:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-g td.no{color:var(--muted);font-weight:600;box-shadow:inset 0 0 0 1px var(--line2)}
.mk-g .s1{background:var(--mk1);color:var(--ink)}.mk-g .s2{background:var(--mk2);color:#14213d}.mk-g .s3{background:var(--mk3);color:#14213d}.mk-g .s4{background:var(--mk4);color:#fff}.mk-g .s5{background:var(--mk5);color:#fff}
[data-theme=dark] .mk-g .s3{color:#fff}[data-theme=dark] .mk-g .s4,[data-theme=dark] .mk-g .s5{color:#0d1420}[data-theme=dark] .mk-g .s2{color:#e8edf4}
.mk-sc{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);margin-top:8px}.mk-sc i{width:20px;height:10px;border-radius:3px;display:inline-block;background:var(--mk1)}
.mk-g td.sm,.mk-sc i.sm{background:repeating-linear-gradient(135deg,var(--surface) 0 4px,var(--line2) 4px 8px);color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--am)}
.mk-g td.pk{color:var(--muted);box-shadow:inset 0 0 0 1px var(--muted);background:none}.mk-sc i.pk{background:none;box-shadow:inset 0 0 0 1px var(--muted)}
.mk-sc .s2{background:var(--mk2)}.mk-sc .s3{background:var(--mk3)}.mk-sc .s4{background:var(--mk4)}.mk-sc .s5{background:var(--mk5)}
.mk-big{font-size:20px;font-weight:800;color:var(--brand,var(--accent));font-variant-numeric:tabular-nums;text-align:right;line-height:1.1;white-space:nowrap}
.mk-big small{display:block;font-size:11.5px;font-weight:700;color:var(--muted)}.mk-big small.up{color:var(--ok)}.mk-big small.dn{color:var(--am)}
.mk-cards{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
@container (min-width:560px){.mk-cards{grid-template-columns:repeat(min(var(--n,2),2),minmax(0,1fr))}}
@container (min-width:860px){.mk-cards{grid-template-columns:repeat(var(--c,3),minmax(0,1fr))}}`;
  document.head.appendChild(css);
  /* balanced columns on wide screens: 4 subjects sit 2 × 2, never 3 + 1 */
  const cols = n => `--n:${n};--c:${n <= 3 ? n : n === 4 ? 2 : 3}`;
  return {fromEntries, bySubject, spark, line, grid, change, pc, cols};
})();
