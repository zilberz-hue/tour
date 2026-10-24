// =====================================================================
//  Tizon Tour – שפות: עברית (ברירת מחדל) / English
//  הממשק נכתב בעברית; במצב אנגלית כל טקסט שמופיע במסך מתורגם אוטומטית
//  לפי המילון ב-i18n-en.js (טקסט מלא, ואם אין – לפי ביטויים ידועים בתוכו).
//  מוסיפים טקסט חדש לממשק? מוסיפים שורה ב-i18n-en.js (ראו CLAUDE.md).
// =====================================================================
import EN from './i18n-en.js';

export const I18N = { lang: 'he' };
const HEB = /[֐-׿]/;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let phraseRe = null;

export function detectLang() {
  try { const s = localStorage.getItem('tt-lang'); if (s === 'he' || s === 'en') return s; } catch (e) { }
  return (navigator.language || 'he').toLowerCase().startsWith('he') ? 'he' : 'en';
}
export const isEn = () => I18N.lang === 'en';
export const LOC = () => (I18N.lang === 'en' ? 'en-US' : 'he-IL');

function buildRe() {
  // ביטויים באורך 3+ בלבד, מהארוך לקצר, ורק כמילה שלמה (לא באמצע מילה עברית)
  const keys = Object.keys(EN).filter(k => k.length >= 3 && HEB.test(k)).sort((a, b) => b.length - a.length).map(esc);
  // אות שימוש בתחילת מילה (ו/ב/ל/מ/ה/ש/כ) לפני ביטוי מוכר – "ומה חדש" → "and What's new"
  phraseRe = keys.length ? new RegExp(`(?<![\\u0590-\\u05FF])([ובלמהשכ]?)(${keys.join('|')})(?![\\u0590-\\u05FF])`, 'g') : null;
}

// תרגום מחרוזת (לטקסטים מחוץ למסך: הודעות, הקראה, confirm)
export function tr(s) {
  if (I18N.lang !== 'en' || s == null) return s;
  s = String(s); if (!HEB.test(s)) return s;
  const t = s.trim();
  if (EN[t] != null) return s.replace(t, () => EN[t]);
  if (!phraseRe) buildRe();
  const PRE = { 'ו': 'and ', 'ב': 'in ', 'ל': 'to ', 'מ': 'from ', 'ה': '', 'ש': 'that ', 'כ': 'as ' };
  let out = phraseRe ? s.replace(phraseRe, (m, pre, k) => EN[k] == null ? m : (pre ? PRE[pre] : '') + EN[k]) : s;
  out = out.replace(/(\d)\s?ש׳/g, '$1h').replace(/(\d)\s?ד׳/g, '$1min').replace(/(\d)\s?שנ׳/g, '$1s').replace(/(\d)\s?מ״מ/g, '$1mm').replace(/(\d)\s?ק״מ/g, '$1 km').replace(/(\d)\s?מ׳/g, '$1 m');
  return out;
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
function trNode(n) {
  if (n.nodeType === 3) { const v = n.nodeValue; if (v && HEB.test(v)) { const x = tr(v); if (x !== v) n.nodeValue = x; } return; }
  if (n.nodeType !== 1 || n.hasAttribute?.('data-notr')) return;
  const tag = n.tagName; if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
  for (const a of ATTRS) { const v = n.getAttribute(a); if (v && HEB.test(v)) { const x = tr(v); if (x !== v) n.setAttribute(a, x); } }
  if (tag === 'INPUT' && /^(button|submit)$/i.test(n.type) && HEB.test(n.value)) { const x = tr(n.value); if (x !== n.value) n.value = x; }
  for (const c of n.childNodes) trNode(c);
}

export function initI18n() {
  I18N.lang = detectLang();
  const r = document.documentElement;
  r.lang = I18N.lang; r.dir = I18N.lang === 'en' ? 'ltr' : 'rtl'; r.dataset.lang = I18N.lang;
  if (I18N.lang !== 'en') return;
  document.title = 'Tizon Tour';
  trNode(document.body);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') trNode(m.target);
      else if (m.type === 'attributes') trNode(m.target);
      else m.addedNodes.forEach(trNode);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // חלונות מערכת
  const c = window.confirm.bind(window); window.confirm = m => c(tr(m));
  const a = window.alert.bind(window); window.alert = m => a(tr(m));
}
export function setLang(l) {
  try { localStorage.setItem('tt-lang', l); } catch (e) { }
  location.reload();
}
