/* 메모리 지그 조립 연습 (assembly.html), 2026-10-26
 * 1세대 = 솔라셀 지그 몸체(S1-S5) + 메모리용 SM 보드(DB15, 핀 12). 2세대 = XB16 지그(핀 16, DB25), 8 x 8용으로 보관.
 * The step lists GEN1_STEPS / GEN2_STEPS are plain data: edit them to change the order or the words.
 *   step = { id, phase, title, say, tip?, view: 'sub' | 'jig', tasks: [...], apply?(s) }
 *   task = { t: 'quiz', q, opts: [{ t, ok?, hint? }] }               one right answer, the others answer with a hint
 *          { t: 'pick', lab, items: [label], decoys: [{ t, hint }], ordered? }   pick the right things (in order if ordered)
 *          { t: 'pads', want: [pin], avoid: { pin: hint } }           tap the pads on the drawing (or their buttons)
 *          { t: 'kit', rows: [{ label, qty }] }                       tick the parts list
 * The bench is a drawing made from the design numbers (pins = XB16 positions, Ag line y = +2 mm); it becomes the SM jig 3D model
 * once that model exists. window.__asm = { validate(), runAll(), state } is the self-test used for the line under the rail. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 60) : ms));

  // ============================================================ geometry (mm, glass centre = 0, y up)
  const PIN = { T1: [6, 10.25], T3: [2, 10.25], T5: [-2, 10.25], T7: [-6, 10.25], T2: [6, -10.25], T4: [2, -10.25], T6: [-2, -10.25], T8: [-6, -10.25],
    B1: [10.25, 6], B2: [-10.25, 6], B3: [10.25, 2], B4: [-10.25, 2], B5: [10.25, -2], B6: [-10.25, -2], B7: [10.25, -6], B8: [-10.25, -6] };
  const FINGERS = ['T7', 'T8', 'T5', 'T6', 'T3', 'T4', 'T1', 'T2'];          // left to right in the crossing zone (concept lanes)
  const WIDTH = { T7: 2.0, T8: 1.0, T5: 2.0, T6: 1.0, T3: 2.0, T4: 1.0, T1: 0.5, T2: 0.5 };   // 3 x 2.0, 3 x 1.0, 2 x 0.5 mm
  const LANE = (n) => PIN[n][0] + (PIN[n][1] > 0 ? -0.9 : 0.9);
  const AG_PADS = ['B3', 'B4'], CONTACTS = { B7: 'T2', B8: 'T8' }, UNUSED = ['B1', 'B2', 'B5', 'B6'];
  const WIPE = FINGERS.concat(Object.keys(CONTACTS));                           // 10 ITO pads under pins
  const AG_W = 0.5, AG_Y = 2.0;
  const cellArea = (n) => (AG_W * WIDTH[n]).toFixed(2);

  // ============================================================ steps (data)
  const GEN1_STEPS = [
    { id: 'ito', phase: '기판 준비', view: 'sub', title: 'ITO 식각: 손가락 8개 패턴',
      say: '25 × 25 ITO 유리에서 손가락 8개(셀 폭 2.0 / 1.0 / 0.5 mm, 3 / 3 / 2개)와 핀 패드, 손가락 저항 접점 연결만 남기고 ITO를 걷어낸다. 업체 패턴 유리를 쓰거나 테이프 · 레이저 컷 스텐실 + Zn/HCl로 식각한다.',
      tip: '셀 면적 = Ag 줄 폭 0.5 × 손가락 폭이라, ITO 폭(식각 ±0.1)이 면적을 정한다.',
      tasks: [{ t: 'quiz', q: '어떤 ITO 패턴을 쓰나?', opts: [
        { t: '손가락 8개 + 핀 패드 + 접점 연결 (1 × 8 crossbar)', ok: true },
        { t: 'ITO 전면 그대로 (공통 ITO + Ag 패드)', hint: '페로브스카이트가 전면이라 Ag 패드에서 핀까지 가는 Ag 선 자체가 ITO와 셀을 만든다 (선 0.3 × 8 mm = 2.4 mm² > 셀 0.25 mm²).' },
        { t: '아래 선 8줄 (8 × 8 crossbar)', hint: '8 × 8은 2세대(XB16, 16선)용이다. 1세대 SM 보드는 12선뿐이다.' }] }],
      apply: (s) => { s.ito = true; } },
    { id: 'pvk', phase: '기판 준비', view: 'sub', title: '페로브스카이트 스핀코팅 (전면)',
      say: '지금 공정 그대로 전면에 코팅한다. 이 단계 뒤에는 ITO 패드도 막으로 덮여 있다.',
      tasks: [{ t: 'quiz', q: '코팅 범위는?', opts: [
        { t: '전면 (지금 공정 그대로)', ok: true },
        { t: '교차 구역만 마스크로 가려서', hint: '전면 코팅 뒤 핀이 닿는 패드만 닦는 것이 지금 공정과 같고 더 간단하다. 다음 단계가 닦기다.' }] }],
      apply: (s) => { s.pvk = true; } },
    { id: 'wipe', phase: '기판 준비', view: 'sub', title: `핀이 닿을 ITO 패드 ${WIPE.length}곳 닦기`,
      say: `용매 면봉으로 핀이 닿는 ITO 패드 위 막을 닦아 낸다: 손가락 핀 ${FINGERS.length}곳 + 손가락 저항 접점 2곳(B7 · B8). 솔라셀 가장자리 닦기와 같은 작업이다.`,
      tip: '안 닦으면 핀–페로브스카이트–ITO가 9.6 mm² 셀이 되어 모든 측정에 직렬로 들어간다. 그림의 패드를 눌러 표시한다.',
      tasks: [{ t: 'pads', want: WIPE, avoid: {
        B3: 'B3 · B4는 Ag 줄 끝 패드 자리다. 아래에 ITO가 없어서 닦을 것이 없다 (Ag가 막 위에 올라간다).',
        B4: 'B3 · B4는 Ag 줄 끝 패드 자리다. 아래에 ITO가 없어서 닦을 것이 없다 (Ag가 막 위에 올라간다).',
        B1: '1세대 SM 보드에는 이 자리에 핀이 없다 (B1 · B2 · B5 · B6은 2세대 16선용).',
        B2: '1세대 SM 보드에는 이 자리에 핀이 없다 (B1 · B2 · B5 · B6은 2세대 16선용).',
        B5: '1세대 SM 보드에는 이 자리에 핀이 없다 (B1 · B2 · B5 · B6은 2세대 16선용).',
        B6: '1세대 SM 보드에는 이 자리에 핀이 없다 (B1 · B2 · B5 · B6은 2세대 16선용).' } }],
      apply: (s) => { s.wiped = new Set(WIPE); } },
    { id: 'ag', phase: '기판 준비', view: 'sub', title: 'Ag 증착: 등록 틀 + Ag 마스크 한 장',
      say: '등록 틀 안에 기판을 넣고 Ag 마스크 한 장을 얹어 증착한다. 마스크 구멍 = Ag 줄 0.5 × 21 mm + 양끝 패드 B3 · B4 + 닦은 ITO 패드 위 접촉 패드(3.2 × 3.0에서 안쪽 0.3).',
      tip: 'Ag 줄이 폭 2 mm 교차 구역(y = 2.0 ± 1.0) 안에만 들어오면 된다. 8 × 8의 0.1 mm 선 맞춤보다 훨씬 쉽다.',
      tasks: [{ t: 'pick', lab: '증착 홀더에 넣는 순서', ordered: true, items: ['등록 틀을 홀더 포켓에', '기판 (막면이 마스크 쪽)', 'Ag 마스크 한 장'],
        decoys: [{ t: 'X1 · X2 마스크 두 장', hint: 'X1 · X2는 8 × 8 (2세대)용이다. 1세대는 Ag 마스크 한 장이다.' },
          { t: '솔라셀 화소 마스크 (구멍 4개)', hint: '그건 측정용 빛 마스크다. 메모리 셀 면적은 Ag 줄 × ITO 손가락이 정한다.' }] }],
      apply: (s) => { s.ag = true; } },
    { id: 'kit', phase: '지그 장착', view: 'jig', title: '부품 챙기기 (솔라셀 지그와 같은 몸체)',
      say: '몸체는 솔라셀 싱글 지그 S1–S5 그대로다. 다른 것은 PCB 한 장(SM 보드: 핀 12개, 센서 없음)뿐이다.',
      tasks: [{ t: 'kit', rows: [{ label: 'S1 받침 (강구 3 · 자석 2 붙은 것)', qty: '1' }, { label: 'SM 보드 (핀 12 납땜, DB15)', qty: '1' },
        { label: '맞춤핀 MS2-6', qty: '2' }, { label: 'S2 프레임 (0.8 턱, 유리 포켓 25.2)', qty: '1' }, { label: '볼트 SCB3-8 + 너트', qty: '4' },
        { label: 'S4 누름 링 POM 1.0 + 실리콘 폼 0.5', qty: '1' }, { label: 'S3 뚜껑 (경첩 MS2.5-30, 자석 걸쇠)', qty: '1' },
        { label: 'S5 DB15 블록 + 잭나사 7229 ×2 + SCB3-20 ×2', qty: '1' }] }],
      apply: (s) => { s.kit = true; } },
    { id: 'body', phase: '지그 장착', view: 'jig', title: '받침 → SM 보드 → 프레임',
      say: 'S1 받침에 SM 보드를 놓고 맞춤핀 두 개로 자리를 잡은 뒤 S2 프레임을 덮고 SCB3-8 네 개로 조인다. 프레임의 0.8 mm 턱이 유리의 멈춤면이라 핀 눌림이 0.9 mm로 고정된다.',
      tasks: [{ t: 'pick', lab: '쌓는 순서', ordered: true, items: ['S1 받침', 'SM 보드 + 맞춤핀 2', 'S2 프레임 + SCB3-8 ×4'],
        decoys: [{ t: '솔라셀 S 보드', hint: 'S 보드는 솔라셀 화소 핀 자리다. 메모리 기판에는 SM 보드(핀 12, XB16 좌표)를 쓴다. 외곽 · 구멍 · DB15 자리는 같다.' },
          { t: 'XB 보드 (핀 16, DB25)', hint: 'XB는 2세대 XB16 지그용이다. 솔라셀 몸체에는 안 들어간다.' }] }],
      apply: (s) => { s.layers.add('base'); s.layers.add('pcb'); s.layers.add('frame'); } },
    { id: 'glass', phase: '지그 장착', view: 'jig', title: '기판 넣기: 막면 아래',
      say: '막면(Ag · 닦은 패드)을 아래로 해서 핀 12개 위에 놓는다. 유리가 0.8 mm 턱에 평평하게 앉아야 한다.',
      tasks: [{ t: 'quiz', q: '기판 방향은?', opts: [
        { t: '막면 아래, 방향 표시(ITO / FILM DOWN 각인)에 맞춤', ok: true },
        { t: '막면 위', hint: '핀은 모두 아래에서 올라온다. 막면이 위면 핀이 유리 뒷면에 닿아 아무것도 연결되지 않는다.' },
        { t: '90° 돌려서', hint: '핀 자리는 대칭이 아니다 (T 핀 8개 위아래, B3 · B4 · B7 · B8 옆). 돌리면 핀이 엉뚱한 패드나 막에 닿는다.' }] }],
      apply: (s) => { s.layers.add('glass'); } },
    { id: 'ring', phase: '지그 장착', view: 'jig', title: '누름 링 + 폼, 뚜껑 닫기',
      say: '1.1T 유리면 누름 링(POM 1.0) + 실리콘 폼 0.5를 얹고 뚜껑을 내려 자석 걸쇠가 "딸깍" 붙게 한다. 솔라셀 화소 마스크는 넣지 않는다.',
      tasks: [{ t: 'pick', lab: '유리 위에 올리는 것', ordered: true, items: ['누름 링 POM 1.0 + 폼 0.5', 'S3 뚜껑 닫기 (걸쇠 딸깍)'],
        decoys: [{ t: '솔라셀 화소 마스크 0.2 mm', hint: '빛을 쓰지 않는 메모리 측정에는 필요 없다. 마스크 두께만큼 누름이 달라진다.' }] }],
      apply: (s) => { s.layers.add('ring'); s.layers.add('lid'); } },
    { id: 'db15', phase: '지그 장착', view: 'jig', title: 'DB15 블록과 케이블',
      say: 'S5 블록으로 DB15를 고정하고(잭나사 7229 두 개) 케이블을 꽂는다. 첫 기판은 DB15 브레이크아웃으로 손 측정, 그 뒤 MUX로 갈 때는 DB15 → DB25 어댑터 케이블.',
      tip: '케이블을 꽂고 빼는 것은 K2400 출력 OFF일 때만. 연결 순서는 "연결하는 법" 페이지.',
      tasks: [{ t: 'quiz', q: '첫 기판의 연결은?', opts: [
        { t: 'DB15 브레이크아웃 → K2400 리드 2개 (셀 핀 n ↔ AG−)', ok: true },
        { t: '바로 MUX DB25에 꽂기', hint: 'SM 보드는 DB15다. MUX로 가려면 DB15 → DB25 어댑터가 필요하고, 첫 기판은 MUX 없이 손으로 먼저 확인한다.' }] }],
      apply: (s) => { s.layers.add('db15'); } },
  ];

  const GEN2_STEPS = [
    { id: 'g2sub', phase: '기판 (8 × 8)', view: 'jig2', title: '8 × 8 기판 준비 (보관용 기록)',
      say: '아래 선 B1–B8 (ITO, 셀 0.2 mm) → 페로브스카이트 → 양옆 아래 선 패드 띠 닦기 → 등록 틀 + 마스크로 위 Ag 선 T1–T8. 패드 3.2 × 3.0.',
      tip: '2세대는 비휘발 · 비선형 소자가 생긴 뒤에 꺼낸다. 3D는 첫 화면의 XB16 보기.',
      tasks: [{ t: 'quiz', q: '8 × 8에서 마스크는?', opts: [{ t: 'X1 (아래 선) + X2 (위 선) + 등록 틀', ok: true },
        { t: 'Ag 한 장', hint: '그건 1세대 1 × 8이다. 8 × 8은 위아래 선이 모두 8줄이다.' }] }] },
    { id: 'g2body', phase: 'XB16 지그', view: 'jig2', title: 'XB16 조립 순서',
      say: '받침 XB16(강구 3 · 자석 2) → XB 보드(핀 16, DB25) + 맞춤핀 MS2-6 ×2 → 프레임 XB(0.8 턱) + SCB3-8 ×4 → 기판 막면 아래 → 누름 링 POM 1.2 + 폼 0.5 → 뚜껑(경첩 MS2.5-30, 자석 걸쇠) → DB25 블록 + 잭나사.',
      tasks: [{ t: 'pick', lab: '쌓는 순서', ordered: true, items: ['받침 XB16', 'XB 보드 + 맞춤핀 2', '프레임 XB + SCB3-8 ×4', '기판 막면 아래', '누름 링 1.2 + 폼 0.5', '뚜껑 + DB25 블록'],
        decoys: [{ t: 'SM 보드', hint: 'SM 보드는 1세대 솔라셀 몸체용(핀 12, DB15)이다.' }] }] },
  ];

  const NOTES = [
    'SM 보드 DB15 표: 1–8 셀 C1–C8, 9 AG+, 10 AG−, 11 R1, 12 R2, 14 GND (설계 세션이 확정)',
    '손가락 레인 · 폭 배치와 접점 B7 · B8이 붙는 손가락(그림은 T2 · T8로 가정)',
    '핀 12개 납땜 방식 (솔라셀 S 보드와 같게 할지)',
    'SM 지그 3D 모델 (sm_jig_261026.glb)이 오면 그림 대신 3D로',
    '홀더 포켓 26.54 mm는 가정값 (등록 틀 · 마스크 바깥)',
  ];

  const TRACKS = { gen1: { title: '1세대 · 솔라셀 몸체 + SM', steps: GEN1_STEPS }, gen2: { title: '2세대 · XB16 (보관)', steps: GEN2_STEPS } };

  // ============================================================ state
  function fresh(key) {
    return { key, i: 0, task: 0, done: new Set(), mistakes: 0, t0: 0, pickPos: 0, kitDone: new Set(), padSel: new Set(),
      sub: { ito: false, pvk: false, wiped: new Set(), ag: false, kit: false, layers: new Set() } };
  }
  const S = { gen1: fresh('gen1'), gen2: fresh('gen2') };
  let st = S.gen1, auto = { on: false, token: 0 }, busy = false;
  const steps = () => TRACKS[st.key].steps;
  const step = () => steps()[st.i];
  const task = () => step().tasks[st.task];

  // ============================================================ drawing
  const NS = 'http://www.w3.org/2000/svg';
  const R = (x, y, w, h, cls, extra) => `<rect x="${(x).toFixed(3)}" y="${(-y - h).toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" ${cls || ''} ${extra || ''}/>`;
  const T = (x, y, s, size, anchor, fill) => `<text x="${x}" y="${-y}" font-size="${size || 1}" text-anchor="${anchor || 'middle'}" dominant-baseline="middle"${fill ? ` style="fill:${fill}"` : ''}>${esc(s)}</text>`;
  function padRect(n) { const [x, y] = PIN[n]; const w = n[0] === 'T' ? 3.2 : 3.0, h = n[0] === 'T' ? 3.0 : 3.2; return [x - w / 2, y - h / 2, w, h]; }

  function drawSub() {
    const s = st.sub, k = step(), padTask = k && task() && task().t === 'pads';
    let g = R(-12.5, -12.5, 25, 25, 'style="fill:var(--glass);stroke:var(--muted);stroke-width:0.12"');
    if (s.ito) {
      for (const n of FINGERS) {           // finger: pad -> body at the pin x -> neck in its lane through the zone
        const [x, y] = PIN[n], w = WIDTH[n], lx = LANE(n), top = y > 0;
        g += R(x - 0.8, top ? 4.2 : -8.75, 1.6, top ? 8.75 - 4.2 : 8.75 - 0.2, 'style="fill:var(--ito);opacity:.85"');
        g += `<polygon points="${x - 0.8},${top ? -4.2 : 0.2} ${x + 0.8},${top ? -4.2 : 0.2} ${lx + w / 2},${top ? -3.6 : -0.4} ${lx - w / 2},${top ? -3.6 : -0.4}" style="fill:var(--ito);opacity:.85"/>`;
        g += R(lx - w / 2, top ? 0.5 : 0.4, w, top ? 3.1 : 3.1, 'style="fill:var(--ito);opacity:.85"');
      }
      for (const [c, f] of Object.entries(CONTACTS)) { const [cx, cy] = PIN[c], fx = PIN[f][0]; g += R(Math.min(cx, fx), cy - 0.4, Math.abs(cx - fx), 0.8, 'style="fill:var(--ito);opacity:.85"'); }
      for (const n of WIPE) { const [x, y, w, h] = padRect(n); g += R(x, y, w, h, 'style="fill:var(--ito)"'); }
    }
    if (s.pvk) g += R(-12.2, -12.2, 24.4, 24.4, 'style="fill:var(--pvk);opacity:.55"');
    for (const n of s.wiped) { const [x, y, w, h] = padRect(n); g += R(x, y, w, h, 'style="fill:var(--ito)"'); }
    if (s.ag) {
      g += R(-10.25, AG_Y - AG_W / 2, 20.5, AG_W, 'style="fill:var(--ag)"');
      for (const n of AG_PADS) { const [x, y, w, h] = padRect(n); g += R(x, y, w, h, 'style="fill:var(--ag)"'); }
      for (const n of s.wiped) { const [x, y, w, h] = padRect(n); g += R(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'style="fill:var(--ag)"'); }
      for (const n of FINGERS) { const w = WIDTH[n], lx = LANE(n); g += R(lx - w / 2, AG_Y - AG_W / 2, w, AG_W, 'style="fill:var(--hl)"'); }
    }
    if (!s.ag) g += R(-8, 1, 16, 2, 'style="fill:none;stroke:var(--wipe);stroke-width:0.12;stroke-dasharray:0.5 0.3"');
    // pin positions and labels (tap targets in the wipe step)
    for (const n of Object.keys(PIN)) {
      const [x, y, w, h] = padRect(n), sel = padTask && st.padSel.has(n), off = UNUSED.includes(n);
      g += `<g class="${padTask ? 'pad' : ''}" data-pad="${n}"${padTask ? ' tabindex="0" role="button" aria-label="패드 ' + n + '"' : ''}>` +
        R(x, y, w, h, `style="fill:${sel ? 'var(--wipe)' : 'transparent'};stroke:${off ? 'var(--muted)' : 'var(--fg)'};stroke-width:${sel ? 0.22 : 0.1};${off ? 'stroke-dasharray:0.3 0.3' : ''}"`) +
        T(PIN[n][0], PIN[n][1], n, 0.95, 'middle', off ? 'var(--muted)' : undefined) + '</g>';
    }
    let lab = '';
    if (s.ag) for (const n of FINGERS) lab += `<text x="${LANE(n)}" y="${-1.0}" font-size="0.62" text-anchor="middle" dominant-baseline="middle" style="fill:var(--fg);paint-order:stroke;stroke:var(--glass);stroke-width:0.28">${cellArea(n)}</text>`;
    const caption = !s.ito ? '25 × 25 유리 (ITO 전면) · 점선 = 교차 구역' : !s.ag ? '점선 = 교차 구역 y = 2.0 ± 1.0' : '빨강 = 셀 (숫자 = mm²) · 손가락 레인은 개념';
    $('bench').setAttribute('viewBox', '-17 -17 34 34');
    $('bench').innerHTML = `<g>${g}${lab}</g>` + T(0, -14.6, caption, 1.05, 'middle', 'var(--muted)') + T(0, 15.3, '기판을 막면에서 본 그림 (지그 안에서는 이 면이 아래)', 1.0, 'middle', 'var(--muted)');
  }

  const STACK = [   // side section of the jig, bottom to top (mm, not to scale in x)
    { key: 'base', label: 'S1 받침 (강구 3 · 자석 2)', h: 4, fill: 'var(--pom)' },
    { key: 'pcb', label: 'SM 보드 1.6 + 핀 12', h: 1.6, fill: 'var(--pcb)' },
    { key: 'frame', label: 'S2 프레임 (0.8 턱 = 멈춤면)', h: 3.2, fill: 'var(--pom)' },
    { key: 'glass', label: '기판 1.1 (막면 아래)', h: 1.1, fill: 'var(--glass)' },
    { key: 'ring', label: '누름 링 POM 1.0 + 폼 0.5', h: 1.5, fill: 'var(--muted)' },
    { key: 'lid', label: 'S3 뚜껑 (자석 걸쇠)', h: 2.5, fill: 'var(--pom)' },
    { key: 'db15', label: 'S5 DB15 블록 → 케이블', h: 0, fill: 'var(--pom)' },
  ];
  const STACK2 = ['받침 XB16', 'XB 보드 + 핀 16', '프레임 XB', '기판 (8 × 8, 막면 아래)', '누름 링 1.2 + 폼 0.5', '뚜껑', 'DB25 블록'];

  function drawJig() {
    const s = st.sub, cur = step() && step().id;
    const want = { body: ['base', 'pcb', 'frame'], glass: ['glass'], ring: ['ring', 'lid'], db15: ['db15'] }[cur] || [];
    let y = -9, g = '';
    for (const L of STACK) {
      const on = s.layers.has(L.key), next = want.includes(L.key) && !on, h = L.h || 1.2;
      const w = L.key === 'glass' ? 9 : L.key === 'ring' ? 10 : L.key === 'db15' ? 4 : 12, x = -15 + (12 - w) / 2;
      g += R(x, y, w, h, `style="fill:${on ? L.fill : 'transparent'};stroke:${next ? 'var(--hl)' : 'var(--muted)'};stroke-width:${next ? 0.3 : 0.12};${on ? '' : 'stroke-dasharray:0.5 0.4'}"`);
      if (L.key === 'pcb' && on) for (let k = -4; k <= 4; k++) if (k) g += R(-9 + k * 1.2 - 0.15, y + h, 0.3, 2.4, 'style="fill:var(--pin)"');
      g += T(-1.5, y + h / 2, L.label, 0.95, 'start', on ? undefined : 'var(--muted)');
      y += h + (L.key === 'pcb' ? 0 : 0.5);
    }
    $('bench').innerHTML = g + T(0, -12.5, '지그 옆 단면 (두께 비율만) · 빨간 테두리 = 이 단계에서 올릴 것', 1.0, 'middle', 'var(--muted)') +
      T(0, 13.5, '몸체는 솔라셀 싱글 지그 S1–S5 · 3D는 SM 지그 모델이 오면', 1.0, 'middle', 'var(--muted)');
  }

  function drawJig2() {
    let g = '';
    STACK2.forEach((t, i) => { g += R(-9, -8 + i * 2.2, 18, 1.8, 'style="fill:transparent;stroke:var(--muted);stroke-width:0.12"') + T(0, -7.1 + i * 2.2, t, 0.95); });
    $('bench').innerHTML = g + T(0, -12, '2세대 XB16: 층 순서 (아래 → 위)', 1.1, 'middle', 'var(--muted)') + T(0, 12.5, '3D 분해 보기는 첫 화면(XB16 지그)', 1.0, 'middle', 'var(--muted)');
  }

  function draw() {
    const v = step() ? step().view : 'jig';
    if (v === 'sub') drawSub(); else if (v === 'jig') drawJig(); else drawJig2();
  }

  // ============================================================ rail
  function feedback(kind, text) { $('fb').className = 'fb ' + (kind || ''); $('fb').textContent = (kind === 'bad' ? '✕ ' : kind === 'ok' ? '✓ ' : '') + text; }
  function mistake(text) { st.mistakes++; feedback('bad', text); renderMeta(); }
  function startClock() { if (!st.t0 && !auto.on) st.t0 = Date.now(); }

  function renderBar() {
    $('bar').innerHTML = steps().map((k, i) => `<span class="${st.done.has(i) ? 'done' : i === st.i ? 'cur' : ''}"></span>`).join('');
  }
  function renderMeta() {
    const t = st.t0 ? Math.round((Date.now() - st.t0) / 1000) : 0;
    $('meta').innerHTML = `<span>${Math.min(st.i + 1, steps().length)} / ${steps().length} 단계</span><span>실수 ${st.mistakes}</span><span>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</span>`;
    $('hud').textContent = step() ? step().phase + ' · ' + step().title : '끝';
  }
  function renderCard() {
    const k = step();
    if (!k) { $('card').innerHTML = `<p class="phase">끝</p><h2>${esc(TRACKS[st.key].title)} 완료</h2><p>실수 ${st.mistakes}번. 다음은 <a href="measure.html">연결하는 법</a>.</p>`; return; }
    const tk = task();
    $('card').innerHTML = `<p class="phase">${esc(k.phase)} · ${st.i + 1}단계</p><h2>${esc(k.title)}</h2><p>${esc(k.say)}</p>` + (k.tip ? `<p class="tip">${esc(k.tip)}</p>` : '') +
      (tk && tk.t === 'quiz' ? `<p class="q">${esc(tk.q)}</p>` : '') + (tk && tk.t === 'pads' ? `<p class="q">닦을 패드 ${st.padSel.size} / ${tk.want.length}</p>` : '');
  }
  function renderPicks() {
    const tk = step() && task(), el = $('picks');
    if (!tk) { el.innerHTML = ''; return; }
    if (tk.t === 'quiz') {
      const opts = order(tk.opts.map((o, i) => ({ o, i })), st.i * 7 + st.task);
      el.innerHTML = opts.map(({ o, i }) => `<button class="pk" data-ans="${i}" type="button">${esc(o.t)}</button>`).join('');
    } else if (tk.t === 'pick') {
      const all = order(tk.items.map((t, i) => ({ t, i, ok: true })).concat((tk.decoys || []).map((d, j) => ({ t: d.t, j, ok: false }))), st.i * 13 + 1);
      el.innerHTML = `<p class="lab">${esc(tk.lab)}${tk.ordered ? ' (순서대로)' : ''}</p>` + all.map((e) => {
        const done = e.ok && e.i < st.pickPos;
        return `<button class="pk ${done ? 'done' : ''}" type="button" data-pick="${e.ok ? 'i' + e.i : 'd' + e.j}">${done ? `<span class="n">${e.i + 1}</span>` : ''}${esc(e.t)}</button>`;
      }).join('');
    } else if (tk.t === 'kit') {
      el.innerHTML = `<p class="lab">부품 목록: 눌러서 확인</p>` + tk.rows.map((r, i) => `<button class="pk kit ${st.kitDone.has(i) ? 'done' : ''}" type="button" data-kit="${i}"><span class="n">${st.kitDone.has(i) ? '✓' : i + 1}</span>${esc(r.label)}<span class="qty">× ${esc(r.qty)}</span></button>`).join('') +
        `<button class="pk" type="button" data-kitall>모두 확인</button>`;
    } else if (tk.t === 'pads') {
      el.innerHTML = `<p class="lab">그림의 패드를 누르거나 여기서 고른다</p>` + Object.keys(PIN).map((n) => `<button class="pk ${st.padSel.has(n) ? 'done' : ''}" type="button" data-padbtn="${n}">${n}</button>`).join('') +
        `<button class="btn" type="button" data-padcheck>다 골랐다</button>`;
    }
  }
  function order(a, seed) { let s = (seed * 2654435761) >>> 0 || 1; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296, b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function renderSteps() {
    let ph = '', html = '';
    steps().forEach((k, i) => {
      if (k.phase !== ph) { ph = k.phase; html += `<li class="ph">${esc(ph)}</li>`; }
      html += `<li><button type="button" data-jump="${i}" class="${i === st.i ? 'cur' : ''}"><span class="s">${st.done.has(i) ? '✓' : ''}</span>${i + 1}. ${esc(k.title)}</button></li>`;
    });
    $('steps').innerHTML = html;
  }
  function renderAll() { renderBar(); renderMeta(); renderCard(); renderPicks(); renderSteps(); draw();
    $('tr-gen1').setAttribute('aria-pressed', st.key === 'gen1'); $('tr-gen2').setAttribute('aria-pressed', st.key === 'gen2'); }

  // ============================================================ actions
  function completeTask(msg) {
    feedback('ok', msg || '맞다.');
    st.task++; st.pickPos = 0; st.kitDone = new Set(); st.padSel = new Set();
    if (st.task >= step().tasks.length) {
      if (step().apply) step().apply(st.sub);
      st.done.add(st.i); st.i++; st.task = 0;
    }
    renderAll();
  }
  function onAnswer(i) {
    const tk = task(), o = tk.opts[i]; startClock();
    if (o.ok) completeTask('맞다. ' + (step().tip ? '' : '')); else mistake(o.hint || '다시 생각해 보자.');
  }
  function onPick(id) {
    const tk = task(); startClock();
    if (id[0] === 'd') { mistake(tk.decoys[+id.slice(1)].hint); return; }
    const i = +id.slice(1);
    if (i < st.pickPos) return;
    if (tk.ordered && i !== st.pickPos) { mistake(`아직 아니다. 먼저 "${tk.items[st.pickPos]}".`); return; }
    st.pickPos++;
    if (st.pickPos >= tk.items.length) completeTask(); else { feedback('ok', tk.items[i]); renderPicks(); }
  }
  function onKit(i) { startClock(); st.kitDone.add(i); if (st.kitDone.size >= task().rows.length) completeTask('부품을 다 챙겼다.'); else renderPicks(); }
  function onPad(n) {
    const tk = task(); startClock();
    if (tk.avoid && tk.avoid[n]) { mistake(tk.avoid[n]); return; }
    if (st.padSel.has(n)) st.padSel.delete(n); else st.padSel.add(n);
    renderCard(); renderPicks(); draw();
  }
  function onPadCheck() {
    const tk = task(), miss = tk.want.filter((n) => !st.padSel.has(n)), extra = [...st.padSel].filter((n) => !tk.want.includes(n));
    if (miss.length) { mistake(`덜 닦았다: ${miss.join(' · ')}. 핀이 닿는 ITO 패드는 손가락 ${FINGERS.length}곳 + 접점 2곳이다.`); return; }
    if (extra.length) { mistake(`${extra.join(' · ')}는 닦을 곳이 아니다.`); return; }
    completeTask(`${tk.want.length}곳을 닦았다.`);
  }

  function solveTask() {                 // does the current task the right way (보기만, jumps and the self-test)
    const tk = task();
    if (tk.t === 'quiz') onAnswer(tk.opts.findIndex((o) => o.ok));
    else if (tk.t === 'pick') { while (step() && task() === tk) onPick('i' + st.pickPos); }
    else if (tk.t === 'kit') { tk.rows.forEach((r, i) => st.kitDone.add(i)); completeTask('부품을 다 챙겼다.'); }
    else if (tk.t === 'pads') { st.padSel = new Set(tk.want); onPadCheck(); }
  }
  async function play() {
    if (auto.on) { auto.on = false; auto.token++; renderCtrl(); return; }
    auto.on = true; const my = ++auto.token; renderCtrl();
    while (auto.on && my === auto.token && step()) { await sleep(900); if (!auto.on || my !== auto.token) break; solveTask(); }
    auto.on = false; renderCtrl();
  }
  function renderCtrl() { $('auto').textContent = auto.on ? '멈춤 ■' : '보기만 ▶'; }
  function jumpTo(i) {
    const key = st.key; S[key] = fresh(key); st = S[key];
    while (st.i < i && step()) { const m = st.mistakes; solveTask(); st.mistakes = m; }
    feedback('', ''); renderAll();
  }
  function setTrack(key) { auto.on = false; auto.token++; renderCtrl(); st = S[key]; feedback('', ''); renderAll(); }

  // ============================================================ events
  $('picks').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || auto.on) return;
    if (b.dataset.ans != null) onAnswer(+b.dataset.ans);
    else if (b.dataset.pick) onPick(b.dataset.pick);
    else if (b.dataset.kit != null) onKit(+b.dataset.kit);
    else if (b.hasAttribute('data-kitall')) { task().rows.forEach((r, i) => st.kitDone.add(i)); completeTask('부품을 다 챙겼다.'); }
    else if (b.dataset.padbtn) onPad(b.dataset.padbtn);
    else if (b.hasAttribute('data-padcheck')) onPadCheck();
  });
  $('bench').addEventListener('click', (e) => { const g = e.target.closest('[data-pad]'); if (g && g.classList.contains('pad') && !auto.on) onPad(g.dataset.pad); });
  $('bench').addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const g = e.target.closest('[data-pad]'); if (g && g.classList.contains('pad')) { e.preventDefault(); onPad(g.dataset.pad); } });
  $('steps').addEventListener('click', (e) => { const b = e.target.closest('[data-jump]'); if (b) jumpTo(+b.dataset.jump); });
  $('auto').addEventListener('click', play);
  $('restart').addEventListener('click', () => { S[st.key] = fresh(st.key); setTrack(st.key); });
  $('tr-gen1').addEventListener('click', () => setTrack('gen1'));
  $('tr-gen2').addEventListener('click', () => setTrack('gen2'));
  setInterval(() => { if (st.t0 && step()) renderMeta(); }, 1000);
  $('notes').innerHTML = NOTES.map((n) => `<li>${esc(n)}</li>`).join('');

  // ============================================================ self-test
  function validate() {
    const errs = [];
    for (const [key, tr] of Object.entries(TRACKS)) tr.steps.forEach((k, i) => {
      if (!k.tasks || !k.tasks.length) errs.push(`${key} ${i + 1}: 할 일 없음`);
      for (const tk of k.tasks || []) {
        if (tk.t === 'quiz' && tk.opts.filter((o) => o.ok).length !== 1) errs.push(`${key} ${k.id}: 정답이 하나가 아님`);
        if (tk.t === 'quiz' && tk.opts.some((o) => !o.ok && !o.hint)) errs.push(`${key} ${k.id}: 오답에 이유 없음`);
        if (tk.t === 'pick' && (!tk.items.length || (tk.decoys || []).some((d) => !d.hint))) errs.push(`${key} ${k.id}: 고르기 자료`);
        if (tk.t === 'pads' && tk.want.some((n) => !PIN[n])) errs.push(`${key} ${k.id}: 없는 패드`);
        if (tk.t === 'pads' && Object.keys(tk.avoid || {}).some((n) => tk.want.includes(n))) errs.push(`${key} ${k.id}: 닦을 곳과 피할 곳이 겹침`);
      }
    });
    if (WIPE.length !== 10) errs.push('닦을 패드 수가 10이 아님');
    const cells = FINGERS.map((n) => WIDTH[n]); if (cells.filter((w) => w === 2).length !== 3 || cells.filter((w) => w === 1).length !== 3 || cells.filter((w) => w === 0.5).length !== 2) errs.push('셀 폭 3 / 3 / 2가 아님');
    if (FINGERS.length + AG_PADS.length + Object.keys(CONTACTS).length !== 12) errs.push('핀 수가 12가 아님');
    return errs;
  }
  function runAll() {
    const keep = { S0: S.gen1, S1: S.gen2, st }, out = [];
    for (const key of Object.keys(TRACKS)) {
      S[key] = fresh(key); st = S[key];
      let guard = 0; while (step() && guard++ < 200) solveTask();
      out.push({ name: key + ' 바른 순서로 끝까지', pass: !step() && st.mistakes === 0 });
    }
    S.gen1 = fresh('gen1'); st = S.gen1; onAnswer(task().opts.findIndex((o) => !o.ok));
    out.push({ name: '오답은 실수 1', pass: st.mistakes === 1 && st.i === 0 });
    S.gen1 = fresh('gen1'); st = S.gen1; while (step().id !== 'wipe') solveTask(); onPad('B3');
    out.push({ name: 'B3 닦기는 실수', pass: st.mistakes === 1 });
    st.padSel = new Set(WIPE.slice(1)); onPadCheck();
    out.push({ name: '한 곳 덜 닦으면 진행 안 됨', pass: step().id === 'wipe' && st.mistakes === 2 });
    S.gen1 = keep.S0; S.gen2 = keep.S1; st = keep.st;
    feedback('', ''); renderAll();
    return out;
  }

  window.__asm = { validate, runAll, get state() { return st; }, TRACKS, PIN, FINGERS, WIDTH };
  const v = validate(), r = runAll(), pass = r.filter((x) => x.pass).length + (v.length ? 0 : 1);
  $('selftest').textContent = `자체 점검: ${pass} / ${r.length + 1} 통과` + (v.length ? ' · 자료 오류: ' + v.join(', ') : '');
  renderAll();
})();
