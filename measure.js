// measure.js — 메모리 지그 연결 연습 (2026-10-26): SM 보드(DB15) → 브레이크아웃 또는 MUX → K2400, 여덟 단계
// Part 1: the chain as plain numbers (no DOM), so it can be self-tested. All device values are EXAMPLES (예시), not measured.
(function () {
'use strict';
// SM board DB15 = gen1_261026.json sm_db15 / pin_map (design session 10/26); finger and Ag resistances are its 15 / 0.3 ohm/sq estimates
const DB15 = { 1: 'C1', 2: 'C2', 3: 'C3', 4: 'C4', 5: 'C5', 6: 'C6', 7: 'C7', 8: 'C8', 9: 'AG+', 10: 'AG−', 11: 'R1', 12: 'R2', 13: '—', 14: 'GND', 15: '—' };
// lanes left to right (jig frame): C1..C8 = fingers T7 T8 T5 T6 T3 T4 T1 T2
const FINGER = { 1: 'T7', 2: 'T8', 3: 'T5', 4: 'T6', 5: 'T3', 6: 'T4', 7: 'T1', 8: 'T2' };
const WIDTH = { 1: 1.0, 2: 0.5, 3: 2.0, 4: 2.0, 5: 1.0, 6: 2.0, 7: 1.0, 8: 0.5 };
const R_ITO = { 1: 62, 2: 129, 3: 47, 4: 71, 5: 69, 6: 70, 7: 69, 8: 136 };   // R_series_ito_ohm_15ohm_sq
const R_AGS = { 1: 1.1, 2: 2.0, 3: 3.1, 4: 4.6, 5: 5.9, 6: 7.3, 7: 8.5, 8: 9.5 };   // R_series_ag_ohm_0p3ohm_sq (from AG-)
const CONTACT = { 11: 2, 12: 8 };            // R1 = B8 -> finger T8 (C2), R2 = B7 -> finger T2 (C8)
const RCHK = { 2: 45, 8: 32 };               // rchk_expected_ohm_15ohm_sq: pad + body + link band (no neck)
const DB25 = { 1: 20, 2: 10, 3: 7, 4: 23, 5: 19, 6: 3, 7: 6, 8: 16, 9: 8, 10: 18, 11: 21, 12: 5, 14: 13 };   // adapter DB15 -> MUX DB25
const AG_W = 0.5;                            // mm
const R_AG = 10.4;                           // Ag line 0.5 x 17.3 mm between the end pads, 0.3 ohm/sq (assumed)
const R_CABLE = 0.3;                         // per path, cable + relay (assumed)
const R_HRS_1MM2 = 2e6;                      // EXAMPLE pristine cell, 1.0 mm²; scales as 1 / area (assumed shape)
const R_PARASITIC = 3e5;                     // EXAMPLE: an unwiped pad = pin-perovskite-ITO cell of 9.6 mm² in series
const OPEN = 1e12, FLOOR = 1e9;              // what the K2400 reads as open at 20 mV (10 pA floor)
const area = (n) => AG_W * WIDTH[n];
const rFinger = (n) => R_ITO[n];
const rCell = (n) => R_HRS_1MM2 / area(n);
const agShare = (n) => R_AGS[n];             // B4 (AG−) to the cell

function defaultState() {
  return { lid: null, wiped: null, output: null, route: null,
    chain: { ag: null, r1: null, r2: null, log: [] }, pairA: '9', pairB: '10',
    leads: { HI: '', LO: '' }, cell: '1', order: [], pc: { vread: '100', comp: '10', bipolar: false, offcheck: false } };
}

// resistance between two DB15 pins through the substrate (state: lid, wiped)
function between(s, a, b) {
  a = +a; b = +b; if (a === b) return 0;
  const reach = (p) => !(s.lid === 'half' && p >= 9 && p <= 12);       // half-closed lid: the side pins (B3 B4 B7 B8) lift first
  if (!reach(a) || !reach(b) || [13, 14, 15].includes(a) || [13, 14, 15].includes(b)) return OPEN;
  const unw = (p) => (s.wiped === false && ((p >= 1 && p <= 8) || p === 11 || p === 12) ? R_PARASITIC : 0);
  const node = (p) => (p === 9 || p === 10 ? { k: 'ag', end: p } : p >= 1 && p <= 8 ? { k: 'cell', n: p } : { k: 'con', n: CONTACT[p] });
  const A = node(a), B = node(b), path = (x) => (x.k === 'cell' ? rFinger(x.n) : x.k === 'con' ? 0 : 0);
  let r = 2 * R_CABLE + unw(a) + unw(b);
  if (A.k === 'ag' && B.k === 'ag') return r + R_AG;
  if (A.k === 'ag' || B.k === 'ag') { const o = A.k === 'ag' ? B : A, e = A.k === 'ag' ? A.end : B.end;
    const share = e === 10 ? agShare(o.n) : R_AG - agShare(o.n);
    return r + share + rCell(o.n) + (o.k === 'cell' ? rFinger(o.n) : rFinger(o.n) * 0.15); }
  if (A.k === 'con' || B.k === 'con') { const c = A.k === 'con' ? A : B, o = A.k === 'con' ? B : A;
    if (o.k === 'cell' && o.n === c.n) return r + RCHK[c.n];                                // RCHK: pad + body + link band
    return r + rFinger(c.n) * 0.15 + rCell(c.n) + Math.abs(agShare(c.n) - agShare(o.n)) + rCell(o.n) + (o.k === 'cell' ? rFinger(o.n) : 0); }
  return r + rFinger(A.n) + rCell(A.n) + Math.abs(agShare(A.n) - agShare(B.n)) + rCell(B.n) + rFinger(B.n);
}
// a K2400 read: what the instrument shows (>= 1 GΩ is open)
function read(s, hi, lo) { const r = between(s, hi, lo); return { r, open: r >= FLOOR }; }
const fmtR = (r) => (r >= FLOOR ? '≥ 1 GΩ (열림)' : r >= 1e6 ? (r / 1e6).toFixed(2) + ' MΩ' : r >= 1e3 ? (r / 1e3).toFixed(1) + ' kΩ' : r.toFixed(1) + ' Ω');

const MUX_ORDER = ['K2400 출력 OFF 확인', 'CELL n (셀 고르기)', 'BYPASS ON (1 kΩ 우회)', '출력 ON → read / SET', '출력 OFF', '다음 셀: CELL n+1'];
const HAND_ORDER = ['K2400 출력 OFF 확인', 'LO 리드를 셀 핀 n에', '출력 ON → read / SET', '출력 OFF', '다음 셀: LO 리드를 핀 n+1로'];

// what went wrong, in the order a person should fix it
function diagnose(s) {
  const out = [], n = +s.cell, hi = s.leads.HI, lo = s.leads.LO;
  if (s.output === 'on') out.push(['bad', '출력을 켠 채 선을 바꿨다: 연결 순간 걸린 전압이 셀을 SET하거나 forming할 수 있다. 바꾸기 전에는 늘 출력 OFF.']);
  if (s.lid === 'half') out.push(['bad', '뚜껑이 덜 닫혀 옆 핀(B3 · B4 · B7 · B8)이 떴다: Ag 줄이 열림으로 읽힌다.']);
  if (s.wiped === false) out.push(['bad', '패드를 안 닦았다: 핀–페로브스카이트–ITO 셀(약 ' + fmtR(R_PARASITIC) + ', 예시)이 직렬로 들어가 값이 커지고 흔들린다.']);
  if (s.route === 'breakout') {
    if (hi === lo && hi) out.push(['bad', 'HI와 LO가 같은 핀이다.']);
    else if (hi && lo && !(hi === '10' && lo === String(n))) {
      if (lo === '10' && hi === String(n)) out.push(['warn', 'HI와 LO가 바뀌었다: ±20 mV read는 같지만 SET 부호가 뒤집힌다 (지금까지 측정은 HI = Ag, +전압으로 SET).']);
      else if ((hi === '9' && lo === '10') || (hi === '10' && lo === '9')) out.push(['bad', '셀이 아니라 Ag 줄 양끝(9–10)을 쟀다: 13 Ω 근처가 나온다.']);
      else out.push(['bad', '고른 셀(C' + n + ')이 아닌 핀에 리드가 있다: HI = 10 (AG−, Ag), LO = ' + n + ' (셀 핀).']);
    }
  }
  if (s.route === 'mux' && s.order.join('|') !== MUX_ORDER.join('|')) out.push(['bad', 'MUX 순서가 다르다: 출력 OFF → CELL → BYPASS ON → 출력 ON.']);
  if (+s.pc.vread > 20) out.push(['warn', 'read ' + s.pc.vread + ' mV는 크다: 처음 read는 ±20 mV (상태를 바꾸지 않을 만큼).']);
  if (+s.pc.comp > 1) out.push(['warn', '제한 전류 ' + s.pc.comp + ' mA: kit 기본 한계는 1 mA. 008–011에서 제한 전류가 다리 수명을 정했다.']);
  if (!s.pc.bipolar) out.push(['warn', '양극(±20 mV) read가 아니다: 0 V 이완 전류가 그대로 섞인다.']);
  if (!s.pc.offcheck) out.push(['warn', '출력 OFF 확인을 끄면 Ctrl-C 뒤 출력이 켜진 채 남은 것을 모른다 (10/24 run 163546).']);
  if (s.chain.ag == null || s.chain.r1 == null || s.chain.r2 == null) out.push(['warn', '체인 점검(Ag 줄 · 손가락 R1 · R2)을 안 했다: 직렬 보정값이 없다.']);
  return out;
}
function firstRead(s) {
  const n = +s.cell;
  if (s.route === 'mux') { const ok = s.order.join('|') === MUX_ORDER.join('|'); const r = between(s, 10, n) + (ok ? 0 : 1000); return { r, open: r >= FLOOR, expect: rCell(n) + rFinger(n) + agShare(n) + 2 * R_CABLE }; }
  const r = s.leads.HI && s.leads.LO ? between(s, s.leads.HI, s.leads.LO) : OPEN;
  return { r, open: r >= FLOOR, expect: rCell(n) + rFinger(n) + agShare(n) + 2 * R_CABLE };
}
function goodState() {
  const s = defaultState(); Object.assign(s, { lid: 'closed', wiped: true, output: 'off', route: 'breakout', cell: '3' });
  s.leads = { HI: '10', LO: '3' }; s.pc = { vread: '20', comp: '1', bipolar: true, offcheck: true };
  s.chain = { ag: between(s, 9, 10), r1: between(s, 11, 2), r2: between(s, 12, 8), log: [] }; return s;
}
function selfTest() {
  const t = [], ok = (name, pass) => t.push({ name, pass: !!pass });
  const g = goodState(), r0 = firstRead(g);
  ok('바른 순서: 셀 + 손가락 + Ag 몫 + 케이블', Math.abs(r0.r - r0.expect) / r0.expect < 0.01);
  ok('바른 순서: 고칠 것 없음', diagnose(g).length === 0);
  ok('Ag 줄 9–10 ≈ 10 Ω', g.chain.ag > 8 && g.chain.ag < 15);
  ok('R1 ≈ 45 Ω · R2 ≈ 32 Ω', Math.abs(g.chain.r1 - 45.6) < 1 && Math.abs(g.chain.r2 - 32.6) < 1);
  const u = goodState(); u.wiped = false; ok('안 닦으면 값이 커진다', firstRead(u).r > r0.r * 1.05);
  const h = goodState(); h.lid = 'half'; ok('뚜껑 덜 닫힘 → Ag 줄 열림', read(h, 9, 10).open);
  const w = goodState(); w.leads = { HI: '10', LO: '9' }; ok('9–10을 재면 13 Ω 근처', firstRead(w).r < 50);
  const x = goodState(); x.leads = { HI: '3', LO: '10' }; ok('HI/LO 바꿔도 크기는 같고 경고', Math.abs(firstRead(x).r - r0.r) < 1 && diagnose(x).some((d) => d[0] === 'warn'));
  const o = goodState(); o.output = 'on'; ok('출력 켠 채 → 빨간 경고', diagnose(o)[0][0] === 'bad');
  const m = goodState(); m.route = 'mux'; m.order = MUX_ORDER.slice(); ok('MUX 바른 순서 = 브레이크아웃과 같은 값', Math.abs(firstRead(m).r - r0.r) < 1);
  m.order = [MUX_ORDER[0], MUX_ORDER[1], MUX_ORDER[3]]; ok('BYPASS 빼먹음 → 1 kΩ 더 + 경고', firstRead(m).r > r0.r + 900 && diagnose(m).length > 0);
  ok('GND · 빈 핀은 열림', read(g, 14, 3).open && read(g, 13, 10).open);
  return { pass: t.filter((x) => x.pass).length, total: t.length, tests: t };
}
const J = { DB15, WIDTH, CONTACT, FINGER, DB25, RCHK, area, rFinger, rCell, between, read, fmtR, defaultState, diagnose, firstRead, selfTest, MUX_ORDER, HAND_ORDER, R_AG };
window.MEAS = J;

// Part 2: page
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STEPS = [['jig', '지그 · 기판'], ['off', '출력 OFF'], ['route', '경로'], ['chain', '체인 점검'], ['leads', 'K2400 리드'], ['order', '셀 바꾸기'], ['pc', 'PC 설정'], ['run', '처음 read']];
let st = defaultState(), cur = 0, last = null;

function done(id, s) {
  switch (id) {
    case 'jig': return s.lid != null && s.wiped != null;
    case 'off': return s.output != null;
    case 'route': return s.route != null;
    case 'chain': return s.chain.ag != null && s.chain.r1 != null && s.chain.r2 != null;
    case 'leads': return s.route === 'mux' || !!(s.leads.HI && s.leads.LO);
    case 'order': return s.order.length >= (s.route === 'mux' ? MUX_ORDER : HAND_ORDER).length;
    case 'pc': return true;
    case 'run': return !!last;
  }
}
const opt = (path, v, text) => `<button class="opt" type="button" data-set="${path}" data-v="${v}" aria-pressed="${get(path) === v}">${esc(text)}</button>`;
function get(path) { return path.split('.').reduce((o, k) => o[k], st); }
function set(path, v) { const ks = path.split('.'), k = ks.pop(); ks.reduce((o, q) => o[q], st)[k] = v; }
const pinSel = (key, label, val) => `<label class="field">${esc(label)}<select data-sel="${key}"><option value="">— 비움 —</option>` +
  Object.entries(DB15).map(([p, t]) => `<option value="${p}"${String(val) === p ? ' selected' : ''}>${p} · ${esc(t)}</option>`).join('') + '</select></label>';

function cardHTML(id) {
  switch (id) {
    case 'jig': return '<h2>1. 지그와 기판 확인</h2><p>조립 연습대로 솔라셀 몸체(S1–S5)에 SM 보드와 기판(막면 아래)을 넣었다. 뚜껑 걸쇠가 "딸깍" 붙었는지, 핀이 닿을 ITO 패드 10곳을 닦았는지 확인한다.</p>' +
      '<p class="label">뚜껑</p><div class="opts">' + opt('lid', 'closed', '딸깍 닫힘') + opt('lid', 'half', '덜 닫힘 (걸쇠 안 걸림)') + '</div>' +
      '<p class="label">패드 10곳 (손가락 8 + 접점 2)</p><div class="opts">' + opt('wiped', true, '닦았다') + opt('wiped', false, '안 닦았다') + '</div>';
    case 'off': return '<h2>2. K2400 출력 OFF 확인</h2><p>선을 꽂기 전 앞면 OUTPUT 불이 꺼져 있는지 본다. kit가 Ctrl-C로 끊긴 뒤에는 출력이 켜진 채 남은 적이 있다(10/24, "Output OFF not verified").</p><div class="opts">' +
      opt('output', 'off', 'OUTPUT 꺼짐 확인') + opt('output', 'on', '켜진 채 그냥 연결') + '</div>';
    case 'route': return '<h2>3. 경로 고르기</h2><p>첫 기판은 MUX 없이 DB15 브레이크아웃으로 손으로 잰다. 셀 여러 개 · 밤샘 retention은 DB15 → DB25 어댑터 케이블로 MEM-MUX16을 거친다(보드 변경 없음, 16선 중 12선).</p><div class="opts">' +
      opt('route', 'breakout', 'DB15 브레이크아웃 (첫 기판)') + opt('route', 'mux', '어댑터 → MUX (CELL 명령)') + '</div>';
    case 'chain': {
      const c = st.chain, row = (k, t, v) => `<tr><td>${k}</td><td>${esc(t)}</td><td class="mono">${v == null ? '—' : esc(fmtR(v))}</td></tr>`;
      return '<h2>4. 체인 점검</h2><p>K2400 20 mV read(또는 멀티미터 Ω)로 두 핀 사이를 잰다. 1 GΩ 열림은 K2400으로만 보인다. 재야 할 것: Ag 줄 9–10 (≈ 10 Ω), R1 = 11–2 (T8–B8, ≈ 45 Ω), R2 = 12–8 (T2–B7, ≈ 32 Ω). R1 · R2는 패드 + 몸통 + 연결 띠라 면저항을 뽑아 손가락마다 칸 수를 곱한다 (값은 15 · 0.3 Ω/sq 가정).</p>' +
        '<div class="grid2">' + pinSel('pairA', '핀 A', st.pairA) + pinSel('pairB', '핀 B', st.pairB) + '</div><div class="opts"><button class="btn" type="button" data-probe>재기</button></div>' +
        '<table><tr><th>점검</th><th>핀</th><th>값</th></tr>' + row('Ag 줄', '9 – 10', c.ag) + row('R1', '11 – 2 (T8)', c.r1) + row('R2', '12 – 8 (T2)', c.r2) + '</table>' +
        (c.log.length ? '<p class="note mono">' + c.log.slice(-3).map(esc).join('<br>') + '</p>' : '') +
        '<p class="note">MUX로는 AGCHK (9 → HI, 10 → LO), RCHK 1 (2 → HI, 11 → LO), RCHK 2 (8 → HI, 12 → LO).</p>';
    }
    case 'leads': return st.route === 'mux'
      ? '<h2>5. K2400 리드 (MUX 경유)</h2><p>K2400 HI · LO를 MUX 상자의 HI_POST · LO_POST에 꽂는다(2선, SENSE는 안 씀). 지그 DB15 → 어댑터 → MUX DB25 (1–12 → 20 10 7 23 19 3 6 16 8 18 21 5, 14 → 13). 셀 고르기는 다음 단계의 명령이 한다.</p><p class="note">극성 [확인 필요]: 10/26 펌웨어 CELL n은 손가락 → HI, Ag (선 10) → LO. 지금까지 kit 측정은 HI = Ag (+전압으로 SET)라 MUX로 옮기면 SET 부호가 뒤집힌다.</p>'
      : '<h2>5. K2400 리드 (브레이크아웃, 2선)</h2><p>셀 하나를 고르고 HI · LO를 꽂는다. 지금까지 측정과 같은 극성: <b>HI = 10 (AG−, Ag 줄)</b>, <b>LO = 셀 핀 n (ITO 손가락)</b>. SENSE는 안 쓴다.</p>' +
        '<label class="field">셀<select data-sel="cell">' + [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}"${st.cell === String(n) ? ' selected' : ''}>C${n} · ${FINGER[n]} · ${area(n).toFixed(2)} mm²</option>`).join('') + '</select></label>' +
        '<div class="grid2">' + pinSel('leads.HI', 'HI (빨강)', st.leads.HI) + pinSel('leads.LO', 'LO (검정)', st.leads.LO) + '</div>';
    case 'order': {
      const list = st.route === 'mux' ? MUX_ORDER : HAND_ORDER, decoys = st.route === 'mux'
        ? [['출력 ON 그대로 CELL 바꾸기', 'MUX 전환은 출력 OFF + OE 인터록일 때만이다. 켠 채 바꾸면 릴레이가 셀에 전압을 걸었다 끊는다.'], ['BYPASS 없이 SET', '1 kΩ 직렬이면 1 mA SET에서 1 V가 저항에 떨어져 "0.5 V 상한"이 깨진다. 출력 ON 전에 BYPASS ON.']]
        : [['출력 ON 그대로 리드 옮기기', '리드를 옮기는 순간 다른 셀에 전압이 걸린다. 늘 출력 OFF 뒤에 옮긴다.']];
      const picked = st.order.length;
      const all = list.map((t, i) => ({ t, i })).concat(decoys.map(([t, h], j) => ({ t, h, j })));
      const sh = all.map((e, k) => ({ e, k: (k * 7 + 3) % all.length })).sort((a, b) => a.k - b.k).map((x) => x.e);
      return '<h2>6. 셀 바꾸는 순서</h2><p>' + (st.route === 'mux' ? 'MUX 명령(CELL · RCHK · AGCHK · BYPASS)으로 셀을 바꾼다. 장착 직후 한 번: AGCHK → RCHK 1–2 → 셀 8개 처음 read.' : '브레이크아웃은 손으로 LO 리드를 옮겨 셀을 바꾼다.') + ' 순서대로 누른다.</p><div class="opts">' +
        sh.map((e) => e.i != null
          ? `<button class="opt" type="button" data-ord="${e.i}" aria-pressed="${e.i < picked}">${e.i < picked ? (e.i + 1) + '. ' : ''}${esc(e.t)}</button>`
          : `<button class="opt" type="button" data-decoy="${esc(e.h)}">${esc(e.t)}</button>`).join('') + '</div>';
    }
    case 'pc': {
      const p = st.pc, inp = (k, l) => `<label class="field">${esc(l)}<input type="number" inputmode="decimal" data-pc="${k}" value="${esc(p[k])}"></label>`;
      return '<h2>7. PC (kit) 설정</h2><p>값은 지난 사람이 쓴 그대로다. 처음 read에 맞게 고친다: read ±20 mV, 제한 전류는 kit 기본 한계 1 mA, 출력 OFF 확인 켜기.</p><div class="grid2">' + inp('vread', 'read 전압 mV') + inp('comp', '제한 전류 mA') + '</div>' +
        `<label class="field"><span><input type="checkbox" data-pcchk="bipolar"${p.bipolar ? ' checked' : ''}> 양극 read (±, 기준선 보정)</span></label>` +
        `<label class="field"><span><input type="checkbox" data-pcchk="offcheck"${p.offcheck ? ' checked' : ''}> 끝날 때 출력 OFF 확인 (:OUTP?)</span></label>`;
    }
    case 'run': {
      let html = '<h2>8. 처음 read (±20 mV)</h2><p>고른 셀을 한 번 읽는다. 값은 예시 모델(처음 저항이 면적에 반비례한다고 가정)에서 나온다. 아래에 고칠 것이 나온다.</p><div class="opts"><button class="btn" type="button" data-run>읽기</button></div>';
      if (last) {
        const d = diagnose(st), bad = d.some((x) => x[0] === 'bad');
        html += `<div class="read ${bad ? 'bad' : 'ok'}">C${esc(st.cell)} (${area(+st.cell).toFixed(2)} mm²): <b class="mono">${esc(fmtR(last.r))}</b>` +
          (last.open ? '' : ` · 예상 ${esc(fmtR(last.expect))} (셀 ${esc(fmtR(rCell(+st.cell)))} + 손가락 ${rFinger(+st.cell).toFixed(0)} Ω)`) + '</div>' +
          (d.length ? '<ul>' + d.map(([k, t]) => `<li style="color:var(--${k === 'bad' ? 'bad' : 'muted'})">${esc(t)}</li>`).join('') + '</ul>' : '<p class="note">고칠 것 없음. 다음은 kit v3를 셀 단위로 (forming → DC cycle → retention).</p>');
      }
      return html;
    }
  }
}

function drawBench() {
  const id = STEPS[cur][0], hi = st.route === 'breakout' ? st.leads.HI : '', lo = st.route === 'breakout' ? st.leads.LO : '';
  const pa = id === 'chain' ? st.pairA : '', pb = id === 'chain' ? st.pairB : '';
  let g = '<text x="50" y="5" font-size="3" text-anchor="middle">SM 보드 DB15 (암) · 숫자는 커넥터 몸체에 찍힌 번호로 확인</text>';
  g += '<path d="M14 12 H86 L80 36 H20 Z" fill="none" stroke="var(--muted)" stroke-width="0.6"/>';
  const pos = (p) => (p <= 8 ? [20 + (p - 1) * 8.6, 19] : [24.3 + (p - 9) * 8.6, 29]);
  for (let p = 1; p <= 15; p++) {
    const [x, y] = pos(p), sel = String(p) === hi ? 'var(--hi)' : String(p) === lo ? 'var(--lo)' : (String(p) === pa || String(p) === pb) ? 'var(--accent)' : null;
    g += `<circle cx="${x}" cy="${y}" r="2.6" fill="${sel || 'var(--pin)'}" opacity="${['13', '15'].includes(String(p)) ? 0.35 : 1}"/>` +
      `<text x="${x}" y="${y + 0.9}" font-size="2.3" text-anchor="middle" style="fill:${sel ? 'var(--panel)' : 'var(--fg)'}">${p}</text>` +
      `<text x="${x}" y="${p <= 8 ? y - 4 : y + 5.2}" font-size="2" text-anchor="middle" style="fill:var(--muted)">${esc(DB15[p])}</text>`;
  }
  if (st.route === 'mux') {
    g += box(8, 46, 22, 12, 'K2400', 'HI · LO (2선)') + box(39, 46, 24, 12, 'MEM-MUX16', 'CELL n · BYPASS') + box(72, 46, 22, 12, '어댑터', 'DB25 → DB15') +
      line(30, 52, 39, 52) + line(63, 52, 72, 52) + line(83, 46, 60, 36);
  } else if (st.route === 'breakout') {
    g += box(8, 46, 22, 12, 'K2400', '출력 ' + (st.output === 'on' ? '켜짐 ⚠' : st.output === 'off' ? 'OFF 확인' : '확인 전')) + box(56, 50, 34, 8, 'DB15 브레이크아웃', '단자대');
    if (hi) g += `<path d="M24 46 Q40 40 ${pos(+hi)[0]} ${pos(+hi)[1] + 3}" fill="none" stroke="var(--hi)" stroke-width="0.9"/>`;
    if (lo) g += `<path d="M14 46 Q30 38 ${pos(+lo)[0]} ${pos(+lo)[1] + 3}" fill="none" stroke="var(--lo)" stroke-width="0.9"/>`;
  } else g += '<text x="50" y="52" font-size="2.8" text-anchor="middle" style="fill:var(--muted)">3단계에서 경로를 고르면 선이 그려진다</text>';
  g += `<text x="50" y="68" font-size="2.4" text-anchor="middle" style="fill:var(--muted)">1–8 셀 C1–C8 · 9 AG+ · 10 AG− · 11 R1 · 12 R2 · 14 GND · 13 · 15 빈 핀</text>`;
  $('bench').innerHTML = g;
}
const box = (x, y, w, h, t, s) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="var(--panel)" stroke="var(--muted)" stroke-width="0.5"/><text x="${x + w / 2}" y="${y + 5}" font-size="2.8" text-anchor="middle">${esc(t)}</text><text x="${x + w / 2}" y="${y + 9.3}" font-size="2.2" text-anchor="middle" style="fill:var(--muted)">${esc(s)}</text>`;
const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--fg)" stroke-width="0.6"/>`;

function renderNav() {
  $('nav').innerHTML = STEPS.map(([id, t], i) => `<button type="button" data-step="${i}" class="${done(id, st) ? 'done' : ''}"${i === cur ? ' aria-current="step"' : ''}><b>${i + 1}</b>${esc(t)}</button>`).join('');
  $('prev').disabled = cur === 0; $('next').disabled = cur === STEPS.length - 1;
}
function render() { $('card').innerHTML = cardHTML(STEPS[cur][0]); renderNav(); drawBench(); }
function go(i) { cur = Math.max(0, Math.min(STEPS.length - 1, i)); render(); }
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

$('card').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.set) { set(b.dataset.set, b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v); if (b.dataset.set === 'route') st.order = []; last = null; render(); }
  else if (b.hasAttribute('data-probe')) {
    const a = st.pairA, c = st.pairB; if (!a || !c) { toast('두 핀을 고른다.'); return; }
    const r = read(st, a, c), A = +a, B = +c, key = [A, B].sort((x, y) => x - y).join('-');
    st.chain.log.push(`${a}–${c}: ${fmtR(r.r)}`);
    if (key === '9-10') { st.chain.ag = r.r; toast(r.open ? 'Ag 줄이 열림: 뚜껑 · 옆 핀 접촉을 본다.' : 'Ag 줄 ' + fmtR(r.r) + ' (수십 Ω 이하면 됨)'); }
    else if ((A === 11 || B === 11) && (A === CONTACT[11] || B === CONTACT[11])) { st.chain.r1 = r.r; toast('R1 손가락 ' + fmtR(r.r) + ' 기록'); }
    else if ((A === 12 || B === 12) && (A === CONTACT[12] || B === CONTACT[12])) { st.chain.r2 = r.r; toast('R2 손가락 ' + fmtR(r.r) + ' 기록'); }
    else if (A === 11 || B === 11 || A === 12 || B === 12) toast('접점은 자기 손가락의 셀 핀과 잰다: R1 = 11–2 (T8), R2 = 12–8 (T2). 다른 핀이면 셀을 지나 MΩ이 나온다.');
    else if ((A <= 8 && (B === 9 || B === 10)) || (B <= 8 && (A === 9 || A === 10))) toast('그건 셀이다 (' + fmtR(r.r) + '). 셀 처음 read는 8단계에서.');
    else toast(fmtR(r.r));
    last = null; render();
  }
  else if (b.dataset.ord != null) {
    const list = st.route === 'mux' ? MUX_ORDER : HAND_ORDER, i = +b.dataset.ord;
    if (i < st.order.length) return;
    if (i !== st.order.length) { toast('아직 아니다. 먼저 "' + list[st.order.length] + '".'); return; }
    st.order.push(list[i]); last = null; render();
  }
  else if (b.dataset.decoy) toast('✕ ' + b.dataset.decoy);
  else if (b.hasAttribute('data-run')) { last = firstRead(st); render(); }
});
$('card').addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.sel) { set(t.dataset.sel, t.value); last = null; render(); }
  else if (t.dataset.pc) { st.pc[t.dataset.pc] = t.value; last = null; }
  else if (t.dataset.pcchk) { st.pc[t.dataset.pcchk] = t.checked; last = null; }
});
$('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (b) go(+b.dataset.step); });
$('prev').addEventListener('click', () => go(cur - 1));
$('next').addEventListener('click', () => go(cur + 1));
$('reset').addEventListener('click', () => { st = defaultState(); last = null; go(0); });

$('pinmap').innerHTML = '<tr><th>DB15</th><th>선</th><th>기판 핀</th><th>MUX DB25</th></tr>' +
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, `C${n} (${WIDTH[n]} mm, ${area(n).toFixed(2)} mm²)`, FINGER[n], DB25[n]]).concat([
    [9, 'AG+ (Ag 줄 끝)', 'B3', 8], [10, 'AG− (Ag 줄 다른 끝, 셀 측정의 Ag 쪽)', 'B4', 18], [11, 'R1 (T8 = C2의 접점)', 'B8', 21], [12, 'R2 (T2 = C8의 접점)', 'B7', 5],
    [14, 'GND (쉘도 GND)', '—', 13], ['13 · 15', 'NC', '—', '—']]).map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('');
$('dont').innerHTML = ['출력을 켠 채 선 · 리드 · 셀 바꾸기 (MUX는 출력 OFF + OE 인터록일 때만 전환)', '1 kΩ 직렬 상태로 SET (출력 ON 전에 BYPASS ON)',
  '처음 read를 ±20 mV보다 크게', '제한 전류를 kit 기본 1 mA 넘게 (RESET 3 mA는 오더에 적힌 대로만)', '닦지 않은 패드에 핀 대기', 'Ctrl-C로 끊은 뒤 앞면 OUTPUT을 안 보고 자리 뜨기']
  .map((t) => `<li>${esc(t)}</li>`).join('');
$('notes').innerHTML = ['SET 극성: fw CELL = 손가락 HI · Ag LO, 지금까지 측정 = HI Ag → 맞출 것', '셀 처음 저항 예시 = 2 MΩ × (1 mm² / 면적): 측정값 아님',
  '손가락 직렬 47–136 Ω · Ag 몫 1–10 Ω · R1 45 · R2 32 Ω는 15 / 0.3 Ω/sq 가정 (gen1_261026.json), 면저항은 실측', '어댑터 DB15 → DB25 케이블 품번 미정']
  .map((t) => `<li>${esc(t)}</li>`).join('');
try { const t = selfTest(); $('selftest').textContent = '자체 점검: ' + t.pass + ' / ' + t.total + ' 통과 (바른 순서 = 예시 값, 실수마다 숫자가 맞는 방향으로)'; }
catch (err) { $('selftest').textContent = '자체 점검 실패: ' + err.message; }
render();
})();
