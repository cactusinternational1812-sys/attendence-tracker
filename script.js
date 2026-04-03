/**
 * College attendance: 75% = exam eligible. 85% = typical cutoff for full internal / +5 marks.
 * All math uses consecutive classes; user enters attended & total held so far.
 */

const STORAGE_KEY = 'campus-attend-college-v1';
const EXAM_MIN = 75;
const INTERNAL_MIN = 85;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { subjects: [] };
    const data = JSON.parse(raw);
    return { subjects: Array.isArray(data.subjects) ? data.subjects : [] };
  } catch {
    return { subjects: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clampNonNeg(n) {
  const x = Number(n);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

function pct(attended, total) {
  if (total <= 0) return 0;
  return (100 * attended) / total;
}

/** Consecutive perfect attendance needed from now to reach target% */
function classesNeededToReach(attended, total, targetPct) {
  const a = clampNonNeg(attended);
  const t = clampNonNeg(total);
  if (t <= 0) return null;
  const need = (targetPct / 100) * t - a;
  if (need <= 0) return 0;
  const num = targetPct * t - 100 * a;
  const den = 100 - targetPct;
  if (den <= 0) return null;
  return Math.ceil(num / den);
}

/** Max skips (counted as extra held, not attended) while staying at or above target% */
function maxBunksWhileAbove(attended, total, targetPct) {
  const a = clampNonNeg(attended);
  const t = clampNonNeg(total);
  if (t <= 0 || a > t) return 0;
  const headroom = a - (targetPct / 100) * t;
  if (headroom < 0) return 0;
  const den = targetPct / 100;
  if (den <= 0) return 0;
  return Math.floor(headroom / den);
}

function overallStats(subjects) {
  let attended = 0;
  let total = 0;
  for (const s of subjects) {
    attended += clampNonNeg(s.attended);
    total += clampNonNeg(s.total);
  }
  return { attended, total, percentage: pct(attended, total) };
}

function statusLabel(p, examMin, internalMin) {
  if (p >= internalMin) return { key: 'internal', text: 'Internal-safe', detail: `≥${internalMin}% — full internals / +5 marks band` };
  if (p >= examMin) return { key: 'exam', text: 'Exam eligible', detail: `≥${examMin}% — can write exams; below ${internalMin}% for max internals` };
  return { key: 'risk', text: 'Below cutoff', detail: `Under ${examMin}% — not exam-eligible until you recover` };
}

function render() {
  const state = loadState();
  const root = document.getElementById('subjects');
  const overallEl = document.getElementById('overall-panel');
  if (!root || !overallEl) return;

  const o = overallStats(state.subjects);
  const oPct = o.percentage;
  const oExam = statusLabel(oPct, EXAM_MIN, INTERNAL_MIN);
  const need75o = classesNeededToReach(o.attended, o.total, EXAM_MIN);
  const need85o = classesNeededToReach(o.attended, o.total, INTERNAL_MIN);
  const bunk75o = maxBunksWhileAbove(o.attended, o.total, EXAM_MIN);
  const bunk85o = maxBunksWhileAbove(o.attended, o.total, INTERNAL_MIN);

  const emptyEl = document.getElementById('empty-placeholder');
  if (emptyEl) emptyEl.hidden = state.subjects.length > 0;

  overallEl.innerHTML = `
    <div class="overall-header">
      <span class="overall-title">Overall attendance</span>
      <span class="badge badge--${oExam.key}">${oExam.text}</span>
    </div>
    <p class="overall-detail">${oExam.detail}</p>
    <div class="big-pct">${o.total ? oPct.toFixed(1) : '—'}<span class="big-pct-suffix">%</span></div>
    <div class="stat-row"><span>Attended</span><strong>${o.attended}</strong></div>
    <div class="stat-row"><span>Total classes</span><strong>${o.total}</strong></div>
    <div class="progress-bar-bg" aria-hidden="true"><div class="progress-bar-fill" style="width:${Math.min(100, oPct)}%"></div></div>
    <div class="insight-grid">
      <div class="insight">
        <span class="insight-label">${EXAM_MIN}% (exams)</span>
        ${o.total === 0 ? '<p class="insight-text">Add subjects to see projections.</p>' : oPct >= EXAM_MIN
          ? `<p class="insight-text">You can skip up to <strong>${bunk75o}</strong> more class(es) (not attending) and stay at or above ${EXAM_MIN}%.</p>`
          : `<p class="insight-text">Need <strong>${need75o}</strong> more consecutive present(s) to reach ${EXAM_MIN}% (if every new class counts).</p>`}
      </div>
      <div class="insight">
        <span class="insight-label">${INTERNAL_MIN}% (+5 / internals)</span>
        ${o.total === 0 ? '' : oPct >= INTERNAL_MIN
          ? `<p class="insight-text">Buffer: skip up to <strong>${bunk85o}</strong> class(es) and stay ≥${INTERNAL_MIN}%.</p>`
          : `<p class="insight-text">Need <strong>${need85o}</strong> more consecutive present(s) to reach ${INTERNAL_MIN}%.</p>`}
      </div>
    </div>
  `;

  const emptyPh = document.getElementById('empty-placeholder');
  if (emptyPh) {
    emptyPh.hidden = state.subjects.length > 0;
  }

  root.innerHTML = '';
  state.subjects.forEach((s, index) => {
    const a = clampNonNeg(s.attended);
    const t = clampNonNeg(s.total);
    const p = pct(a, t);
    const st = statusLabel(p, EXAM_MIN, INTERNAL_MIN);
    const n75 = t ? classesNeededToReach(a, t, EXAM_MIN) : null;
    const n85 = t ? classesNeededToReach(a, t, INTERNAL_MIN) : null;
    const b75 = t ? maxBunksWhileAbove(a, t, EXAM_MIN) : 0;
    const b85 = t ? maxBunksWhileAbove(a, t, INTERNAL_MIN) : 0;

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <input type="text" class="input input--name" placeholder="Subject name (e.g. DBMS)" value="${escapeHtml(s.name)}" data-field="name" data-index="${index}" />
        <button type="button" class="icon-btn" data-remove="${index}" aria-label="Remove subject">×</button>
      </div>
      <div class="card-metrics">
        <label class="field">
          <span>Attended</span>
          <input type="number" min="0" class="input" value="${a}" data-field="attended" data-index="${index}" inputmode="numeric" />
        </label>
        <label class="field">
          <span>Total held</span>
          <input type="number" min="0" class="input" value="${t}" data-field="total" data-index="${index}" inputmode="numeric" />
        </label>
      </div>
      <div class="card-pct-row">
        <span class="subject-pct ${pctClass(p)}">${t ? p.toFixed(1) + '%' : '—'}</span>
        <span class="badge badge--sm badge--${st.key}">${st.text}</span>
      </div>
      <div class="progress-bar-bg progress-bar-bg--sm"><div class="progress-bar-fill" style="width:${t ? Math.min(100, p) : 0}%"></div></div>
      <div class="subject-insights">
        ${!t ? '<p class="hint">Enter total classes held to unlock projections.</p>' : ''}
        ${t && a > t ? '<p class="hint warn">Attended cannot exceed total — fix numbers.</p>' : ''}
        ${t && a <= t && p < EXAM_MIN ? `<p class="hint"><strong>${EXAM_MIN}%:</strong> attend <strong>${n75}</strong> more in a row (each counts) to reach ${EXAM_MIN}%.</p>` : ''}
        ${t && a <= t && p >= EXAM_MIN ? `<p class="hint"><strong>${EXAM_MIN}%:</strong> can bunk up to <strong>${b75}</strong> future class(es) (missed) and stay eligible.</p>` : ''}
        ${t && a <= t && p < INTERNAL_MIN ? `<p class="hint"><strong>${INTERNAL_MIN}%:</strong> need <strong>${n85}</strong> more consecutive presents for the +5 / internal band.</p>` : ''}
        ${t && a <= t && p >= INTERNAL_MIN ? `<p class="hint"><strong>${INTERNAL_MIN}%:</strong> can bunk up to <strong>${b85}</strong> and stay ≥${INTERNAL_MIN}%.</p>` : ''}
      </div>
    `;
    root.appendChild(card);
  });

  root.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('change', onFieldChange);
    if (el.getAttribute('data-field') === 'name') {
      el.addEventListener('blur', onFieldChange);
    }
  });
  root.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.getAttribute('data-remove'));
      const st = loadState();
      st.subjects.splice(i, 1);
      saveState(st);
      render();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function pctClass(p) {
  if (p >= INTERNAL_MIN) return 'pct-internal';
  if (p >= EXAM_MIN) return 'pct-exam';
  return 'pct-low';
}

function onFieldChange(e) {
  const el = e.target;
  const index = Number(el.getAttribute('data-index'));
  const field = el.getAttribute('data-field');
  if (field == null || Number.isNaN(index)) return;

  const state = loadState();
  const s = state.subjects[index];
  if (!s) return;

  if (field === 'name') s.name = el.value.trim();
  if (field === 'attended') s.attended = clampNonNeg(el.value);
  if (field === 'total') s.total = clampNonNeg(el.value);
  if (s.attended > s.total) s.attended = s.total;

  saveState(state);
  render();
}

function addSubject() {
  const state = loadState();
  state.subjects.push({ name: '', attended: 0, total: 0 });
  saveState(state);
  render();
}

window.addSubject = addSubject;
document.addEventListener('DOMContentLoaded', render);
