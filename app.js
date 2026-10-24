// =====================================================================
//  Tizon Tour – ניהול טיולים: מסלול, תקציב, הזמנות ורשימות
//  Vanilla JS + Firebase (Auth / Firestore / Storage). מצב מקומי כגיבוי.
// =====================================================================
import { firebaseConfig } from './firebase-config.js';

const FB_VER = '10.12.2';
const LS_KEY = 'tizon-tour-v5';
const $ = (s, el = document) => el.querySelector(s);

// ---------- גרסה ויומן שינויים ----------
// לעדכן בכל העלאה: APP_VERSION + שורה חדשה בראש CHANGELOG (וגם CACHE ב-sw.js)
const APP_VERSION = '1.9.0';
const APP_BUILD = '2026-10-24 15:20';
const CHANGELOG = [
  ['1.9.0', '24/10/2026 15:20', ['בדיקת מחירים חיה: חיווי לכל מנוע בנפרד (Duffel, Google Flights, Aviasales, Google Hotels) והתוצאות נפתחות אוטומטית', 'בדיקה אוטומטית לפי מרווח לבחירה: 10 דק׳, רבע שעה, חצי שעה, שעה, 3 או 6 שעות, או כל מספר דקות', '"סוכן חכם" (במקום "יועץ AI") – לשונית קטנה בקצה המסך שלא מפריעה', 'מספר גרסה ו"מה חדש"']],
  ['1.8.1', '24/10/2026 15:07', ['תוקן: כפתור ⚙️ הגדרות לא נפתח', 'פונטים גדולים יותר', 'תצוגה מותאמת לטלפון, טאבלט ומחשב (סרגל צד במחשב)']],
  ['1.8.0', '24/10/2026 15:00', ['ערכת צבע בהירה + בחירה: כהה / בהיר / אוטומטי לפי המכשיר']],
  ['1.7.1', '24/10/2026 12:45', ['תוקן: הבהוב וריצוד של המסך (לולאת בדיקת מחירים)']],
  ['1.7.0', '24/10/2026 08:16', ['יועץ AI אונליין שמכיר את כל הטיול, מחפש מחירים ומוסיף למסלול']],
  ['1.6.0', '24/10/2026 02:30', ['השוואת תאריכים ±3 ימים לטיסות ולמלונות']],
  ['1.5.0', '24/10/2026', ['מפה, מזג אוויר, חלוקת הוצאות, התראות מחיר, אופליין, ייבוא מהמייל, סיכום בוקר, Uber / Lyft / Waze']],
  ['1.4.0', '23/10/2026', ['מועדפים, מזוודות כלולות/לא כלולות, חוות דעת']],
  ['1.3.0', '23/10/2026', ['מדריך קולי עם קריין, מקומות ושירותים קרובים']],
  ['1.2.0', '23/10/2026', ['חיפוש חי בכל הספקים במקביל, השוואה אמיתית (הכי זול / הכי משתלם), כל האתרים בעברית']],
  ['1.0.0', '23/10/2026', ['גרסה ראשונה: מסלול, תקציב, הזמנות, רשימות, טיול קרמל']]
];
function openChangelog() {
  const dlg = $('#modal'); $('#modalTitle').textContent = `מה חדש · גרסה ${APP_VERSION}`;
  $('#modalBody').innerHTML = `<div class="small muted" style="margin-bottom:10px">עודכן לאחרונה: ${APP_BUILD.split(' ')[0].split('-').reverse().join('/')} בשעה ${APP_BUILD.split(' ')[1]}</div>` +
    CHANGELOG.map(([v, d, items], i) => `<div class="cl-item ${i === 0 ? 'cur' : ''}"><div class="row"><b>גרסה ${v}</b>${i === 0 ? '<span class="chip ok">נוכחית</span>' : ''}<span class="spacer"></span><span class="small muted">${d}</span></div><ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');
  $('#modalDelete').hidden = true; $('#modalSave').textContent = 'סגירה';
  $('#modalCancel').onclick = () => dlg.close(); $('#modalForm').onsubmit = e => { e.preventDefault(); dlg.close(); };
  dlg.showModal();
}

const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- utils ----------
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const parseDate = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const fmtDate = (s, withDow = true) => { const d = parseDate(s); if (!d) return ''; return (withDow ? `יום ${DOW[d.getDay()]}, ` : '') + `${d.getDate()}/${d.getMonth() + 1}`; };
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const CUR = { ILS: '₪', USD: '$', EUR: '€' };
const fmtMoney = (n, c = 'ILS') => `${CUR[c] || ''}${Math.round(n || 0).toLocaleString('en-US')}`;
const fmtRange = (a, b) => `<bdi dir="ltr">${fmtDate(a, false)}${b && b !== a ? '–' + fmtDate(b, false) : ''}</bdi>`;
const mapsUrl = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}&hl=iw`;

function tripDays(trip) {
  const out = []; const s = parseDate(trip.start), e = parseDate(trip.end);
  if (!s || !e || e < s) return out;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(isoDate(d));
  return out;
}
const toILS = (trip, amount, cur) => cur === 'ILS' || !cur ? Number(amount) || 0 : (Number(amount) || 0) * (Number(trip.rates?.[cur]) || 1);

// ---------- constants ----------
const CATS = [
  { id: 'flights', name: 'טיסות', ico: '✈️' },
  { id: 'lodging', name: 'לינה', ico: '🏨' },
  { id: 'car', name: 'רכב וביטוח רכב', ico: '🚗' },
  { id: 'fuel', name: 'דלק וחניות', ico: '⛽' },
  { id: 'food', name: 'אוכל', ico: '🍽️' },
  { id: 'attractions', name: 'אטרקציות', ico: '🎟️' },
  { id: 'insurance', name: 'ביטוח נסיעות', ico: '🛡️' },
  { id: 'shopping', name: 'קניות', ico: '🛍️' },
  { id: 'misc', name: 'שונות', ico: '📦' }
];
const catById = id => CATS.find(c => c.id === id) || CATS[CATS.length - 1];
const BOOK_TYPES = [
  { id: 'flight', name: 'טיסה', ico: '✈️', cat: 'flights' },
  { id: 'hotel', name: 'מלון', ico: '🏨', cat: 'lodging' },
  { id: 'car', name: 'רכב', ico: '🚗', cat: 'car' },
  { id: 'insurance', name: 'ביטוח', ico: '🛡️', cat: 'insurance' },
  { id: 'activity', name: 'אטרקציה', ico: '🎟️', cat: 'attractions' },
  { id: 'restaurant', name: 'מסעדה', ico: '🍽️', cat: 'food' },
  { id: 'other', name: 'אחר', ico: '📄', cat: 'misc' }
];
const bookType = id => BOOK_TYPES.find(t => t.id === id) || BOOK_TYPES[BOOK_TYPES.length - 1];
const STATUS = { planned: { name: 'מתוכנן', cls: '' }, booked: { name: 'הוזמן', cls: 'warn' }, paid: { name: 'שולם', cls: 'ok' } };
const PACK_TEMPLATE = ['דרכון', 'רישיון נהיגה + רישיון בינלאומי', 'כרטיס אשראי נוסף', 'מטען לטלפון + מתאם לשקע אמריקאי', 'מעיל / שכבות חמות', 'נעלי הליכה', 'משקפי שמש', 'תרופות קבועות', 'בקבוק מים רב פעמי', 'אוזניות'];
const TASK_TEMPLATE = ['לבדוק תוקף דרכון', 'ESTA / ויזה', 'ביטוח נסיעות', 'להזמין טיסות', 'להזמין לינה', 'להזמין רכב', 'להוריד מפות אופליין', 'להודיע לחברת האשראי על נסיעה'];

// ---------- new trip / seed ----------
function blankTrip(p = {}) {
  return {
    id: uid(), name: p.name || 'טיול חדש', destination: p.destination || '', emoji: p.emoji || '🧭',
    start: p.start || isoDate(new Date()), end: p.end || isoDate(new Date(Date.now() + 4 * 864e5)),
    travelers: Number(p.travelers) || 2, rates: { USD: Number(p.rateUSD) || 3.1, EUR: Number(p.rateEUR) || 3.4 },
    budget: Object.fromEntries(CATS.map(c => [c.id, 0])),
    days: {}, expenses: [], bookings: [], lists: { packing: [], tasks: [] }, favorites: [],
    travelersList: p.travelersList || [{ name: 'אני', origin: 'TLV' }], airport: p.airport || '', city: p.city || '',
    ownerId: null, members: [], inviteEmails: [], createdAt: Date.now(), updatedAt: Date.now()
  };
}

function seedCarmel() {
  const t = blankTrip({ name: 'סן פרנסיסקו → קרמל', destination: 'קליפורניה, ארה״ב', emoji: '🌊', start: '2026-11-18', end: '2026-11-23', travelers: 2, rateUSD: 3.1, airport: 'SFO', city: 'Carmel-by-the-Sea, CA', travelersList: [{ name: 'צחי', origin: 'TLV' }, { name: 'רחל', origin: 'DFW' }] });
  t.budget = { flights: 4330, lodging: 3700, car: 2015, fuel: 435, food: 2790, attractions: 400, insurance: 400, shopping: 0, misc: 1025 };
  const S = (time, title, place, notes = '') => ({ id: uid(), time, title, place, notes });
  t.days = {
    '2026-11-18': { title: 'נחיתה ולילה בהאף מון ביי', notes: 'חושך כבר ב-17:00 – לא לנסוע בכביש 1 בלילה.', stops: [S('11:15', 'רחל נוחתת מדאלאס', 'SFO Terminal 2'), S('11:45', 'צחי נוחת מת״א (KLM)', 'SFO International Terminal'), S('12:30', 'איסוף רכב', 'SFO Rental Car Center'), S('17:30', 'ארוחת ערב בנמל', 'Pillar Point Harbor, Half Moon Bay')] },
    '2026-11-19': { title: 'לאורך החוף לקרמל', notes: '', stops: [S('09:30', 'מגדלור פיג׳ן פוינט', 'Pigeon Point Lighthouse'), S('11:30', 'West Cliff וצהריים', 'West Cliff Drive, Santa Cruz'), S('13:30', 'לוטרות ים', 'Moss Landing'), S('14:30', 'מקדש הפרפרים', 'Monarch Butterfly Sanctuary, Pacific Grove'), S('16:00', 'צ׳ק-אין בקרמל', 'Carmel-by-the-Sea')] },
    '2026-11-20': { title: 'ביג סור', notes: 'לחזור עד 16:30. לבדוק Caltrans יום קודם.', stops: [S('08:00', 'פוינט לובוס – להגיע בפתיחה', 'Point Lobos State Natural Reserve'), S('11:00', 'גשר ביקסבי', 'Bixby Creek Bridge'), S('12:30', 'צהריים עם נוף', 'Nepenthe, Big Sur')] },
    '2026-11-21': { title: 'מונטריי ו-17 מייל', notes: '', stops: [S('10:00', 'אקווריום מונטריי', 'Monterey Bay Aquarium'), S('13:00', 'קאנרי רו', 'Cannery Row, Monterey'), S('15:30', '17-Mile Drive עד ה-Lone Cypress', 'Lone Cypress, Pebble Beach'), S('16:45', 'שקיעה בחוף קרמל', 'Carmel Beach')] },
    '2026-11-22': { title: 'קרמל וקרמל ואלי', notes: '', stops: [S('11:30', 'המיסיון', 'Carmel Mission Basilica'), S('13:00', 'הסתובבות בעיירה', 'Ocean Ave, Carmel-by-the-Sea'), S('15:00', 'יקבים בקרמל ואלי', 'Carmel Valley Village')] },
    '2026-11-23': { title: 'יציאה', notes: 'שתי טיסות מ-SFO בצהריים → לצאת מקרמל ב-06:30. החזרת רכב לפני הצ׳ק-אין.', stops: [S('06:30', 'יציאה לשדה', 'SFO'), S('11:27', 'רחל טסה לדאלאס', 'SFO'), S('12:00', 'צחי טס לת״א', 'SFO International Terminal')] }
  };
  const B = (type, title, provider, start, end, price, currency, status = 'planned', notes = '', link = '') => ({ id: uid(), type, title, provider, conf: '', start, end, price, currency, status, link, notes, file: null });
  t.bookings = [
    B('flight', 'צחי: TLV ⇄ SFO · KLM', 'KLM (Kiwi.com)', '2026-11-18', '2026-11-23', 1067, 'USD', 'planned', '🏆 הכי משתלם בהשוואה · כולל מזוודה · נחיתה 18/11 11:45 · חזרה 23/11 13:50 · עצירות: בוקרשט + אמסטרדם. 📅 השוואת תאריכים (5 לילות): 15/11 ‎$2,139 · 16/11 ‎$2,060 · 17/11 ‎$1,339 · 18/11 ‎$1,067 · 19/11 ‎$1,067 · 20/11 ‎$1,450 · 21/11 ‎$1,794 – התאריך שלכם הכי זול. חלופה נוחה: British Airways ‎€1,065, עצירה אחת בכל כיוון (lastminute)', 'https://kiwi.com/u/k4vqdm'),
    B('flight', 'רחל: DFW ⇄ SFO', 'Frontier', '2026-11-18', '2026-11-23', 330, 'USD', 'planned', 'הלוך 07:00→11:17 דרך דנוור · חזור 11:27 · כולל מזוודה ~$100', 'https://kiwi.com/u/7k4vd5m'),
    B('hotel', 'Harbor View Inn · האף מון ביי', 'Booking.com', '2026-11-18', '2026-11-19', 175, 'USD', 'planned', '🏆 הכי משתלם · דירוג 8.0 · ליד נמל פילר פוינט · חניה חינם. הכי זול: Miramar Inn ‎$150 (7.1)', 'https://www.booking.com/hotel/us/harbor-view-inn.html?checkin=2026-11-18&checkout=2026-11-19&group_adults=2'),
    B('hotel', 'Briarwood Inn · קרמל – 4 לילות', 'Booking.com', '2026-11-19', '2026-11-23', 1019, 'USD', 'planned', '🏆 הכי משתלם · דירוג 8.4 (1,252 ביקורות) · מרכז העיירה · חניה חינם. הכי זול: Carmel Resort Inn ‎$916 (7.9)', 'https://www.booking.com/hotel/us/briarwood-inn.html?checkin=2026-11-19&checkout=2026-11-23&group_adults=2'),
    B('car', 'רכב שכור + ביטוח מלא + נהג נוסף', '', '2026-11-18', '2026-11-23', 650, 'USD'),
    B('activity', 'אקווריום מונטריי (2)', 'Monterey Bay Aquarium', '2026-11-21', '', 130, 'USD', 'planned', 'רק באונליין, מראש')
  ];
  const L = text => ({ id: uid(), text, done: false });
  t.lists.packing = PACK_TEMPLATE.map(L);
  const now = Date.now();
  t.watch = [
    { id: uid(), kind: 'flight', key: 'f:KLM|2026-11-18T01:00', label: 'KLM · TLV→SFO', query: { from: 'TLV', to: 'SFO', depart: '2026-11-18', ret: '2026-11-23', adults: 1, cabin: 'economy' }, base: 3308, last: 3308, history: [{ t: now, ils: 3308 }], checked: now },
    { id: uid(), kind: 'hotel', key: 'h:Briarwood Inn', label: 'Briarwood Inn · 4 לילות', query: { where: 'Carmel-by-the-Sea, CA', checkin: '2026-11-19', checkout: '2026-11-23', adults: 2, rooms: 1 }, base: 3159, last: 3159, history: [{ t: now, ils: 3159 }], checked: now }
  ];
  t.lists.tasks = ['צחי: ביטוח נסיעות מישראל', 'צחי: ESTA בתוקף', 'רחל: להזמין טיסה מדאלאס', 'לתאם מקום מפגש ב-SFO', 'להזמין אקווריום', 'לבדוק כביש 1 באתר Caltrans', 'להזמין מלון – שבוע לפני חג ההודיה'].map(L);
  return t;
}

// ---------- storage ----------
const LocalStore = {
  mode: 'local', user: null,
  async init(onChange) {
    this.onChange = onChange;
    let data = null; try { data = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { }
    if (!data || !Array.isArray(data.trips)) { data = { trips: [seedCarmel()] }; this._persist(data.trips); }
    this.trips = data.trips; onChange(this.trips);
  },
  _persist(trips) { try { localStorage.setItem(LS_KEY, JSON.stringify({ trips })); } catch (e) { toast('האחסון המקומי מלא – שקול להפעיל ענן'); } },
  async saveTrip(trip) { trip.updatedAt = Date.now(); const i = this.trips.findIndex(t => t.id === trip.id); if (i >= 0) this.trips[i] = trip; else this.trips.push(trip); this._persist(this.trips); this.onChange(this.trips); },
  async deleteTrip(id) { this.trips = this.trips.filter(t => t.id !== id); this._persist(this.trips); this.onChange(this.trips); },
  async uploadFile(tripId, file) {
    if (file.size > 400 * 1024) throw new Error('במצב מקומי אפשר לצרף קבצים עד 400KB. הפעל ענן לקבצים גדולים.');
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    return { name: file.name, url };
  }
};

const CloudStore = {
  mode: 'cloud', user: null, trips: [],
  async init(onChange, onAuth) {
    this.onChange = onChange;
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
    const [{ initializeApp }, A, F, S] = await Promise.all([
      import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`), import(`${base}/firebase-storage.js`)
    ]);
    this.A = A; this.F = F; this.S = S;
    const app = initializeApp(firebaseConfig);
    this.auth = A.getAuth(app); this.db = F.getFirestore(app);
    try { this.storage = S.getStorage(app); } catch (e) { this.storage = null; }
    A.onAuthStateChanged(this.auth, user => { this.user = user; this._unsub?.forEach(u => u()); this.trips = []; if (user) this._listen(user); onAuth(user); });
  },
  _listen(user) {
    const { collection, query, where, onSnapshot } = this.F; const col = collection(this.db, 'trips');
    const buckets = { own: [], inv: [] };
    const emit = () => { const m = new Map(); [...buckets.own, ...buckets.inv].forEach(t => m.set(t.id, t)); this.trips = [...m.values()]; this.onChange(this.trips); };
    const u1 = onSnapshot(query(col, where('members', 'array-contains', user.uid)), s => { buckets.own = s.docs.map(d => d.data()); emit(); }, e => toast('שגיאת סנכרון: ' + e.code));
    const u2 = user.email ? onSnapshot(query(col, where('inviteEmails', 'array-contains', user.email.toLowerCase())), s => {
      buckets.inv = s.docs.map(d => d.data());
      buckets.inv.filter(t => !t.members?.includes(user.uid)).forEach(t => { t.members = [...(t.members || []), user.uid]; this.saveTrip(t); });
      emit();
    }) : () => { };
    this._unsub = [u1, u2];
  },
  async saveTrip(trip) {
    trip.updatedAt = Date.now();
    if (!trip.ownerId) trip.ownerId = this.user.uid;
    if (!trip.members?.includes(this.user.uid)) trip.members = [...(trip.members || []), this.user.uid];
    const { doc, setDoc } = this.F; await setDoc(doc(this.db, 'trips', trip.id), clone(trip));
  },
  async deleteTrip(id) { const { doc, deleteDoc } = this.F; await deleteDoc(doc(this.db, 'trips', id)); },
  async uploadFile(tripId, file) {
    if (!this.storage) throw new Error('Firebase Storage לא מוגדר בפרויקט');
    const { ref, uploadBytes, getDownloadURL } = this.S;
    const r = ref(this.storage, `trips/${tripId}/${uid()}-${file.name}`);
    await uploadBytes(r, file); return { name: file.name, url: await getDownloadURL(r), path: r.fullPath };
  },
  signInGoogle() { return this.A.signInWithPopup(this.auth, new this.A.GoogleAuthProvider()); },
  signInEmail(e, p) { return this.A.signInWithEmailAndPassword(this.auth, e, p); },
  signUpEmail(e, p) { return this.A.createUserWithEmailAndPassword(this.auth, e, p); },
  resetPassword(e) { return this.A.sendPasswordResetEmail(this.auth, e); },
  signOut() { return this.A.signOut(this.auth); }
};

// ---------- state ----------
const state = { store: null, trips: [], tripId: null, tab: 'overview', ready: false, budgetView: 'cats' };
const curTrip = () => state.trips.find(t => t.id === state.tripId);
async function mutate(fn) {
  const t = curTrip(); if (!t) return; const copy = clone(t); fn(copy);
  try { await state.store.saveTrip(copy); } catch (e) { console.error(e); toast('השמירה נכשלה: ' + (e.code || e.message)); }
}

// ---------- toast ----------
let toastTimer;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }

// ---------- modal form builder ----------
// field: {key,label,type:text|number|date|time|select|textarea|file|checkbox,options:[[v,l]],half:true,placeholder}
function openForm({ title, fields, values = {}, onSave, onDelete, saveLabel = 'שמירה' }) {
  const dlg = $('#modal'), body = $('#modalBody');
  $('#modalTitle').textContent = title; $('#modalSave').textContent = saveLabel;
  let html = '', pending = null;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const pair = f.half && fields[i + 1]?.half ? [f, fields[++i]] : [f];
    const one = x => {
      const v = values[x.key] ?? x.default ?? ''; const id = 'f_' + x.key;
      let input;
      if (x.type === 'select') input = `<select id="${id}" name="${x.key}">${x.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
      else if (x.type === 'textarea') input = `<textarea id="${id}" name="${x.key}" rows="3" placeholder="${esc(x.placeholder || '')}">${esc(v)}</textarea>`;
      else if (x.type === 'file') input = `<input id="${id}" name="${x.key}" type="file" accept="image/*,application/pdf">${values.file?.name ? `<div class="small muted">מצורף: ${esc(values.file.name)}</div>` : ''}`;
      else input = `<input id="${id}" name="${x.key}" type="${x.type || 'text'}" value="${esc(v)}" ${x.type === 'number' ? 'step="any" inputmode="decimal"' : ''} placeholder="${esc(x.placeholder || '')}" ${x.required ? 'required' : ''}>`;
      return `<div class="field"><label for="${id}">${esc(x.label)}</label>${input}</div>`;
    };
    html += pair.length === 2 ? `<div class="field-row">${one(pair[0])}${one(pair[1])}</div>` : one(pair[0]);
  }
  body.innerHTML = html;
  const delBtn = $('#modalDelete'); delBtn.hidden = !onDelete;
  const close = () => dlg.close();
  delBtn.onclick = async () => { if (confirm('למחוק?')) { close(); await onDelete(); } };
  $('#modalCancel').onclick = close;
  $('#modalForm').onsubmit = async ev => {
    ev.preventDefault();
    const out = {};
    for (const f of fields) {
      const el = body.querySelector(`[name="${f.key}"]`); if (!el) continue;
      if (f.type === 'file') { if (el.files[0]) pending = el.files[0]; continue; }
      out[f.key] = f.type === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value.trim();
    }
    $('#modalSave').disabled = true;
    try {
      if (pending) { out.file = await state.store.uploadFile(state.tripId, pending); }
      await onSave(out); close();
    } catch (e) { toast(e.message || 'שגיאה'); }
    finally { $('#modalSave').disabled = false; }
  };
  dlg.showModal();
  setTimeout(() => body.querySelector('input,select,textarea')?.focus(), 50);
}

// ---------- routing ----------
function go(hash) { if (location.hash !== hash) location.hash = hash; else render(); }
function readRoute() {
  const m = location.hash.match(/^#\/trip\/([^/]+)(?:\/(\w+))?/);
  state.tripId = m ? m[1] : null; state.tab = m?.[2] || 'overview';
}
window.addEventListener('hashchange', () => { readRoute(); render(); window.scrollTo(0, 0); });

// ---------- render root ----------
function render() {
  const app = $('#app'), tabbar = $('#tabbar');
  const pill = $('#modePill');
  pill.textContent = state.store?.mode === 'cloud' ? '☁️ ענן' : '💾 מקומי';
  pill.classList.toggle('cloud', state.store?.mode === 'cloud');
  if (!state.ready || !curTrip()) { const f = $('#aiFab'); if (f) f.hidden = true; if (!curTrip()) $('#aiPanel')?.setAttribute('hidden', ''); }
  if (!state.ready) { app.innerHTML = `<div class="empty"><span class="big">🧭</span>טוען…</div>`; tabbar.hidden = true; return; }
  if (state.store.mode === 'cloud' && !state.store.user) { tabbar.hidden = true; app.innerHTML = renderAuth(); bindAuth(); return; }
  const trip = curTrip();
  if (!trip) { tabbar.hidden = true; app.innerHTML = renderTripList(); bindTripList(); return; }
  tabbar.hidden = false; $('#aiFab').hidden = false;
  $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  const views = { overview: renderOverview, itinerary: renderItinerary, guide: renderGuide, search: renderSearch, budget: renderBudget, bookings: renderBookings, checklist: renderChecklist };
  app.innerHTML = (views[state.tab] || renderOverview)(trip);
  bindTrip(trip);
  if (state.tab === 'guide') bindGuide(trip);
  if (state.tab === 'search') bindSearch(trip);
}

// ---------- auth ----------
function renderAuth() {
  return `<div class="auth">
    <img src="logo.png" alt="Tizon" style="width:180px">
    <h1>ברוכים הבאים ל-Tizon Tour</h1>
    <p class="muted">תכנון טיולים, תקציב, הזמנות ורשימות – במקום אחד, מסונכרן בכל המכשירים.</p>
    <div class="card">
      <button class="btn primary" style="width:100%" data-auth="google">כניסה עם Google</button>
      <p class="muted small" style="text-align:center;margin:12px 0">או עם אימייל</p>
      <div class="grid">
        <input id="authEmail" type="email" placeholder="אימייל" autocomplete="email">
        <input id="authPass" type="password" placeholder="סיסמה (6 תווים לפחות)" autocomplete="current-password">
      </div>
      <div class="row">
        <button class="btn green" data-auth="in">כניסה</button>
        <button class="btn" data-auth="up">הרשמה</button>
        <span class="spacer"></span>
        <button class="btn ghost sm" data-auth="reset">שכחתי סיסמה</button>
      </div>
    </div></div>`;
}
function bindAuth() {
  const S = state.store; const em = () => $('#authEmail').value.trim(), pw = () => $('#authPass').value;
  const run = p => p.catch(e => toast(authErr(e.code)));
  $$('[data-auth]').forEach(b => b.onclick = () => {
    const a = b.dataset.auth;
    if (a === 'google') run(S.signInGoogle());
    if (a === 'in') run(S.signInEmail(em(), pw()));
    if (a === 'up') run(S.signUpEmail(em(), pw()));
    if (a === 'reset') { if (!em()) return toast('הזן אימייל'); run(S.resetPassword(em()).then(() => toast('נשלח מייל לאיפוס'))); }
  });
}
const authErr = c => ({ 'auth/invalid-credential': 'אימייל או סיסמה שגויים', 'auth/email-already-in-use': 'האימייל כבר רשום', 'auth/weak-password': 'סיסמה חלשה מדי', 'auth/invalid-email': 'אימייל לא תקין', 'auth/popup-closed-by-user': 'החלון נסגר' }[c] || ('שגיאה: ' + c));

// ---------- trip list ----------
function tripStatus(t) {
  const today = isoDate(new Date());
  if (today < t.start) { const n = daysBetween(today, t.start); return { cls: 'gold', txt: n === 1 ? 'מחר!' : `בעוד ${n} ימים` }; }
  if (today <= t.end) return { cls: 'ok', txt: 'בטיול עכשיו' };
  return { cls: '', txt: 'הסתיים' };
}
function renderTripList() {
  const trips = [...state.trips].sort((a, b) => a.start.localeCompare(b.start));
  const today = isoDate(new Date());
  const up = trips.filter(t => t.end >= today), past = trips.filter(t => t.end < today).reverse();
  const card = t => {
    const st = tripStatus(t); const spent = totals(t).actual, plan = totals(t).planned;
    return `<button class="card trip-card" data-open="${t.id}">
      <div class="row"><span style="font-size:calc(30px * var(--fs))">${esc(t.emoji)}</span><div class="spacer">
        <div class="title">${esc(t.name)} <span class="mini rename" role="button" tabindex="0" data-rename="${t.id}" aria-label="שינוי שם">✏️</span></div>
        <div class="muted small">${esc(t.destination)} · ${fmtRange(t.start, t.end)} · ${t.travelers} נוסעים</div></div>
        <span class="chip ${st.cls}">${st.txt}</span></div>
      ${plan ? `<div class="bar gold" style="margin-top:12px"><i style="width:${Math.min(100, spent / plan * 100)}%"></i></div>
      <div class="small muted" style="margin-top:4px">${fmtMoney(spent)} מתוך ${fmtMoney(plan)}</div>` : ''}
    </button>`;
  };
  return `<div class="section-head"><h1>הטיולים שלי</h1><button class="btn primary" id="newTrip">+ טיול חדש</button></div>
    ${up.length ? up.map(card).join('') : `<div class="card empty"><span class="big">🧳</span>אין טיולים קרובים. זה הזמן לתכנן!</div>`}
    ${past.length ? `<div class="section"><h2 class="muted">טיולים קודמים</h2>${past.map(card).join('')}</div>` : ''}`;
}
function bindTripList() {
  $$('[data-open]').forEach(b => b.onclick = e => { if (e.target.closest('[data-rename]')) return; go(`#/trip/${b.dataset.open}/overview`); });
  $$('[data-rename]').forEach(b => { const fn = e => { e.stopPropagation(); e.preventDefault(); openRename(state.trips.find(x => x.id === b.dataset.rename)); }; b.onclick = fn; b.onkeydown = e => { if (e.key === 'Enter') fn(e); }; });
  $('#newTrip').onclick = () => openTripForm();
}
function tripFields() {
  return [
    { key: 'name', label: 'שם הטיול', required: true, placeholder: 'למשל: חופשה בקליפורניה' },
    { key: 'destination', label: 'יעד', placeholder: 'עיר / מדינה' },
    { key: 'city', label: 'עיר לחיפוש מלונות ומקומות', half: true, placeholder: 'Carmel-by-the-Sea, CA' }, { key: 'airport', label: 'שדה תעופה ביעד', half: true, placeholder: 'SFO' },
    { key: 'travelersTxt', label: 'נוסעים ומאיפה טסים', placeholder: 'צחי:TLV, רחל:DFW' },
    { key: 'start', label: 'תאריך יציאה', type: 'date', half: true }, { key: 'end', label: 'תאריך חזרה', type: 'date', half: true },
    { key: 'travelers', label: 'מספר נוסעים', type: 'number', half: true }, { key: 'emoji', label: 'אייקון', half: true, placeholder: '🌴' },
    { key: 'rateUSD', label: 'שער דולר (₪)', type: 'number', half: true }, { key: 'rateEUR', label: 'שער אירו (₪)', type: 'number', half: true }
  ];
}
function openRename(trip) {
  if (!trip) return;
  openForm({
    title: 'שינוי שם הטיול', saveLabel: 'שמירה',
    fields: [{ key: 'name', label: 'שם הטיול', required: true }, { key: 'emoji', label: 'אייקון', placeholder: '🌊' }],
    values: { name: trip.name, emoji: trip.emoji },
    onSave: async v => { if (!v.name) throw new Error('צריך שם'); const c = clone(trip); c.name = v.name; c.emoji = v.emoji || c.emoji; await state.store.saveTrip(c); toast('השם עודכן'); }
  });
  setTimeout(() => { const i = $('#f_name'); i?.select(); }, 60);
}
function openTripForm(trip) {
  const vals = trip ? { ...trip, rateUSD: trip.rates?.USD, rateEUR: trip.rates?.EUR, travelersTxt: (trip.travelersList || []).map(x => `${x.name}:${x.origin}`).join(', ') } : { travelers: 2, emoji: '🧭', rateUSD: 3.1, rateEUR: 3.4, start: isoDate(new Date(Date.now() + 30 * 864e5)), end: isoDate(new Date(Date.now() + 35 * 864e5)) };
  openForm({
    title: trip ? 'הגדרות טיול' : 'טיול חדש', fields: tripFields(), values: vals, saveLabel: trip ? 'שמירה' : 'יצירה',
    onSave: async v => {
      if (v.end < v.start) throw new Error('תאריך החזרה לפני היציאה');
      v.travelersList = (v.travelersTxt || '').split(',').map(x => x.split(':').map(y => y.trim())).filter(x => x[0]).map(([name, origin]) => ({ name, origin: (origin || 'TLV').toUpperCase() })); v.airport = (v.airport || '').toUpperCase();
      if (trip) { await mutate(t => { Object.assign(t, { travelersList: v.travelersList, airport: v.airport, city: v.city, name: v.name, destination: v.destination, start: v.start, end: v.end, travelers: v.travelers || 1, emoji: v.emoji || '🧭' }); t.rates = { USD: v.rateUSD || 1, EUR: v.rateEUR || 1 }; }); toast('נשמר'); }
      else { const t = blankTrip(v); await state.store.saveTrip(t); go(`#/trip/${t.id}/overview`); }
    },
    onDelete: trip ? async () => { await state.store.deleteTrip(trip.id); go('#/'); toast('הטיול נמחק'); } : null
  });
}

// ---------- totals ----------
function totals(t) {
  const planned = Object.values(t.budget || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const byCat = Object.fromEntries(CATS.map(c => [c.id, 0]));
  (t.expenses || []).forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + toILS(t, e.amount, e.currency); });
  (t.bookings || []).filter(b => b.status === 'paid').forEach(b => { const c = bookType(b.type).cat; byCat[c] += toILS(t, b.price, b.currency); });
  const actual = Object.values(byCat).reduce((a, b) => a + b, 0);
  const committed = (t.bookings || []).filter(b => b.status === 'booked').reduce((a, b) => a + toILS(t, b.price, b.currency), 0);
  return { planned, actual, byCat, committed };
}

// ---------- overview ----------
function renderOverview(t) {
  const st = tripStatus(t); const tot = totals(t); const days = tripDays(t);
  const today = isoDate(new Date());
  const pack = t.lists.packing, tasks = t.lists.tasks;
  const pDone = pack.filter(x => x.done).length, tDone = tasks.filter(x => x.done).length;
  const nextBookings = t.bookings.filter(b => (b.start || '') >= today).sort((a, b) => (a.start || '').localeCompare(b.start || '')).slice(0, 3);
  const todayKey = days.includes(today) ? today : days[0];
  const tday = t.days[todayKey];
  const openTasks = tasks.filter(x => !x.done).slice(0, 4);
  const countdown = today < t.start ? daysBetween(today, t.start) : null;
  return `
  <div class="card hero">
    <div class="row"><span style="font-size:calc(34px * var(--fs))">${esc(t.emoji)}</span><div class="spacer">
      <h1 style="margin:0" class="row" ><span>${esc(t.name)}</span><button class="mini rename" id="renameTrip" aria-label="שינוי שם">✏️</button></h1>
      <div class="dest">${esc(t.destination)}</div></div>
      <button class="btn sm" id="editTrip">⚙️ הגדרות</button></div>
    <div class="row" style="margin-top:14px;align-items:flex-end">
      ${countdown !== null ? `<div><div class="countdown">${countdown}</div><div class="muted small">ימים לטיול</div></div>` : `<span class="chip ${st.cls}">${st.txt}</span>`}
      <span class="spacer"></span>
      <div class="muted small" style="text-align:end">${fmtDate(t.start)} – ${fmtDate(t.end)}<br>${days.length} ימים · ${t.travelers} נוסעים</div>
    </div>
  </div>

  ${renderMorning(t)}
  <div class="grid grid-2 section">
    <div class="card stat"><div class="lbl">תקציב מתוכנן</div><div class="val">${fmtMoney(tot.planned)}</div><div class="small muted">${fmtMoney(tot.planned / (t.travelers || 1))} לנוסע</div></div>
    <div class="card stat"><div class="lbl">שולם עד כה</div><div class="val" style="color:${tot.actual > tot.planned && tot.planned ? 'var(--danger)' : 'var(--green)'}">${fmtMoney(tot.actual)}</div>
      <div class="bar ${tot.actual > tot.planned ? 'over' : ''}" style="margin-top:6px"><i style="width:${tot.planned ? Math.min(100, tot.actual / tot.planned * 100) : 0}%"></i></div></div>
    <div class="card stat"><div class="lbl">ציוד</div><div class="val">${pDone}/${pack.length}</div><div class="bar gold" style="margin-top:6px"><i style="width:${pack.length ? pDone / pack.length * 100 : 0}%"></i></div></div>
    <div class="card stat"><div class="lbl">משימות</div><div class="val">${tDone}/${tasks.length}</div><div class="bar" style="margin-top:6px"><i style="width:${tasks.length ? tDone / tasks.length * 100 : 0}%"></i></div></div>
  </div>

  ${tday ? `<div class="section"><div class="section-head"><h2>${todayKey === today ? 'היום' : 'היום הראשון'} · ${esc(tday.title || fmtDate(todayKey))}</h2><a href="#/trip/${t.id}/itinerary" class="small">כל המסלול ←</a></div>
    <div class="card"><ul class="list">${(tday.stops || []).map(s => `<li class="li"><b style="color:var(--gold);width:48px;direction:ltr;text-align:end">${esc(s.time)}</b><div class="main"><div class="t">${esc(s.title)}</div><div class="small muted">${esc(s.place)}</div></div>${s.place ? `<a class="mini" href="${mapsUrl(s.place)}" target="_blank" rel="noopener">📍</a>` : ''}</li>`).join('') || '<li class="muted">אין תחנות</li>'}</ul></div></div>` : ''}

  <div class="section"><div class="section-head"><h2>הזמנות קרובות</h2><a href="#/trip/${t.id}/bookings" class="small">הכל ←</a></div>
    <div class="card">${nextBookings.length ? `<ul class="list">${nextBookings.map(bookingRow).join('')}</ul>` : '<div class="muted">אין הזמנות קרובות</div>'}</div></div>

  ${renderFavorites(t)}
  ${openTasks.length ? `<div class="section"><div class="section-head"><h2>משימות פתוחות</h2><a href="#/trip/${t.id}/checklist" class="small">הכל ←</a></div>
    <div class="card">${openTasks.map(x => checkRow(x, 'tasks')).join('')}</div></div>` : ''}
  `;
}

// ---------- itinerary ----------
function renderItinerary(t) {
  const days = tripDays(t);
  if (!days.length) return `<div class="card empty"><span class="big">📅</span>הגדר תאריכי טיול כדי לבנות מסלול</div>`;
  const view = state.itinView || 'list';
  const head = `<div class="section-head"><h1>מסלול</h1><div class="row"><div class="seg"><button data-iv="list" class="${view === 'list' ? 'active' : ''}">📋 רשימה</button><button data-iv="map" class="${view === 'map' ? 'active' : ''}">🗺️ מפה</button></div><button class="btn sm" id="printBtn">🖨️</button></div></div>
    ${wxMode(t) === 'history' ? `<div class="small muted" style="margin-bottom:8px">🌤️ מזג האוויר לפי אותם תאריכים בשנה שעברה. תחזית אמיתית תופיע 16 יום לפני הטיול.</div>` : ''}`;
  if (view === 'map') return head + `<div class="row wrap" style="margin-bottom:8px"><button class="chipbtn ${!state.mapDay ? 'on' : ''}" data-mapday="">כל הימים</button>${days.map((d, i) => `<button class="chipbtn ${state.mapDay === d ? 'on' : ''}" data-mapday="${d}"><span class="dot" style="background:${DAY_COLORS[i % DAY_COLORS.length]}"></span> יום ${i + 1}</button>`).join('')}</div>
    <div id="tripMap" class="tripmap"><div class="empty">טוען מפה…</div></div>
    <div class="card section"><ul class="list">${days.map((d, i) => { const r = routeFor(t, d); return `<li class="li"><span class="dot big" style="background:${DAY_COLORS[i % DAY_COLORS.length]}"></span><div class="main"><div class="t">יום ${i + 1} · ${esc(t.days[d]?.title || fmtDate(d))}</div><div class="small muted">${(t.days[d]?.stops || []).length} תחנות${r ? ` · 🚗 ${fmtMin(r.min)} · ${r.km} ק״מ` : ''}</div></div>${wxChip(t, d)}</li>`; }).join('')}</ul></div>`;
  return head +
    days.map((d, i) => {
      const day = t.days[d] || { title: '', notes: '', stops: [] };
      const stops = [...(day.stops || [])];
      return `<div class="card day">
        <div class="day-head"><div class="day-num">${i + 1}</div>
          <div class="spacer"><div class="day-title">${esc(day.title || 'יום ' + (i + 1))}</div><div class="small muted">${fmtDate(d)}${routeFor(t, d) ? ` · 🚗 ${fmtMin(routeFor(t, d).min)} נהיגה` : ''}</div>${wxChip(t, d)}</div>
          <button class="mini" data-dayedit="${d}" title="עריכת יום">✏️</button>
          <button class="btn sm primary" data-addstop="${d}">+ תחנה</button></div>
        ${day.notes ? `<div class="day-notes" style="padding-top:10px">💡 ${esc(day.notes)}</div>` : ''}
        <ul class="stops">${stops.map((s, si) => `${si && routeFor(t, d)?.legs[si - 1] ? `<li class="drive">🚗 ${fmtMin(routeFor(t, d).legs[si - 1].min)} · ${routeFor(t, d).legs[si - 1].km} ק״מ</li>` : ''}<li class="stop">
            <div class="time">${esc(s.time || '')}</div>
            <div class="body"><div class="st">${esc(s.title)}</div>
              ${s.place ? `<a class="small" href="${mapsUrl(s.place)}" target="_blank" rel="noopener">📍 ${esc(s.place)}</a>` : ''}
              ${s.notes ? `<div class="small muted">${esc(s.notes)}</div>` : ''}
              ${coordsFor(s) ? `<div class="row wrap" style="margin-top:4px">${rideBtns(coordsFor(s).lat, coordsFor(s).lon, s.title, true)}</div>` : ''}</div>
            <div class="tools">
              ${si > 0 ? `<button class="mini" data-move="${d}|${s.id}|-1" title="למעלה">▲</button>` : ''}
              ${si < stops.length - 1 ? `<button class="mini" data-move="${d}|${s.id}|1" title="למטה">▼</button>` : ''}
              <button class="mini" data-editstop="${d}|${s.id}" title="עריכה">✏️</button></div>
          </li>`).join('') || `<li class="stop muted small">אין עדיין תחנות ליום הזה</li>`}</ul>
      </div>`;
    }).join('<div style="height:12px"></div>');
}
const stopFields = [
  { key: 'time', label: 'שעה', type: 'time', half: true }, { key: 'title', label: 'מה עושים', required: true, half: true },
  { key: 'place', label: 'מקום (לניווט)', placeholder: 'שם מקום או כתובת' },
  { key: 'notes', label: 'הערות', type: 'textarea' }
];
function sortStops(stops) { return stops.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')); }

// ---------- budget ----------
function renderBudget(t) {
  const tot = totals(t);
  const head = `<div class="section-head"><h1>תקציב</h1><button class="btn primary" id="addExpense">+ הוצאה</button></div>
    <div class="card"><div class="row wrap">
      <div class="stat"><div class="lbl">מתוכנן</div><div class="val">${fmtMoney(tot.planned)}</div></div><span class="spacer"></span>
      <div class="stat"><div class="lbl">שולם</div><div class="val" style="color:var(--green)">${fmtMoney(tot.actual)}</div></div><span class="spacer"></span>
      <div class="stat"><div class="lbl">נותר</div><div class="val" style="color:${tot.planned - tot.actual < 0 ? 'var(--danger)' : 'var(--cream)'}">${fmtMoney(tot.planned - tot.actual)}</div></div></div>
      ${tot.committed ? `<div class="small muted" style="margin-top:6px">⏳ הוזמן וטרם שולם: ${fmtMoney(tot.committed)}</div>` : ''}
      <div class="small muted" style="margin-top:6px">שער: $1 = ₪${t.rates?.USD} · הזמנות בסטטוס "שולם" נספרות אוטומטית</div></div>
    <div class="row section"><div class="seg"><button data-bv="cats" class="${state.budgetView === 'cats' ? 'active' : ''}">לפי קטגוריה</button><button data-bv="list" class="${state.budgetView === 'list' ? 'active' : ''}">כל ההוצאות</button><button data-bv="split" class="${state.budgetView === 'split' ? 'active' : ''}">⚖️ חלוקה</button></div></div>`;
  if (state.budgetView === 'split') return head + renderSplit(t);
  if (state.budgetView === 'cats') {
    return head + `<div class="card section"><ul class="list">${CATS.map(c => {
      const p = Number(t.budget[c.id]) || 0, a = tot.byCat[c.id] || 0; if (!p && !a) return `<li class="li clickable" data-cat="${c.id}"><div class="ico">${c.ico}</div><div class="main"><div class="t muted">${c.name}</div></div><span class="small muted">הגדר ←</span></li>`;
      const pct = p ? a / p * 100 : 100;
      return `<li class="li clickable" data-cat="${c.id}"><div class="ico">${c.ico}</div><div class="main"><div class="row"><div class="t">${c.name}</div><span class="spacer"></span><span class="amt small">${fmtMoney(a)} / ${fmtMoney(p)}</span></div>
        <div class="bar ${a > p ? 'over' : ''}" style="margin-top:6px"><i style="width:${Math.min(100, pct)}%"></i></div></div></li>`;
    }).join('')}</ul><div class="small muted" style="margin-top:8px">לחץ על קטגוריה כדי לעדכן את הסכום המתוכנן</div></div>`;
  }
  const exps = [...t.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const paidB = t.bookings.filter(b => b.status === 'paid');
  return head + `<div class="card section">${exps.length || paidB.length ? `<ul class="list">
    ${exps.map(e => { const c = catById(e.cat); return `<li class="li clickable" data-exp="${e.id}"><div class="ico">${c.ico}</div><div class="main"><div class="t">${esc(e.title || c.name)}</div><div class="small muted">${fmtDate(e.date, false)}${e.payer ? ' · ' + esc(e.payer) : ''}</div></div>
      <div style="text-align:end"><div class="amt">${fmtMoney(e.amount, e.currency)}</div>${e.currency !== 'ILS' ? `<div class="small muted amt">${fmtMoney(toILS(t, e.amount, e.currency))}</div>` : ''}</div></li>`; }).join('')}
    ${paidB.map(b => `<li class="li"><div class="ico">${bookType(b.type).ico}</div><div class="main"><div class="t">${esc(b.title)}</div><div class="small muted">מהזמנות · שולם</div></div><div class="amt">${fmtMoney(b.price, b.currency)}</div></li>`).join('')}
  </ul>` : `<div class="empty"><span class="big">🧾</span>עוד אין הוצאות. הוסף הוצאה או סמן הזמנה כ"שולם".</div>`}</div>`;
}
function payerFields() {
  const names = (curTrip()?.travelersList || []).map(x => x.name).filter(Boolean);
  if (names.length < 2) return [{ key: 'payer', label: 'מי שילם', placeholder: 'אופציונלי' }];
  return [{ key: 'payer', label: 'מי שילם', type: 'select', half: true, options: [['', '—'], ...names.map(n => [n, n])] }, { key: 'split', label: 'עבור', type: 'select', half: true, options: [['all', 'כולם (שווה)'], ...names.map(n => [n, 'רק ' + n])] }];
}
function expenseFields() {
  return [
    { key: 'title', label: 'תיאור', placeholder: 'למשל: ארוחת ערב' },
    { key: 'amount', label: 'סכום', type: 'number', half: true, required: true }, { key: 'currency', label: 'מטבע', type: 'select', half: true, options: [['USD', '$ דולר'], ['ILS', '₪ שקל'], ['EUR', '€ אירו']] },
    { key: 'cat', label: 'קטגוריה', type: 'select', half: true, options: CATS.map(c => [c.id, c.ico + ' ' + c.name]) }, { key: 'date', label: 'תאריך', type: 'date', half: true },
    ...payerFields()
  ];
}

// ---------- bookings ----------
function bookingRow(b) {
  const tp = bookType(b.type), st = STATUS[b.status] || STATUS.planned;
  return `<li class="li clickable" data-book="${b.id}"><div class="ico">${tp.ico}</div>
    <div class="main"><div class="t">${esc(b.title)}</div>
      <div class="small muted">${b.start ? fmtRange(b.start, b.end) : ''}${b.provider ? ' · ' + esc(b.provider) : ''}${b.conf ? ' · #' + esc(b.conf) : ''}</div></div>
    <div style="text-align:end"><div class="amt">${b.price ? fmtMoney(b.price, b.currency) : ''}</div><span class="chip ${st.cls}">${st.name}</span>${b.file ? ' 📎' : ''}</div></li>`;
}
function renderBookings(t) {
  const list = [...t.bookings].sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
  const groups = BOOK_TYPES.map(tp => ({ tp, items: list.filter(b => b.type === tp.id) })).filter(g => g.items.length);
  return `<div class="section-head"><h1>הזמנות ומסמכים</h1><div class="row"><button class="btn sm" id="emailImport">📧 מהמייל</button><button class="btn primary" id="addBooking">+ הזמנה</button></div></div>
    ${groups.length ? groups.map(g => `<div class="card"><h3>${g.tp.ico} ${g.tp.name}</h3><ul class="list">${g.items.map(bookingRow).join('')}</ul></div>`).join('') : `<div class="card empty"><span class="big">🎫</span>שמור כאן טיסות, מלונות, רכב וקודי אישור – הכל בהישג יד.</div>`}`;
}
function bookingFields() {
  return [
    { key: 'type', label: 'סוג', type: 'select', half: true, options: BOOK_TYPES.map(x => [x.id, x.ico + ' ' + x.name]) }, { key: 'status', label: 'סטטוס', type: 'select', half: true, options: Object.entries(STATUS).map(([k, v]) => [k, v.name]) },
    { key: 'title', label: 'כותרת', required: true },
    { key: 'provider', label: 'ספק', half: true, placeholder: 'חברה / אתר' }, { key: 'conf', label: 'קוד אישור', half: true },
    { key: 'start', label: 'מתאריך', type: 'date', half: true }, { key: 'end', label: 'עד תאריך', type: 'date', half: true },
    { key: 'price', label: 'מחיר', type: 'number', half: true }, { key: 'currency', label: 'מטבע', type: 'select', half: true, options: [['USD', '$ דולר'], ['ILS', '₪ שקל'], ['EUR', '€ אירו']] },
    { key: 'link', label: 'קישור', type: 'url', placeholder: 'https://' },
    ...payerFields(),
    { key: 'file', label: 'קובץ מצורף (כרטיס, אישור)', type: 'file' },
    { key: 'notes', label: 'הערות', type: 'textarea' }
  ];
}
function openBookingView(t, b) {
  // read view with quick actions, then edit
  const tp = bookType(b.type), st = STATUS[b.status] || STATUS.planned;
  const dlg = $('#modal');
  $('#modalTitle').textContent = `${tp.ico} ${b.title}`;
  $('#modalBody').innerHTML = `
    <div class="row wrap"><span class="chip ${st.cls}">${st.name}</span>${b.provider ? `<span class="chip">${esc(b.provider)}</span>` : ''}</div>
    ${b.conf ? `<div class="card"><div class="small muted">קוד אישור</div><div class="row"><b style="font-size:calc(22px * var(--fs));letter-spacing:1px;direction:ltr">${esc(b.conf)}</b><span class="spacer"></span><button type="button" class="btn sm" id="copyConf">העתק</button></div></div>` : ''}
    <div class="grid grid-2">
      ${b.start ? `<div><div class="small muted">מתאריך</div>${fmtDate(b.start)}</div>` : ''}
      ${b.end ? `<div><div class="small muted">עד</div>${fmtDate(b.end)}</div>` : ''}
      ${b.price ? `<div><div class="small muted">מחיר</div><b>${fmtMoney(b.price, b.currency)}</b>${b.currency !== 'ILS' ? ` <span class="muted small">(${fmtMoney(toILS(t, b.price, b.currency))})</span>` : ''}</div>` : ''}
    </div>
    ${b.notes ? `<div class="muted">${esc(b.notes)}</div>` : ''}
    <div class="row wrap">
      ${b.link ? `<a class="btn sm" href="${esc(heLink(b.link).url)}" target="_blank" rel="noopener">🔗 פתח קישור</a>` : ''}
      ${b.file ? `<a class="btn sm" href="${esc(b.file.url)}" target="_blank" rel="noopener" download="${esc(b.file.name)}">📎 ${esc(b.file.name)}</a>` : ''}
      ${b.status !== 'paid' ? `<button type="button" class="btn sm green" id="markPaid">✓ סמן כשולם</button>` : ''}
      ${['hotel', 'restaurant', 'activity'].includes(b.type) ? `<button type="button" class="btn sm" id="bookRev">⭐ חוות דעת</button>` : ''}
    </div>`;
  $('#modalDelete').hidden = true; $('#modalSave').textContent = 'עריכה';
  $('#modalCancel').onclick = () => dlg.close();
  $('#modalForm').onsubmit = e => { e.preventDefault(); dlg.close(); editBooking(t, b); };
  dlg.showModal();
  $('#copyConf')?.addEventListener('click', () => navigator.clipboard?.writeText(b.conf).then(() => toast('הועתק')));
  $('#bookRev')?.addEventListener('click', () => openReviews(b.title.split(' · ')[0], t.city || t.destination || ''));
  $('#markPaid')?.addEventListener('click', async () => { dlg.close(); await mutate(x => { x.bookings.find(y => y.id === b.id).status = 'paid'; }); toast('סומן כשולם ונוסף לתקציב'); });
}
function editBooking(t, b) {
  openForm({
    title: b ? 'עריכת הזמנה' : 'הזמנה חדשה', fields: bookingFields(), values: b || { type: 'hotel', status: 'planned', currency: 'USD', start: t.start },
    onSave: async v => mutate(x => { if (b) { const it = x.bookings.find(y => y.id === b.id); Object.assign(it, v, { file: v.file || it.file }); } else x.bookings.push({ id: uid(), file: null, ...v }); }),
    onDelete: b ? async () => mutate(x => { x.bookings = x.bookings.filter(y => y.id !== b.id); }) : null
  });
}

// ---------- checklist ----------
function checkRow(x, list) {
  return `<label class="check ${x.done ? 'done' : ''}"><input type="checkbox" data-check="${list}|${x.id}" ${x.done ? 'checked' : ''}><span class="t">${esc(x.text)}</span><button type="button" class="mini" data-delitem="${list}|${x.id}" aria-label="מחיקה">✕</button></label>`;
}
function renderChecklist(t) {
  const block = (key, title, tpl) => {
    const items = t.lists[key] || []; const done = items.filter(i => i.done).length;
    return `<div class="card"><div class="section-head"><h2>${title}</h2><span class="chip ${done === items.length && items.length ? 'ok' : ''}">${done}/${items.length}</span></div>
      ${items.length ? `<div class="bar gold" style="margin-bottom:8px"><i style="width:${done / items.length * 100}%"></i></div>` : ''}
      ${[...items.filter(i => !i.done), ...items.filter(i => i.done)].map(i => checkRow(i, key)).join('') || `<div class="muted small">הרשימה ריקה</div>`}
      <form class="add-inline" data-add="${key}"><input placeholder="הוסף פריט…" aria-label="פריט חדש"><button class="btn sm primary">הוסף</button></form>
      <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-tpl="${key}">✨ ${tpl}</button>${done ? `<button class="btn sm ghost" data-cleardone="${key}">נקה מסומנים</button>` : ''}</div>
    </div>`;
  };
  return `<h1>רשימות</h1>${block('tasks', '📋 משימות לפני הטיול', 'הוסף משימות נפוצות')}${block('packing', '🎒 ציוד', 'הוסף רשימת ציוד בסיסית')}`;
}

// =====================================================================
//  טיסות – חיפוש אחד בכל מנועי ההשוואה + מחירים חיים (Duffel דרך Netlify)
// =====================================================================
const CABINS = [['economy', 'תיירים'], ['premium_economy', 'פרימיום'], ['business', 'עסקים'], ['first', 'ראשונה']];
const flightState = { form: null, offers: null, loading: false, error: '' };

function defaultFlightForm(t) {
  const tr = (t.travelersList || [])[0] || { origin: 'TLV' };
  return { from: tr.origin || 'TLV', to: t.airport || '', depart: t.start, ret: t.end, adults: 1, cabin: 'economy' };
}
const ymd2 = d => d ? d.slice(2).replace(/-/g, '') : '';
const mdy = d => { const [y, m, dd] = d.split('-'); return `${m}/${dd}/${y}`; };
function flightLinks(f) {
  const F = f.from.toUpperCase(), T = f.to.toUpperCase(), d = f.depart, r = f.ret, n = f.adults || 1;
  const cabinSky = { economy: 'economy', premium_economy: 'premiumeconomy', business: 'business', first: 'first' }[f.cabin];
  const cabinKayak = { economy: '', premium_economy: '/premium', business: '/business', first: '/first' }[f.cabin];
  return [
    { name: 'Skyscanner', ico: '🔷', note: 'משווה מאות סוכנויות וחברות', url: `https://www.skyscanner.co.il/transport/flights/${F.toLowerCase()}/${T.toLowerCase()}/${ymd2(d)}/${r ? ymd2(r) + '/' : ''}?adultsv2=${n}&cabinclass=${cabinSky}` },
    { name: 'Google Flights', ico: '🟢', note: 'מחירים ישירות מהחברות + גרף מחירים', url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${F} to ${T} on ${d}${r ? ` through ${r}` : ''} ${n} adults ${f.cabin.replace('_', ' ')}`)}` },
    { name: 'Kayak', ico: '🟠', note: 'כולל חברות לואו-קוסט', url: `https://www.kayak.com/flights/${F}-${T}/${d}${r ? '/' + r : ''}${cabinKayak}/${n}adults?sort=price_a` },
    { name: 'Momondo', ico: '🟣', note: 'לעיתים קרובות הזול ביותר', url: `https://www.momondo.com/flight-search/${F}-${T}/${d}${r ? '/' + r : ''}${cabinKayak}/${n}adults?sort=price_a` },
    { name: 'Kiwi.com', ico: '🥝', note: 'משלב חברות שונות – חיבורים יצירתיים', url: `https://www.kiwi.com/deep?from=${F}&to=${T}&departure=${d}${r ? '&return=' + r : ''}&adults=${n}` },
    { name: 'Expedia', ico: '🟡', note: 'טיסה + מלון בחבילה', url: `https://www.expedia.com/Flights-Search?trip=${r ? 'roundtrip' : 'oneway'}&leg1=from:${F},to:${T},departure:${mdy(d)}TANYT${r ? `&leg2=from:${T},to:${F},departure:${mdy(r)}TANYT` : ''}&passengers=adults:${n}&options=cabinclass:${f.cabin === 'premium_economy' ? 'premium' : f.cabin}&mode=search` }
  ];
}
const isoDur = s => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(s || ''); if (!m) return ''; const h = (+m[1] || 0) * 24 + (+m[2] || 0); return `${h}ש׳ ${+m[3] || 0}ד׳`; };
const hhmm = s => s ? s.slice(11, 16) : '';
function offerSliceHtml(sl) {
  const segs = sl.segments || []; const route = [segs[0]?.origin, ...segs.map(s => s.destination)].join(' → ');
  return `<div class="small"><b dir="ltr">${esc(route)}</b> · <span dir="ltr">${fmtDate(sl.departing_at?.slice(0, 10), false)} ${hhmm(sl.departing_at)} → ${hhmm(sl.arriving_at)}</span> · ${isoDur(sl.duration)} · ${segs.length - 1 ? (segs.length - 1) + ' עצירות' : 'ישירה'}<div class="muted">${esc([...new Set(segs.map(s => s.carrier))].join(', '))}</div></div>`;
}
// ---------- השוואה: איחוד כפולים, הכי זול / הכי משתלם / הכי מהיר ----------
const durMin = s => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(s || ''); return m ? (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const VALUE_HOUR = 60, VALUE_STOP = 150, BAG_FEE = 130; // ₪ – שעה, עצירה, מזוודה לכיוון לנוסע (הערכה)
function compareFlights(t, raw) {
  const adults = flightState.form?.adults || 1;
  const key = o => { const s = o.slices[0] || {}; return [(s.segments || []).map(g => g.origin).join('-') + '-' + (s.segments || []).at(-1)?.destination, (s.departing_at || '').slice(0, 16)].join('|'); };
  const groups = new Map();
  raw.forEach(o => { o.ils = toILS(t, o.total, o.currency); const k = key(o); (groups.get(k) || groups.set(k, []).get(k)).push(o); });
  const list = [...groups.values()].map(g => {
    g.sort((a, b) => a.ils - b.ils); const best = { ...g[0] };
    const inf = { ...(best.info || {}) }; g.slice(1).forEach(x => Object.entries(x.info || {}).forEach(([k, v]) => { if (inf[k] == null && v != null) inf[k] = v; }));
    best.info = inf; best.also = g.slice(1).map(x => ({ source: x.source, total: x.total, currency: x.currency })); return best;
  });
  list.forEach(o => {
    const inf = o.info ||= {};
    o.mins = o.slices.reduce((a, s) => a + durMin(s.duration), 0);
    o.stops = o.slices.reduce((a, s) => a + (s.stops ?? Math.max(0, (s.segments || []).length - 1)), 0);
    o.hasBag = inf.checked > 0 || /מזוודה/.test(o.bags || '');
    o.bagUnknown = !o.hasBag && inf.checked == null;
    const legsCount = flightState.form?.ret ? 2 : 1;
    o.bagAdd = o.hasBag ? 0 : BAG_FEE * legsCount * adults;
    o.ilsBag = o.ils + o.bagAdd;
    o.warn = o.slices.flatMap(s => s.layovers || []).flatMap(l => [l.overnight && `לילה בעצירה ב-${l.at}`, l.airportChange && `החלפת שדה ב-${l.at}`, l.minutes && l.minutes < 60 && `חיבור קצר (${l.minutes} ד׳) ב-${l.at}`, l.minutes > 420 && `המתנה ארוכה (${Math.round(l.minutes / 60)} ש׳) ב-${l.at}`].filter(Boolean));
    o.value = o.ilsBag + (o.mins / 60) * VALUE_HOUR + o.stops * VALUE_STOP + o.warn.length * 120 + (o.cached ? 100 : 0);
    o.badges = [];
  });
  const pick = (f, label) => { const w = [...list].filter(x => f !== 'mins' || x.mins).sort((a, b) => a[f] - b[f])[0]; if (w) w.badges.push(label); return w; };
  const c = pick('ils', '💰 הכי זול'); const cb = [...list].sort((a, b) => a.ilsBag - b.ilsBag)[0];
  if (cb && cb !== c) cb.badges.push('🧳 הכי זול עם מזוודה');
  pick('value', '🏆 הכי משתלם'); pick('mins', '⚡ הכי מהיר');
  return list.sort((a, b) => a.value - b.value).slice(0, 60);
}
function filteredOffers(o) {
  const F = flightState.filters || {};
  return o.filter(x => (!F.bag || x.hasBag) && (F.stops == null || x.stops <= F.stops * (flightState.form?.ret ? 2 : 1)) && (!F.change || x.info?.changeable) && (!F.noWarn || !x.warn.length));
}
function sortedOffers(o) { const f = { value: 'value', price: 'ils', bag: 'ilsBag', time: 'mins' }[flightState.sort || 'value']; return filteredOffers([...o]).sort((a, b) => (a[f] || 1e9) - (b[f] || 1e9)); }
const sortBar = () => {
  const F = flightState.filters || {}; const chip = (k, v, l) => `<button class="chipbtn ${F[k] === v ? 'on' : ''}" data-ffilter="${k}" data-fval="${v}">${l}</button>`;
  return `<div class="seg wide" style="margin:4px 0 8px">${[['value', '🏆 משתלם'], ['price', '💰 זול'], ['bag', '🧳 זול+מזוודה'], ['time', '⚡ מהיר']].map(([v, l]) => `<button data-fsort="${v}" class="${(flightState.sort || 'value') === v ? 'active' : ''}">${l}</button>`).join('')}</div>
  <div class="row wrap" style="margin-bottom:10px">${chip('bag', true, '🧳 רק עם מזוודה')}${chip('stops', 0, '✈️ ישירות')}${chip('stops', 1, '1️⃣ עד עצירה אחת')}${chip('noWarn', true, '😌 בלי חיבורים בעייתיים')}${chip('change', true, '🔄 ניתן לשינוי')}</div>`;
};
const yn = v => v === true ? '<b class="yes">✓</b>' : v === false ? '<b class="no">✗</b>' : '<b class="unk">?</b>';
function includesRow(o) {
  const i = o.info || {};
  const chk = i.checked > 0 ? `<b class="yes">✓${i.checked > 1 ? ' ×' + i.checked : ''}</b>` : yn(i.checked === 0 ? false : null);
  return `<div class="incl"><span>🎒 תיק אישי ${yn(i.personal ?? true)}</span><span>🧳 טרולי ${yn(i.carryOn)}</span><span>💼 מזוודה ${chk}</span><span>🔄 שינוי ${yn(i.changeable)}</span><span>💸 החזר ${yn(i.refundable)}</span>${i.fareBrand ? `<span class="chip">${esc(i.fareBrand)}</span>` : ''}</div>`;
}
function layoversHtml(o) {
  const ls = o.slices.flatMap((s, si) => (s.layovers || []).map(l => ({ ...l, dir: o.slices.length > 1 ? (si ? 'חזור' : 'הלוך') : '' })));
  if (!ls.length) return '';
  return `<div class="small lay">${ls.map(l => `<span>⏱ ${l.dir ? l.dir + ': ' : ''}עצירה ב-<b dir="ltr">${esc(l.at)}</b>${l.city ? ' (' + esc(l.city) + ')' : ''} · ${Math.floor(l.minutes / 60)}ש׳ ${l.minutes % 60}ד׳${l.overnight ? ' 🌙' : ''}${l.airportChange ? ' 🔀' : ''}</span>`).join('')}</div>`;
}
function winnersBox(t, offers) {
  const W = l => offers.find(o => o.badges.includes(l));
  const row = (l, o) => o ? `<div class="wrow"><span class="wl">${l}</span><span class="spacer"><b>${esc(o.owner)}</b> <span class="small muted">· ${Math.floor(o.mins / 60)}ש׳ · ${o.stops ? o.stops + ' עצירות' : 'ישירה'} · ${o.hasBag ? '🧳 כולל מזוודה' : o.bagUnknown ? 'מזוודה: לא ידוע' : 'בלי מזוודה'}</span></span><b dir="ltr">${fmtMoney(o.ils)}</b></div>` : '';
  const c = W('💰 הכי זול'), v = W('🏆 הכי משתלם');
  const diff = c && v && c !== v ? `<div class="small muted" style="margin-top:6px">המשתלם יקר ב-${fmtMoney(v.ils - c.ils)}${c.bagAdd && !v.bagAdd ? ` – אבל כשמוסיפים מזוודה לזול, ההפרש רק ${fmtMoney(v.ilsBag - c.ilsBag)}` : ''}${c.mins > v.mins ? `, וחוסך ${Math.round((c.mins - v.mins) / 60)} שעות` : ''}${c.stops > v.stops ? ` ו-${c.stops - v.stops} עצירות` : ''}.</div>` : '';
  return `<div class="card winners">${row('💰 הכי זול', c)}${row('🧳 זול עם מזוודה', W('🧳 הכי זול עם מזוודה'))}${row('🏆 הכי משתלם', v)}${row('⚡ הכי מהיר', W('⚡ הכי מהיר'))}${diff}
    <details class="small muted" style="margin-top:6px"><summary>איך מחושב ״הכי משתלם״? מקרא</summary>
    מחיר + מזוודה אם לא כלולה (~₪${BAG_FEE} לכיוון לנוסע) + ₪${VALUE_HOUR} לכל שעת טיסה + ₪${VALUE_STOP} לכל עצירה + תוספת על חיבור קצר, לילה בעצירה או החלפת שדה.<br>
    ✓ כלול · ✗ לא כלול (בתשלום) · ? לא ידוע – לבדוק לפני הזמנה · 🌙 לילה בעצירה · 🔀 החלפת שדה</details></div>`;
}
async function searchAll(body) {
  let r;
  try { r = await fetch('/.netlify/functions/search-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (e) { throw new Error('אין חיבור לשרת החיפוש'); }
  if (r.status === 404) throw new Error('החיפוש החי יעבוד אחרי פריסה ל-Netlify עם הפונקציה search-all ומפתחות הספקים (הסבר ב-README). בינתיים – כפתור ההשוואה פותח את כל האתרים.');
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ('שגיאה ' + r.status));
  return j;
}
const providerBar = list => list?.length ? `<div class="row wrap" style="margin-bottom:10px">${list.map(p => `<span class="chip ${p.status === 'ok' ? 'ok' : p.status === 'error' ? 'warn' : ''}" title="${esc(p.note || '')}">${p.status === 'ok' ? '✓' : p.status === 'error' ? '⚠' : '○'} ${esc(p.name)}${p.status === 'ok' ? ' · ' + p.count : p.status === 'off' ? ' · לא מחובר' : ' · שגיאה'}</span>`).join('')}</div>` : '';
function renderFlights(t) {
  const f = flightState.form ||= defaultFlightForm(t);
  const tl = t.travelersList || [];
  const links = f.from && f.to && f.depart ? flightLinks(f) : [];
  const offers = flightState.offers;
  return `<div class="section-head"><h1>חיפוש טיסות</h1></div>
  ${tl.length ? `<div class="row wrap" style="margin-bottom:10px">${tl.map((x, i) => `<button class="chipbtn ${f.from === x.origin ? 'on' : ''}" data-ftrav="${i}">✈️ ${esc(x.name)} · ${esc(x.origin)}→${esc(t.airport || '')}</button>`).join('')}</div>` : ''}
  ${flightState.collapsed ? `<div class="card qbar"><div class="spacer"><b dir="ltr">${esc(f.from)} → ${esc(f.to)}</b><div class="small muted">${fmtRange(f.depart, f.ret)} · ${f.adults} נוסעים · ${CABINS.find(c => c[0] === f.cabin)?.[1] || ''}</div></div><button class="btn sm" id="editQ">✏️ שינוי</button></div>` : ''}
  <form class="card grid" id="flightForm" ${flightState.collapsed ? 'hidden' : ''}>
    <div class="ftrow"><div class="field"><label>מאיפה</label><input name="from" value="${esc(f.from)}" maxlength="3" dir="ltr" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase" required></div>
      <button type="button" class="swap" id="swapFT" aria-label="החלף כיוון">⇄</button>
      <div class="field"><label>לאן</label><input name="to" value="${esc(f.to)}" maxlength="3" dir="ltr" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase" required></div></div>
    <div class="field-row"><div class="field"><label>יציאה</label><input type="date" name="depart" value="${esc(f.depart)}" required></div>
      <div class="field"><label>חזרה (ריק = כיוון אחד)</label><input type="date" name="ret" value="${esc(f.ret || '')}"></div></div>
    <div class="field-row"><div class="field"><label>מבוגרים</label><input type="number" name="adults" min="1" max="9" inputmode="numeric" value="${f.adults}"></div>
      <div class="field"><label>מחלקה</label><select name="cabin">${CABINS.map(([v, l]) => `<option value="${v}" ${v === f.cabin ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="row btnstack"><button class="btn primary big" style="flex:1">🔎 השווה בכל המנועים</button><button type="button" class="btn green big" id="liveSearch" style="flex:1">⚡ חיפוש חי בכל הספקים</button></div>
    <button type="button" class="btn big" id="flexFlights">📅 השווה תאריכים (±3 ימים)</button>
  </form>

  ${links.length ? `<div class="section" id="results"><h2>השוואה – <span dir="ltr">${esc(f.from.toUpperCase())} → ${esc(f.to.toUpperCase())}</span></h2>
    <div class="small muted" style="margin-bottom:8px">כל מנוע נפתח עם הפרטים כבר ממולאים. בין כולם הם מכסים כמעט את כל החברות והסוכנויות.</div>
    ${linkGrid(links)}</div>` : ''}

  ${renderFlex('flights')}
  <div class="section" id="liveBox">
    ${flightState.loading ? `<div class="card empty"><span class="big">⏳</span>פונה לכל הספקים במקביל…</div>` : ''}
    ${flightState.error ? `<div class="card"><b>מחירים חיים לא זמינים</b><div class="small muted">${esc(flightState.error)}</div></div>` : ''}
    ${offers ? `<h2>השוואה בין כל הספקים · ${offers.length} הצעות</h2>${providerBar(flightState.providers)}${offers.length ? winnersBox(t, offers) + sortBar() + (sortedOffers(offers).length ? '' : '<div class="card muted">אין הצעות שמתאימות לסינון – נסו להסיר מסנן.</div>') + sortedOffers(offers).map(o => { const i = offers.indexOf(o); return `<div class="card offer ${o.badges.length ? 'win' : ''}">
        <div class="row"><div class="spacer"><b>${esc(o.owner)}</b> ${o.badges.map(b => `<span class="chip ok">${b}</span>`).join(' ')}</div><div class="price" dir="ltr">${esc(o.currency)} ${Math.round(o.total).toLocaleString('en-US')}</div></div>
        <div class="row wrap" style="margin:4px 0 6px"><span class="chip src">${esc(o.source)}</span>${o.bookable ? '<span class="chip ok">מחיר חי</span>' : ''}${o.cached ? '<span class="chip warn">מטמון</span>' : ''}${o.currency !== 'ILS' ? `<span class="small muted">≈ ${fmtMoney(toILS(t, o.total, o.currency))}</span>` : ''}</div>
        ${o.slices.map(offerSliceHtml).join('<div style="height:6px"></div>')}
        ${layoversHtml(o)}
        ${includesRow(o)}
        ${o.bagAdd ? `<div class="small" style="margin-top:4px">🧳 ${o.bagUnknown ? 'אם מזוודה לא כלולה' : 'מזוודה בתשלום'} – מחיר משוער עם מזוודה: <b>${fmtMoney(o.ilsBag)}</b></div>` : ''}
        ${o.warn.length ? `<div class="small warnline">⚠️ ${o.warn.map(esc).join(' · ')}</div>` : ''}
        ${o.note ? `<div class="small muted" style="margin-top:4px">${esc(o.note)}</div>` : ''}
        ${o.also.length ? `<div class="small" style="margin-top:4px">💱 אותה טיסה גם ב: ${o.also.map(a => `${esc(a.source)} <b dir="ltr">${esc(a.currency)} ${Math.round(a.total)}</b>`).join(' · ')}</div>` : ''}
        <div class="row" style="margin-top:8px"><span class="small muted">${o.bags ? '🧳 ' + esc(o.bags) : ''}</span><span class="spacer"></span>${o.link ? `<a class="btn sm" href="${esc(heLink(o.link).url)}" target="_blank" rel="noopener">פתח ↗</a>` : ''}${favBtn({ id: 'f:' + o.owner + (o.slices[0]?.departing_at || ''), type: 'flight', name: o.owner + ' · ' + (o.currency + ' ' + Math.round(o.total)), link: o.link || '', note: o.slices.map(x => (x.segments || []).map(g => g.origin).join('→') + '→' + (x.segments || []).at(-1)?.destination).join(' | ') })}${watchBtn('flight', o, flightState.form)}<button class="btn sm" data-saveoffer="${i}">💾 שמור</button></div>
      </div>`; }).join('') : '<div class="card muted">לא נמצאו הצעות. נסה תאריכים אחרים.</div>'}` : ''}
  </div>`;
}
async function liveFlightSearch() {
  const f = flightState.form; flightState.loading = true; flightState.error = ''; flightState.offers = null; render();
  try {
    const j = await searchAll({ kind: 'flights', ...f });
    const t = curTrip(); flightState.providers = j.providers;
    flightState.offers = compareFlights(t, j.results || []);
  } catch (e) { flightState.error = e.message; }
  flightState.loading = false; render();
}
function bindFlights(t) {
  const form = $('#flightForm'); if (!form) return;
  const read = () => { const d = Object.fromEntries(new FormData(form)); flightState.form = { ...d, from: d.from.trim().toUpperCase(), to: d.to.trim().toUpperCase(), adults: Number(d.adults) || 1 }; };
  form.onsubmit = e => { e.preventDefault(); read(); flightState.offers = null; flightState.error = ''; flightState.collapsed = true; render(); scrollToResults(); };
  $('#liveSearch').onclick = () => { if (!form.reportValidity()) return; read(); flightState.collapsed = true; liveFlightSearch().then(() => $('#liveBox')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  $('#editQ')?.addEventListener('click', () => { flightState.collapsed = false; render(); $('#flightForm [name=from]')?.focus(); });
  $('#flexFlights').onclick = () => { if (!form.reportValidity()) return; read(); flightState.collapsed = true; runFlex('flights'); };
  $$('[data-flexpick]').forEach(b => b.onclick = () => { const c = flightState.flex.cells.find(x => x.n === +b.dataset.flexpick); if (!c) return; flightState.form = { ...flightState.form, depart: c.q.depart, ret: c.q.ret }; liveFlightSearch().then(() => $('#liveBox')?.scrollIntoView({ behavior: 'smooth' })); });
  $('#swapFT').onclick = () => { const a = form.from.value; form.from.value = form.to.value; form.to.value = a; };
  $$('[data-ftrav]').forEach(b => b.onclick = () => { const x = t.travelersList[b.dataset.ftrav]; flightState.form = { ...flightState.form, from: x.origin, to: t.airport || flightState.form.to }; flightState.offers = null; render(); });
  $$('[data-fsort]').forEach(b => b.onclick = () => { flightState.sort = b.dataset.fsort; render(); });
  $$('[data-ffilter]').forEach(b => b.onclick = () => { const F = flightState.filters ||= {}; const k = b.dataset.ffilter; const v = b.dataset.fval === 'true' ? true : Number(b.dataset.fval); F[k] = F[k] === v ? (k === 'stops' ? null : false) : v; render(); });
  $$('[data-saveoffer]').forEach(b => b.onclick = async () => {
    const o = flightState.offers[b.dataset.saveoffer], f = flightState.form;
    await mutate(x => x.bookings.push({ id: uid(), type: 'flight', title: `${f.from} ⇄ ${f.to} · ${o.owner}`, provider: `${o.owner} (${o.source})`, conf: '', start: f.depart, end: f.ret || '', price: Math.round(o.total), currency: o.currency, status: 'planned', link: o.link || '', notes: o.slices.map(s => `${hhmm(s.departing_at)}→${hhmm(s.arriving_at)}`).join(' | '), file: null }));
    toast('נשמר בהזמנות');
  });
}

// =====================================================================
//  מדריך קולי – קריין בעברית, מקומות קרובים, שירותים לפי תחומי עניין
// =====================================================================
const INTERESTS = [
  { id: 'nature', name: 'טבע ונוף', ico: '🏞️', osm: ['tourism=viewpoint', 'natural=beach', 'leisure=nature_reserve', 'leisure=park'] },
  { id: 'history', name: 'היסטוריה ותרבות', ico: '🏛️', osm: ['tourism=museum', 'historic', 'tourism=gallery', 'tourism=attraction'] },
  { id: 'food', name: 'מסעדות', ico: '🍽️', osm: ['amenity=restaurant'] },
  { id: 'cafe', name: 'בתי קפה', ico: '☕', osm: ['amenity=cafe', 'shop=bakery'] },
  { id: 'market', name: 'שווקים וסופר', ico: '🧺', osm: ['amenity=marketplace', 'shop=supermarket', 'shop=greengrocer', 'shop=farm'] },
  { id: 'shopping', name: 'קניות', ico: '🛍️', osm: ['shop=mall', 'shop=gift', 'shop=clothes', 'shop=outdoor'] },
  { id: 'wine', name: 'יין', ico: '🍷', osm: ['craft=winery', 'shop=wine'] },
  { id: 'family', name: 'משפחה', ico: '👨‍👩‍👧', osm: ['tourism=zoo', 'tourism=aquarium', 'tourism=theme_park', 'leisure=playground'] }
];
const SERVICES = [
  { id: 'fuel', name: 'דלק', ico: '⛽', osm: ['amenity=fuel'] },
  { id: 'ev', name: 'טעינה חשמלית', ico: '🔌', osm: ['amenity=charging_station'] },
  { id: 'toilets', name: 'שירותים', ico: '🚻', osm: ['amenity=toilets'] },
  { id: 'parking', name: 'חניה', ico: '🅿️', osm: ['amenity=parking'] },
  { id: 'pharmacy', name: 'בית מרקחת', ico: '💊', osm: ['amenity=pharmacy'] },
  { id: 'hospital', name: 'בית חולים', ico: '🏥', osm: ['amenity=hospital'] },
  { id: 'atm', name: 'כספומט', ico: '🏧', osm: ['amenity=atm'] }
];
const ALLCATS = [...INTERESTS, ...SERVICES];

// תסריטי קריינות למקומות במסלול – מי, מה, למה, כמה
const GUIDE = {
  'Pillar Point Harbor, Half Moon Bay': { lat: 37.5030, lon: -122.4823, name: 'נמל פילר פוינט, האף מון ביי', text: 'ברוכים הבאים לנמל פילר פוינט בהאף מון ביי. זה נמל דייגים פעיל, ובימים רבים אפשר לקנות דגים וסרטנים טריים ישירות מהסירות. ממש מעבר לשובר הגלים נמצא מאבריקס, אחד מאתרי גלי הענק המפורסמים בעולם. בחורף נוצרים כאן גלים בגובה של יותר מחמישה עשר מטר, וגולשים מכל העולם מגיעים במיוחד. עונת סרטן הדנג׳נס נפתחת בדרך כלל באמצע נובמבר, תלוי בהחלטות המדינה, אז שווה לשאול בנמל. הכניסה והחניה חינם.', cost: 'חינם', tip: 'שקיעה מהמזח – קחו מעיל, רוח קרה מהים.' },
  'Pigeon Point Lighthouse': { lat: 37.1829, lon: -122.3928, name: 'מגדלור פיג׳ן פוינט', text: 'מגדלור פיג׳ן פוינט נבנה בשנת אלף שמונה מאות שבעים ואחת, ובגובה של שלושים וחמישה מטרים הוא מהגבוהים בחוף המערבי של ארצות הברית. הוא קרוי על שם ספינה בשם קרייר פיג׳ן, יונת הדואר, שנטרפה כאן ב-1853. המגדל עצמו סגור לשיפוץ, אבל השטח פתוח, והנוף על הצוקים מדהים. בחורף אפשר לפעמים לראות לווייתנים אפורים בנדידה דרומה.', cost: 'חינם', tip: 'עצירה של 20–30 דקות מספיקה.' },
  'West Cliff Drive, Santa Cruz': { lat: 36.9533, lon: -122.0405, name: 'ווסט קליף דרייב, סנטה קרוז', text: 'ווסט קליף דרייב הוא שביל חוף לאורך הצוקים של סנטה קרוז. כאן, בשנת 1885, שלושה נסיכים מהוואי גלשו על גלשנים מעץ, ולפי ההיסטוריה זו הייתה הגלישה הראשונה ביבשת אמריקה. ליד המגדלור הקטן נמצא סטימר ליין, אחד מאתרי הגלישה המפורסמים בקליפורניה, ובתוך המגדלור יש מוזיאון גלישה קטן. בקצה השביל נמצא חוף נאצ׳רל ברידג׳ס, עם קשת סלע טבעית.', cost: 'חינם · חניה ברחוב', tip: 'צהריים טובים ברחוב פסיפיק במרכז העיר.' },
  'Moss Landing': { lat: 36.8044, lon: -121.7869, name: 'מוס לנדינג', text: 'מוס לנדינג הוא כפר דייגים קטן באמצע מפרץ מונטריי. ממש מתחת לפני המים מתחיל קניון מונטריי, קניון תת ימי עמוק כמו הגרנד קניון. זה מה שמביא לכאן כל כך הרבה חיים ימיים. בשפך אלקהורן סלאו חיות עשרות לוטרות ים, ולעיתים קרובות רואים אותן צפות על הגב ופותחות צדפות על הבטן. הארובות הגבוהות שרואים מכל מקום הן של תחנת כוח ישנה.', cost: 'חינם · שיט קיאקים או סירה מ-40$', tip: 'הכי טוב לראות לוטרות מהגשר בכניסה לנמל.' },
  'Monarch Butterfly Sanctuary, Pacific Grove': { lat: 36.6260, lon: -121.9295, name: 'מקדש פרפרי המונרך, פסיפיק גרוב', text: 'פסיפיק גרוב מכונה עיר הפרפרים של אמריקה. בין אוקטובר לפברואר, אלפי פרפרי מונרך מגיעים לכאן אחרי מסע ארוך, ונאספים באשכולות על עצי האקליפטוס כדי לעבור את החורף. הם נראים כמו עלים יבשים, עד שהשמש מחממת אותם והם מתחילים לעוף. בעיר יש קנס כבד על פגיעה בפרפרים. בימים קרים הם פחות פעילים, אז הכי טוב להגיע בצהריים ביום שמשי.', cost: 'חינם', tip: 'מתנדבים במקום עם משקפת – שאלו איפה האשכולות.' },
  'Carmel-by-the-Sea': { lat: 36.5552, lon: -121.9233, name: 'כרמל ליד הים', text: 'כרמל ליד הים היא אחת העיירות הציוריות בקליפורניה. אין כאן כתובות רחוב ואין חלוקת דואר הביתה, והתושבים אוספים את הדואר בסניף. בתי הקוטג׳ דמויי האגדות נבנו בשנות העשרים בידי הבנאי יו קומסטוק. השחקן קלינט איסטווד כיהן כאן כראש העיר בין 1986 ל-1988. העיירה ידועה גם כאחת הידידותיות ביותר לכלבים בארצות הברית.', cost: '', tip: 'חניה חינם ברחובות למשך שעתיים – שימו לב לשלטים.' },
  'Point Lobos State Natural Reserve': { lat: 36.5178, lon: -121.9447, name: 'שמורת פוינט לובוס', text: 'פוינט לובוס נחשבת לאחת השמורות היפות בקליפורניה, ויש מי שקוראים לה יהלום הכתר של הפארקים. כאן נמצא אחד משני היערות הטבעיים היחידים בעולם של ברוש מונטריי. במפרצונים חיים לוטרות ים, כלבי ים ואריות ים, ומדצמבר מתחילים לראות לווייתנים אפורים. במפרץ הלווייתנים פעלה במאה התשע עשרה תחנת ציד לווייתנים, והבקתה ההיסטורית היא היום מוזיאון קטן.', cost: 'חניה בפנים 10$ · או חינם על הכביש', tip: 'הגיעו בפתיחה – החניות מתמלאות מהר. מסלול Cypress Grove קצר ומושלם.' },
  'Bixby Creek Bridge': { lat: 36.3715, lon: -121.9019, name: 'גשר ביקסבי קריק', text: 'גשר ביקסבי נפתח בשנת 1932, והוא אחד הגשרים המצולמים בעולם. הוא באורך של מאתיים ושמונה עשר מטר, ובגובה של שבעים ותשעה מטר מעל הנחל. לפני שנבנה, תושבי ביג סור היו מנותקים בחורף. הגשר מופיע בפתיחה של הסדרה ״שקרים קטנים גדולים״.', cost: 'חינם', tip: 'לא לעצור על הגשר. חניית העצירה בצד הצפוני נותנת את הזווית הקלאסית.' },
  'Nepenthe, Big Sur': { lat: 36.2218, lon: -121.7593, name: 'נפנתה, ביג סור', text: 'מסעדת נפנתה נפתחה בשנת 1949 על צוק מעל האוקיינוס. את הקרקע קנו המייסדים מאורסון וולס וריטה הייוורת׳, שרכשו כאן בקתה אבל כמעט לא גרו בה. השם נפנתה לקוח מהמיתולוגיה היוונית: שיקוי שמשכיח צער. המנה המפורסמת היא ההמבורגר אמברוזיה. הנוף מהמרפסת הוא אחד היפים בכל הכביש.', cost: 'המבורגר ~28$ · עיקריות 40–80$', tip: 'בקשו שולחן במרפסת. יש המתנה – אפשר לשתות בבר בינתיים.' },
  'Monterey Bay Aquarium': { lat: 36.6183, lon: -121.9020, name: 'אקווריום מפרץ מונטריי', text: 'אקווריום מונטריי נפתח בשנת 1984 בתוך מפעל שימורי סרדינים לשעבר, והוא נחשב לאחד הטובים בעולם. המיכל של יער האצות מגיע לגובה של כשמונה מטרים, והאצות בו גדלות כמעט חצי מטר ביום. האקווריום מציל לוטרות ים יתומות ומחזיר אותן לטבע. פעמים ביום יש האכלת לוטרות, וכדאי לבדוק את השעות בכניסה.', cost: 'מבוגר 65$ · כרטיסים רק באונליין מראש', tip: 'הגיעו בפתיחה ב-10:00 והתחילו מהלוטרות.' },
  'Cannery Row, Monterey': { lat: 36.6150, lon: -121.8990, name: 'קאנרי רו, מונטריי', text: 'קאנרי רו, שורת המשמרות, היה פעם לב תעשיית הסרדינים של אמריקה. הסופר ג׳ון סטיינבק הנציח את המקום ברומן שלו מ-1945. בסוף שנות הארבעים הסרדינים כמעט נעלמו מהמפרץ, והמפעלים נסגרו. היום יש כאן מסעדות, חנויות ומלונות בתוך מבני המפעלים הישנים.', cost: '', tip: 'חניה בחניונים העירוניים זולה יותר מהפרטיים.' },
  'Lone Cypress, Pebble Beach': { lat: 36.5695, lon: -121.9651, name: 'הברוש הבודד, 17 מייל דרייב', text: 'הברוש הבודד עומד על סלע גרניט מעל האוקיינוס כבר יותר ממאתיים וחמישים שנה. הוא סמל רשום של חברת פבל ביץ׳, ומהווה את אחד הנופים המצולמים בקליפורניה. הדרך עצמה, שבעה עשר מייל דרייב, עוברת בין אחוזות, חופים ומגרשי גולף מפורסמים, ביניהם פבל ביץ׳ שאירח את אליפות ארצות הברית הפתוחה בגולף.', cost: '12.50$ לרכב · מוחזר בקנייה מעל 35$ במסעדות פבל ביץ׳', tip: 'האתר סגור בימי שני. נכנסים בשער פסיפיק גרוב ויוצאים בשער כרמל.' },
  'Carmel Beach': { lat: 36.5550, lon: -121.9290, name: 'חוף כרמל', text: 'חוף כרמל ידוע בחול הלבן והדק שלו ובשקיעות שלו. זה אחד החופים הבודדים בקליפורניה שבהם כלבים מותרים ללא רצועה. בערבים מתאספים כאן תושבים ומבקרים לראות את השמש שוקעת מאחורי ברושי מונטריי.', cost: 'חינם', tip: 'השקיעה בנובמבר בסביבות 16:55. קחו שכבה חמה.' },
  'Carmel Mission Basilica': { lat: 36.5429, lon: -121.9201, name: 'מיסיון כרמל', text: 'המיסיון בכרמל נוסד בשנת 1771 בידי הנזיר הפרנציסקני חוניפרו סרה, והיה המרכז של רשת עשרים ואחת המיסיונות בקליפורניה. סרה קבור כאן. ב-1960 קיבלה הכנסייה מעמד של בזיליקה. החצרות והגנים שקטים ומרשימים, ובמוזיאון מוצגים חפצים מתקופת המיסיונות.', cost: 'כניסה בתשלום (בסביבות 15$)', tip: 'סגור בימי שני ושלישי. ביום ראשון פותח ב-11:30.' },
  'Ocean Ave, Carmel-by-the-Sea': { lat: 36.5555, lon: -121.9235, name: 'אושן אווניו', text: 'אושן אווניו הוא הרחוב הראשי של כרמל, והוא יורד עד החוף. בצדדים יש גלריות אמנות, חנויות קטנות וחצרות פנימיות נסתרות. אפשר לאכול כאן ביס או לטעום יין, בלי לנסוע לשום מקום.', cost: '', tip: 'חפשו את החצרות הפנימיות בין הרחובות.' },
  'Carmel Valley Village': { lat: 36.4800, lon: -121.7330, name: 'כפר עמק כרמל', text: 'עמק כרמל נמצא כעשרים דקות נסיעה פנימה מהחוף. כאן הרבה יותר שמשי וחם, כי הערפל של האוקיינוס כמעט לא מגיע. בכפר יש עשרות חדרי טעימות של יקבים מקומיים, רובם במרחק הליכה זה מזה. העמק ידוע במיוחד ביין שרדונה ופינו נואר.', cost: 'טעימות 20–40$ לאדם', tip: 'נהג תורן! או בחרו יקב אחד בלבד.' }
};

const guideState = {
  interests: (() => { try { return JSON.parse(localStorage.getItem('tt-interests')) || ['nature', 'history', 'market', 'fuel']; } catch (e) { return ['nature', 'history', 'market', 'fuel']; } })(),
  radius: 5000, origin: null, wiki: null, pois: null, loading: false, err: '', auto: false, watchId: null, heard: new Set(), rate: 1, lang: 'he', speaking: null
};
const saveInterests = () => { try { localStorage.setItem('tt-interests', JSON.stringify(guideState.interests)); } catch (e) { } };
const distM = (a, b, c, d) => { const R = 6371e3, r = x => x * Math.PI / 180; const x = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const fmtDist = m => m < 1000 ? `${Math.round(m / 10) * 10} מ׳` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} ק״מ`;
const navUrl = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&hl=iw`;
const ytUrl = q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=iw`;

// ----- speech -----
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { voices = []; } }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const hasVoice = lang => voices.some(v => v.lang?.toLowerCase().startsWith(lang));
const speechQueue = [];
function speak(text, lang = 'he', id = null) {
  if (!('speechSynthesis' in window)) { toast('הדפדפן לא תומך בהקראה'); return; }
  speechQueue.length = 0; speechSynthesis.cancel(); enqueue(text, lang, id);
}
function enqueue(text, lang = 'he', id = null) {
  speechQueue.push({ text, lang, id }); if (!speechSynthesis.speaking && speechQueue.length === 1) next();
}
function next() {
  const item = speechQueue[0]; if (!item) { guideState.speaking = null; markSpeaking(); return; }
  const u = new SpeechSynthesisUtterance(item.text);
  const L = item.lang === 'he' ? 'he' : 'en';
  u.lang = L === 'he' ? 'he-IL' : 'en-US'; u.rate = guideState.rate;
  const v = voices.find(v => v.lang?.toLowerCase().startsWith(L)); if (v) u.voice = v;
  u.onend = u.onerror = () => { speechQueue.shift(); next(); };
  guideState.speaking = item.id; markSpeaking();
  speechSynthesis.speak(u);
}
function stopSpeech() { speechQueue.length = 0; try { speechSynthesis.cancel(); } catch (e) { } guideState.speaking = null; markSpeaking(); }
function markSpeaking() { $$('[data-say]').forEach(b => b.classList.toggle('speaking', b.dataset.say === guideState.speaking)); }
const scriptFor = g => `${g.name}. ${g.text}${g.cost ? ' עלות: ' + g.cost.replace(/\$/g, ' דולר') + '.' : ''}${g.tip ? ' טיפ: ' + g.tip : ''}`;

// ----- data sources (free, no key) -----
const trCache = new Map();
async function toHebrew(text) {
  if (!text) return '';
  if (trCache.has(text)) return trCache.get(text);
  try {
    const j = await (await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=iw&dt=t&q=${encodeURIComponent(text.slice(0, 1800))}`)).json();
    const out = (j[0] || []).map(x => x[0]).join('');
    trCache.set(text, out); return out;
  } catch (e) { return ''; }
}
async function fetchWiki(lat, lon, radius) {
  const one = async lang => {
    const u = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}%7C${lon}&ggsradius=${Math.min(radius, 10000)}&ggslimit=20&prop=extracts%7Ccoordinates%7Cpageimages%7Cinfo&inprop=url&exintro=1&explaintext=1&exsentences=4&exlimit=20&piprop=thumbnail&pithumbsize=240`;
    const j = await (await fetch(u)).json();
    return Object.values(j.query?.pages || {}).filter(p => p.coordinates && p.extract).map(p => ({ id: 'w' + lang + p.pageid, title: p.title, text: p.extract, lang, lat: p.coordinates[0].lat, lon: p.coordinates[0].lon, img: p.thumbnail?.source, url: p.fullurl }));
  };
  let he = []; try { he = await one('he'); } catch (e) { }
  let en = []; try { en = await one('en'); } catch (e) { }
  const heTitles = new Set(he.map(x => x.title));
  const list = [...he, ...en.filter(x => !heTitles.has(x.title))].map(x => ({ ...x, d: distM(lat, lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d).slice(0, 25);
  await Promise.all(list.filter(x => x.lang === 'en').map(async x => {
    const [tt, tx] = await Promise.all([toHebrew(x.title), toHebrew(x.text)]);
    if (tx) { x.origTitle = x.title; x.title = tt || x.title; x.text = tx; x.lang = 'he'; x.translated = true; }
  }));
  return list;
}
async function fetchPOIs(lat, lon, radius, catIds) {
  const cats = ALLCATS.filter(c => catIds.includes(c.id)); if (!cats.length) return [];
  const sel = cats.flatMap(c => c.osm).map(tag => { const [k, v] = tag.split('='); return v ? `nwr["${k}"="${v}"](around:${radius},${lat},${lon});` : `nwr["${k}"]["name"](around:${radius},${lat},${lon});`; }).join('');
  const q = `[out:json][timeout:25];(${sel});out center 300;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) throw new Error('שירות המפות עמוס, נסה שוב בעוד דקה');
  const j = await r.json();
  const matchCat = tags => cats.find(c => c.osm.some(tag => { const [k, v] = tag.split('='); return v ? tags[k] === v : tags[k] && tags.name; }));
  return (j.elements || []).map(e => {
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon, tg = e.tags || {}; const c = matchCat(tg); if (!c || la == null) return null;
    return { id: 'o' + e.id, cat: c.id, name: tg['name:he'] || tg.name || (c.name), brand: tg.brand, hours: tg.opening_hours, lat: la, lon: lo, d: distM(lat, lon, la, lo), web: tg.website, phone: tg.phone, unnamed: !tg.name };
  }).filter(Boolean).sort((a, b) => a.d - b.d);
}
async function geocode(q) {
  const j = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)).json();
  return j[0] ? { lat: +j[0].lat, lon: +j[0].lon } : null;
}
async function loadNearby() {
  const o = guideState.origin; if (!o) return;
  guideState.loading = true; guideState.err = ''; render();
  const [w, p] = await Promise.allSettled([fetchWiki(o.lat, o.lon, guideState.radius), fetchPOIs(o.lat, o.lon, guideState.radius, guideState.interests)]);
  guideState.wiki = w.status === 'fulfilled' ? w.value : [];
  guideState.pois = p.status === 'fulfilled' ? p.value : [];
  if (p.status === 'rejected') guideState.err = p.reason?.message || 'שגיאה בטעינת שירותים';
  guideState.loading = false; render();
}
function useMyLocation(then) {
  if (!navigator.geolocation) return toast('אין גישה למיקום במכשיר הזה');
  navigator.geolocation.getCurrentPosition(pos => { guideState.origin = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: '📍 המיקום שלי' }; loadNearby(); then?.(); }, () => toast('לא אושרה גישה למיקום'), { enableHighAccuracy: true, timeout: 15000 });
}
function toggleAuto() {
  if (guideState.auto) { navigator.geolocation.clearWatch(guideState.watchId); guideState.auto = false; stopSpeech(); render(); return; }
  if (!navigator.geolocation) return toast('אין גישה למיקום');
  guideState.auto = true; render();
  enqueue('הסיור הקולי הופעל. אספר לכם על כל מקום מעניין שנתקרב אליו. נסיעה טובה!', 'he');
  let last = null;
  guideState.watchId = navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    if (!last || distM(last.lat, last.lon, lat, lon) > 2000) { last = { lat, lon }; guideState.origin = { lat, lon, label: '📍 המיקום שלי (חי)' }; loadNearby(); }
    Object.entries(GUIDE).forEach(([k, g]) => { if (!guideState.heard.has(k) && distM(lat, lon, g.lat, g.lon) < 500) { guideState.heard.add(k); enqueue(scriptFor(g), 'he', 'g:' + k); } });
    (guideState.wiki || []).forEach(w => { if (!guideState.heard.has(w.id) && distM(lat, lon, w.lat, w.lon) < 300) { guideState.heard.add(w.id); enqueue(w.title + '. ' + w.text, w.lang, w.id); } });
  }, () => toast('איבדנו את המיקום'), { enableHighAccuracy: true, maximumAge: 10000 });
}

function guideStops(t) {
  const out = [];
  tripDays(t).forEach((d, i) => (t.days[d]?.stops || []).forEach(s => { const g = GUIDE[s.place]; out.push({ key: s.place, day: i + 1, title: s.title, place: s.place, g }); }));
  return out.filter(s => s.place && s.place !== 'SFO');
}
function renderGuide(t) {
  const stops = guideStops(t);
  const o = guideState.origin;
  const heOk = hasVoice('he');
  const curated = o ? Object.entries(GUIDE).map(([k, g]) => ({ k, g, d: distM(o.lat, o.lon, g.lat, g.lon) })).filter(x => x.d <= Math.max(guideState.radius, 3000)).sort((a, b) => a.d - b.d) : [];
  const grouped = {}; (guideState.pois || []).forEach(p => { (grouped[p.cat] ||= []).push(p); });
  const chip = c => `<button class="chipbtn ${guideState.interests.includes(c.id) ? 'on' : ''}" data-int="${c.id}">${c.ico} ${c.name}</button>`;
  const sayBtn = (id, label = '🔊') => `<button class="mini say" data-say="${esc(id)}" title="הקרא">${label}</button>`;
  const placeCard = (k, g, d) => `<div class="card place">
      <div class="row"><div class="spacer"><b>${esc(g.name)}</b>${d != null ? ` <span class="small muted">· ${fmtDist(d)}</span>` : ''}</div>${sayBtn('g:' + k, '🔊 הקרא')}</div>
      <p class="small" style="margin:8px 0">${esc(g.text)}</p>
      <div class="row wrap small">${g.cost ? `<span class="chip gold">💲 ${esc(g.cost)}</span>` : ''}${g.tip ? `<span class="chip">💡 ${esc(g.tip)}</span>` : ''}</div>
      <div class="row wrap" style="margin-top:8px"><a class="btn sm" href="${ytUrl(k + ' travel guide')}" target="_blank" rel="noopener">🎬 סרטונים</a><a class="btn sm" href="${navUrl(g.lat, g.lon)}" target="_blank" rel="noopener">🧭 ניווט</a>${rideBtns(g.lat, g.lon, g.name, true)}<button class="btn sm" data-here="${esc(k)}">📍 מה יש בסביבה</button>${revBtn(k)}${favBtn({ id: 'g:' + k, type: 'place', name: g.name, place: k, lat: g.lat, lon: g.lon, note: g.cost || '' }, true)}</div>
    </div>`;
  return `<div class="section-head"><h1>מדריך קולי</h1><button class="btn ${guideState.auto ? 'danger' : 'primary'}" id="autoTour">${guideState.auto ? '⏹ עצור סיור' : '🎧 סיור אוטומטי'}</button></div>
  <div class="card">
    <div class="small muted">${guideState.auto ? '🟢 הסיור פעיל – הקריין יספר על כל מקום שתתקרבו אליו. השאירו את המסך דלוק.' : 'הפעילו סיור אוטומטי בנסיעה, או בחרו מקום והקשיבו.'}</div>
    ${!heOk ? `<div class="small" style="color:var(--warn);margin-top:6px">⚠️ לא נמצא קול עברי בדפדפן הזה. באייפון ובאנדרואיד בכרום הוא קיים בדרך כלל. ההקראה תתבצע בקול ברירת המחדל.</div>` : ''}
    <div class="row" style="margin-top:10px"><label class="small muted">מהירות</label><input type="range" id="rate" min="0.7" max="1.4" step="0.1" value="${guideState.rate}" style="flex:1;padding:0"><button class="btn sm" id="stopSay">⏸ עצור</button></div>
  </div>

  <div class="section"><h2>מה מעניין אותך?</h2>
    <div class="row wrap">${INTERESTS.map(chip).join('')}</div>
    <h3 style="margin-top:12px">שירותים בדרך</h3>
    <div class="row wrap">${SERVICES.map(chip).join('')}</div>
    <div class="row" style="margin-top:12px">
      <select id="originSel" style="flex:2"><option value="">בחר נקודה…</option><option value="__me">📍 המיקום שלי</option>
        ${stops.map((s, i) => `<option value="${i}" ${o?.label === s.title ? 'selected' : ''}>יום ${s.day} · ${esc(s.title)}</option>`).join('')}</select>
      <select id="radiusSel" style="flex:1">${[[2000, '2 ק״מ'], [5000, '5 ק״מ'], [10000, '10 ק״מ'], [25000, '25 ק״מ']].map(([v, l]) => `<option value="${v}" ${v === guideState.radius ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    ${o ? `<div class="small muted" style="margin-top:6px">מציג סביב: <b>${esc(o.label)}</b> <button class="mini" id="refreshNearby">🔄</button></div>` : ''}
  </div>

  ${guideState.loading ? `<div class="card empty section"><span class="big">🧭</span>מחפש מקומות בסביבה…</div>` : ''}

  ${o && curated.length ? `<div class="section"><div class="section-head"><h2>🎙️ על המקום</h2></div>${curated.map(x => placeCard(x.k, x.g, x.d)).join('')}</div>` : ''}

  ${o && guideState.wiki?.length ? `<div class="section"><div class="section-head"><h2>📚 מקומות קרובים שכדאי להכיר</h2><button class="btn sm" id="sayAllWiki">🔊 הקרא הכל</button></div>
    <div class="card"><ul class="list">${guideState.wiki.map(w => `<li class="li">${w.img ? `<img src="${esc(w.img)}" alt="" class="thumb">` : `<div class="ico">📖</div>`}
      <div class="main"><div class="t">${esc(w.title)} <span class="small muted">· ${fmtDist(w.d)}${w.translated ? ' · תורגם' : w.lang === 'en' ? ' · EN' : ''}</span></div><div class="small muted clamp">${esc(w.text)}</div>
        <div class="row wrap" style="margin-top:4px">${favBtn({ id: w.id, type: 'place', name: w.title, place: w.origTitle || w.title, lat: w.lat, lon: w.lon, link: w.url })}${sayBtn(w.id)}<a class="mini" href="${ytUrl(w.title)}" target="_blank" rel="noopener" title="סרטונים">🎬</a><a class="mini" href="${navUrl(w.lat, w.lon)}" target="_blank" rel="noopener" title="ניווט">🧭</a><a class="mini" href="${esc(w.translated ? TRANSLATE(w.url) : w.url)}" target="_blank" rel="noopener" title="ויקיפדיה">ℹ️</a></div></div></li>`).join('')}</ul></div></div>` : ''}

  ${o && guideState.pois ? `<div class="section"><h2>🔎 לפי הבחירה שלך</h2>
    ${guideState.err ? `<div class="card small" style="color:var(--warn)">${esc(guideState.err)}</div>` : ''}
    ${ALLCATS.filter(c => guideState.interests.includes(c.id)).map(c => { const items = (grouped[c.id] || []).filter((p, i, a) => !p.unnamed || i < 3).slice(0, 8); return `<div class="card"><h3>${c.ico} ${c.name} <span class="small muted">(${(grouped[c.id] || []).length})</span></h3>
      ${items.length ? `<ul class="list">${items.map(p => `<li class="li"><div class="main"><div class="t">${esc(p.name)}${p.brand && p.brand !== p.name ? ` <span class="small muted">· ${esc(p.brand)}</span>` : ''}</div>
        <div class="small muted">${fmtDist(p.d)}${p.hours ? ` · <span dir="ltr">${esc(p.hours)}</span>` : ''}</div></div>
        ${p.phone ? `<a class="mini" href="tel:${esc(p.phone)}">📞</a>` : ''}${p.web ? `<a class="mini" href="${esc(p.web)}" target="_blank" rel="noopener">🌐</a>` : ''}${favBtn({ id: p.id, type: p.cat, name: p.name, place: p.name, lat: p.lat, lon: p.lon, link: p.web || '', note: p.hours || '' })}${!p.unnamed && INTERESTS.some(c => c.id === p.cat) ? `<button class="mini" data-rev="${esc(p.name)}" data-revwhere="${esc(guideState.origin?.label || '')}" title="חוות דעת">⭐</button>` : ''}<a class="btn sm" href="${navUrl(p.lat, p.lon)}" target="_blank" rel="noopener">🧭</a></li>`).join('')}</ul>` : `<div class="small muted">לא נמצא ברדיוס הזה – נסה להגדיל.</div>`}</div>`; }).join('')}
    <div class="small muted" style="margin-top:6px">נתונים: OpenStreetMap ו-ויקיפדיה. שעות פתיחה לפי מה שעודכן במפה – כדאי לוודא.</div></div>` : ''}

  ${!o ? `<div class="section"><div class="section-head"><h2>🎙️ המקומות במסלול שלך</h2><button class="btn sm" id="sayAllStops">🔊 הקרא את כל המסלול</button></div>
    ${stops.filter(s => s.g).map(s => placeCard(s.key, s.g, null)).join('') || '<div class="card muted">הוסף תחנות למסלול כדי לקבל הסברים.</div>'}</div>` : ''}`;
}
function bindGuide(t) {
  if (!$('#autoTour')) return;
  $('#autoTour').onclick = toggleAuto;
  $('#stopSay').onclick = stopSpeech;
  $('#rate').oninput = e => { guideState.rate = Number(e.target.value); };
  $$('[data-int]').forEach(b => b.onclick = () => { const id = b.dataset.int; const s = new Set(guideState.interests); s.has(id) ? s.delete(id) : s.add(id); guideState.interests = [...s]; saveInterests(); if (guideState.origin) loadNearby(); else render(); });
  $('#radiusSel').onchange = e => { guideState.radius = Number(e.target.value); if (guideState.origin) loadNearby(); };
  $('#originSel').onchange = async e => {
    const v = e.target.value; if (!v) return;
    if (v === '__me') return useMyLocation();
    const s = guideStops(t)[Number(v)];
    let c = s.g ? { lat: s.g.lat, lon: s.g.lon } : null;
    if (!c) { try { c = await geocode(s.place); } catch (err) { } }
    if (!c) return toast('לא מצאתי את המקום במפה');
    guideState.origin = { ...c, label: s.title }; loadNearby();
  };
  $('#refreshNearby')?.addEventListener('click', loadNearby);
  $$('[data-here]').forEach(b => b.onclick = () => { const g = GUIDE[b.dataset.here]; guideState.origin = { lat: g.lat, lon: g.lon, label: g.name }; loadNearby(); window.scrollTo(0, 0); });
  $$('[data-say]').forEach(b => b.onclick = () => {
    const id = b.dataset.say; if (guideState.speaking === id) return stopSpeech();
    if (id.startsWith('g:')) { const g = GUIDE[id.slice(2)]; speak(scriptFor(g), 'he', id); }
    else { const w = (guideState.wiki || []).find(x => x.id === id); if (w) speak(w.title + '. ' + w.text, w.lang, id); }
  });
  $('#sayAllWiki')?.addEventListener('click', () => { stopSpeech(); guideState.wiki.forEach(w => enqueue(w.title + '. ' + w.text, w.lang, w.id)); });
  $('#sayAllStops')?.addEventListener('click', () => { stopSpeech(); guideStops(t).filter(s => s.g).forEach((s, i) => enqueue(`יום ${s.day}. ` + scriptFor(s.g), 'he', 'g:' + s.key)); });
  markSpeaking();
}

// =====================================================================
//  מרכז חיפוש אחד – טיסות, מלונות, רכב, מסעדות, אטרקציות בכל המנועים
// =====================================================================
const KINDS = [
  { id: 'flights', name: 'טיסות', ico: '✈️' }, { id: 'hotels', name: 'מלונות', ico: '🏨' }, { id: 'cars', name: 'רכב', ico: '🚗' },
  { id: 'food', name: 'מסעדות', ico: '🍽️' }, { id: 'things', name: 'אטרקציות', ico: '🎟️' }
];
const hubState = { kind: 'flights', forms: {}, live: {} };
const enc = encodeURIComponent;
function hubDefaults(t, kind) {
  const city = t.city || t.destination || '';
  if (kind === 'hotels') return { where: city, checkin: t.start, checkout: t.end, adults: t.travelers || 2, rooms: 1 };
  if (kind === 'cars') return { where: t.airport || city, pickup: t.start, ptime: '15', dropoff: t.end, dtime: '10' };
  return { where: city, date: t.start, people: t.travelers || 2 };
}
function hubLinks(kind, f) {
  const w = f.where || '';
  if (kind === 'hotels') { const { checkin: a, checkout: b, adults: n, rooms: r } = f; return [
    { name: 'Booking.com', ico: '🔵', note: 'המבחר הגדול בעולם', url: `https://www.booking.com/searchresults.html?ss=${enc(w)}&checkin=${a}&checkout=${b}&group_adults=${n}&no_rooms=${r}` },
    { name: 'Google Hotels', ico: '🟢', note: 'משווה מחירים מכל האתרים', url: `https://www.google.com/travel/search?q=${enc(`hotels in ${w} ${a} to ${b} ${n} adults`)}` },
    { name: 'Expedia', ico: '🟡', note: 'הנחות בחבילה עם טיסה', url: `https://www.expedia.com/Hotel-Search?destination=${enc(w)}&startDate=${a}&endDate=${b}&adults=${n}&rooms=${r}` },
    { name: 'Hotels.com', ico: '🔴', note: 'לילה חינם על כל 10', url: `https://www.hotels.com/Hotel-Search?destination=${enc(w)}&startDate=${a}&endDate=${b}&adults=${n}` },
    { name: 'Kayak', ico: '🟠', note: 'משווה עשרות אתרים', url: `https://www.kayak.com/hotels/${enc(w)}/${a}/${b}/${n}adults?sort=price_a` },
    { name: 'Agoda', ico: '🟣', note: 'לעיתים זול יותר', url: `https://www.agoda.com/search?textToSearch=${enc(w)}&checkIn=${a}&checkOut=${b}&adults=${n}&rooms=${r}` },
    { name: 'Airbnb', ico: '🏡', note: 'דירות ובתים', url: `https://www.airbnb.com/s/${enc(w)}/homes?checkin=${a}&checkout=${b}&adults=${n}` }
  ]; }
  if (kind === 'cars') { const p = `${f.pickup}-${f.ptime}h`, d = `${f.dropoff}-${f.dtime}h`, md = s => { const [y, m, dd] = s.split('-'); return `${m}/${dd}/${y}`; }, tm = h => `${String(((+h + 11) % 12) + 1).padStart(2, '0')}00${+h < 12 ? 'AM' : 'PM'}`; return [
    { name: 'Kayak', ico: '🟠', note: 'משווה את כל החברות', url: `https://www.kayak.com/cars/${enc(w)}/${p}/${d}?sort=price_a` },
    { name: 'Momondo', ico: '🟣', note: 'השוואה נוספת', url: `https://www.momondo.com/cars/${enc(w)}/${p}/${d}?sort=price_a` },
    { name: 'Expedia', ico: '🟡', note: 'כולל חברות גדולות', url: `https://www.expedia.com/carsearch?locn=${enc(w)}&date1=${md(f.pickup)}&date2=${md(f.dropoff)}&time1=${tm(f.ptime)}&time2=${tm(f.dtime)}` },
    { name: 'Google', ico: '🟢', note: 'חיפוש כללי', url: `https://www.google.com/search?q=${enc(`car rental ${w} ${f.pickup} to ${f.dropoff}`)}` },
    { name: 'DiscoverCars', ico: '🚙', note: 'ביטוח מלא זול – ממלאים ידנית', url: `https://www.discovercars.com/` },
    { name: 'Rentalcars', ico: '🚘', note: 'ממלאים ידנית', url: `https://www.rentalcars.com/` }
  ]; }
  if (kind === 'food') return [
    { name: 'Google Maps', ico: '🗺️', note: 'דירוגים, שעות, תמונות', url: `https://www.google.com/maps/search/${enc('restaurants near ' + w)}` },
    { name: 'TripAdvisor', ico: '🦉', note: 'ביקורות מטיילים', url: `https://www.tripadvisor.com/Search?q=${enc('restaurants ' + w)}` },
    { name: 'Yelp', ico: '🔴', note: 'הכי פופולרי בארה״ב', url: `https://www.yelp.com/search?find_desc=Restaurants&find_loc=${enc(w)}` },
    { name: 'OpenTable', ico: '📅', note: 'הזמנת שולחן', url: `https://www.opentable.com/s?term=${enc(w)}&covers=${f.people}&dateTime=${f.date}T19%3A00` },
    { name: 'Resy', ico: '⬛', note: 'מסעדות שף', url: `https://resy.com/` }
  ];
  if (kind === 'things') return [
    { name: 'GetYourGuide', ico: '🟥', note: 'סיורים וכרטיסים', url: `https://www.getyourguide.com/s/?q=${enc(w)}&date_from=${f.date}` },
    { name: 'Viator', ico: '🟩', note: 'של TripAdvisor', url: `https://www.viator.com/searchResults/all?text=${enc(w)}` },
    { name: 'TripAdvisor', ico: '🦉', note: 'הדברים הכי שווים', url: `https://www.tripadvisor.com/Search?q=${enc('things to do ' + w)}` },
    { name: 'Klook', ico: '🟧', note: 'הנחות על כרטיסים', url: `https://www.klook.com/search/result/?query=${enc(w)}` },
    { name: 'Google', ico: '🟢', note: 'Things to do', url: `https://www.google.com/search?q=${enc('things to do in ' + w)}` }
  ];
  return [];
}
const scrollToResults = () => setTimeout(() => $('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
// כל אתר נפתח בעברית: גרסה עברית מקורית כשיש, אחרת דרך Google Translate (עם קישור למקור)
const TRANSLATE = u => `https://translate.google.com/translate?sl=auto&tl=iw&hl=iw&u=${encodeURIComponent(u)}`;
function heLink(raw) {
  let u; try { u = new URL(raw); } catch (e) { return { url: raw, he: false }; }
  const h = u.hostname.replace(/^www\./, ''), set = (k, v) => u.searchParams.set(k, v);
  if (h === 'skyscanner.co.il') { set('locale', 'he-IL'); return { url: u.href, he: true }; }
  if (h === 'google.com') { set('hl', 'iw'); return { url: u.href, he: true }; }
  if (h === 'kayak.com') { u.hostname = 'he.kayak.com'; return { url: u.href, he: true }; }
  if (h === 'booking.com') { set('lang', 'he'); return { url: u.href, he: true }; }
  if (h === 'hotels.com') { u.hostname = 'he.hotels.com'; set('locale', 'he_IL'); return { url: u.href, he: true }; }
  if (h === 'agoda.com') { u.pathname = '/he-il' + u.pathname; return { url: u.href, he: true }; }
  if (h === 'airbnb.com') { u.hostname = 'he.airbnb.com'; return { url: u.href, he: true }; }
  if (h === 'tripadvisor.com') { u.hostname = 'www.tripadvisor.co.il'; return { url: u.href, he: true }; }
  return { url: TRANSLATE(raw), he: false, orig: raw };
}
const linkGrid = links => `<div class="linkgrid">${links.map(l => { const x = heLink(l.url); return `<div class="card linkcard"><a class="lmain" href="${esc(x.url)}" target="_blank" rel="noopener"><span class="lico">${l.ico}</span><div><b>${l.name}</b><div class="small muted">${l.note}</div></div></a>
  <div class="lfoot"><span class="chip ${x.he ? 'ok' : 'gold'}">${x.he ? 'עברית' : 'מתורגם'}</span>${x.orig ? `<a class="small muted" href="${esc(x.orig)}" target="_blank" rel="noopener">מקור ↗</a>` : ''}</div></div>`; }).join('')}</div>`;
function renderSearch(t) {
  const k = hubState.kind;
  const seg = `<div class="kinds">${KINDS.map(x => `<button data-kind="${x.id}" class="${x.id === k ? 'active' : ''}"><span>${x.ico}</span>${x.name}</button>`).join('')}</div>`;
  if (k === 'flights') return `${seg}${renderWatches(t)}<div style="height:12px"></div>` + renderFlights(t).replace('<div class="section-head"><h1>חיפוש טיסות</h1></div>', '');
  const f = hubState.forms[k] ||= hubDefaults(t, k);
  const fld = (n, l, type = 'text', extra = '') => `<div class="field"><label>${l}</label><input name="${n}" type="${type}" value="${esc(f[n])}" ${extra}></div>`;
  const hours = n => `<div class="field"><label>שעה</label><select name="${n}">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${String(h) === String(f[n]) ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></div>`;
  const form = k === 'hotels' ? `${fld('where', 'יעד')}<div class="field-row">${fld('checkin', 'צ׳ק-אין', 'date')}${fld('checkout', 'צ׳ק-אאוט', 'date')}</div><div class="field-row">${fld('adults', 'אורחים', 'number', 'min=1')}${fld('rooms', 'חדרים', 'number', 'min=1')}</div>`
    : k === 'cars' ? `${fld('where', 'מקום איסוף (שדה או עיר)')}<div class="field-row">${fld('pickup', 'איסוף', 'date')}${hours('ptime')}</div><div class="field-row">${fld('dropoff', 'החזרה', 'date')}${hours('dtime')}</div>`
    : `${fld('where', 'איפה')}<div class="field-row">${fld('date', 'תאריך', 'date')}${fld('people', 'כמה אנשים', 'number', 'min=1')}</div>`;
  const extra = k === 'cars' ? `<div class="card small"><b>🛡️ ביטוח מלא לשני נהגים – מה לבדוק:</b> CDW/LDW (נזק לרכב), SLI (צד ג׳ – קריטי בארה״ב), נהג נוסף (בקליפורניה בן/בת זוג נשואים לרוב בחינם), ואיסוף אחרי 17:00.</div>`
    : (k === 'food' || k === 'things') ? `<div class="card small">💡 בזמן הטיול – לשונית <a href="#/trip/${t.id}/guide">מדריך</a> מראה ${k === 'food' ? 'מסעדות, שווקים ובתי קפה' : 'אטרקציות ומקומות'} ליד המיקום שלך, עם הקראה וניווט.</div>` : '';
  const sum = k === 'hotels' ? `${fmtRange(f.checkin, f.checkout)} · ${f.adults} אורחים` : k === 'cars' ? `${fmtRange(f.pickup, f.dropoff)} · ${String(f.ptime).padStart(2, '0')}:00–${String(f.dtime).padStart(2, '0')}:00` : `${fmtRange(f.date)} · ${f.people} אנשים`;
  const col = hubState.collapsed?.[k];
  return `${seg}${renderWatches(t)}${col ? `<div class="card qbar section"><div class="spacer"><b>${esc(f.where)}</b><div class="small muted">${sum}</div></div><button class="btn sm" id="editQ">✏️ שינוי</button></div>` : ''}<form class="card grid section" id="hubForm" ${col ? 'hidden' : ''}>${form}<div class="row btnstack"><button class="btn primary big" style="flex:1">🔎 השווה בכל האתרים</button>${k !== 'cars' ? `<button type="button" class="btn green big" id="hubLive" style="flex:1">⚡ חיפוש חי בכל הספקים</button>` : ''}</div>${k === 'hotels' ? `<button type="button" class="btn big" id="flexHotels">📅 השווה תאריכים (±3 ימים)</button>` : ''}</form>${k === 'hotels' ? renderFlex('hotels') : ''}${renderHubLive(t, k)}
    <div class="section" id="results"><h2>${KINDS.find(x => x.id === k).ico} תוצאות ב-${hubLinks(k, f).length} אתרים</h2><div class="small muted" style="margin-bottom:8px">כל אתר נפתח עם הפרטים ממולאים. השוו מחירים ושמרו את הנבחר בהזמנות.</div>${linkGrid(hubLinks(k, f))}</div>${extra}`;
}
function renderHubLive(t, k) {
  const L = hubState.live[k]; if (!L) return '';
  if (L.loading) return `<div class="card empty section" id="hubLiveBox"><span class="big">⏳</span>פונה לכל הספקים במקביל…</div>`;
  if (L.error) return `<div class="card section" id="hubLiveBox"><b>חיפוש חי לא זמין</b><div class="small muted">${esc(L.error)}</div></div>`;
  const res = L.results || [];
  let body = '';
  if (k === 'hotels') {
    const n = Math.max(1, daysBetween(hubState.forms.hotels.checkin, hubState.forms.hotels.checkout));
    res.forEach(h => { h.q = (h.rating || 3.5) ** 2 * Math.min(1, Math.log10((h.reviews || 0) + 1) / 3); h.value = h.perNight / Math.max(h.q, 1); h.badges = []; });
    const cheapest = [...res].sort((a, b) => a.perNight - b.perNight)[0]; if (cheapest) cheapest.badges.push('💰 הכי זול');
    const bestv = [...res].filter(h => (h.rating || 0) >= 4).sort((a, b) => a.value - b.value)[0]; if (bestv) bestv.badges.push('🏆 הכי משתלם');
    const top = [...res].sort((a, b) => b.q - a.q)[0]; if (top) top.badges.push('⭐ הכי מדורג');
    res.sort((a, b) => b.badges.length - a.badges.length || a.value - b.value);
    body = res.map((h, i) => `<div class="card hotel ${h.badges.length ? 'win' : ''}">${h.img ? `<img src="${esc(h.img)}" alt="" class="himg">` : ''}<div class="hbody">
      <div class="row wrap"><b class="spacer">${esc(h.name)}</b>${h.badges.map(b => `<span class="chip ok">${b}</span>`).join('')}</div>
      <div class="small muted">${h.stars ? '★'.repeat(h.stars) + ' · ' : ''}${h.rating ? `⭐ ${h.rating} (${h.reviews})` : ''}</div>
      <div class="row" style="margin-top:4px"><span class="price" dir="ltr">$${Math.round(h.perNight)}</span><span class="small muted">ללילה · סה״כ ~${fmtMoney(toILS(t, h.total || h.perNight * n, h.currency))}</span></div>
      ${h.sources ? `<div class="small muted clamp">${esc(h.sources)}</div>` : ''}
      <div class="row wrap" style="margin-top:6px"><span class="chip src">${esc(h.source)}</span><span class="spacer"></span><a class="btn sm" href="${esc(heLink(h.link).url)}" target="_blank" rel="noopener">פתח ↗</a>${favBtn({ id: 'h:' + h.name, type: 'hotel', name: h.name, place: h.name, lat: h.lat, lon: h.lon, link: h.link, note: `$${Math.round(h.perNight)} ללילה${h.rating ? ' · ⭐' + h.rating : ''}` })}${revBtn(h.name, hubState.forms.hotels?.where || '')}${watchBtn('hotel', h, hubState.forms.hotels)}<button class="btn sm" data-savehotel="${i}">💾 שמור</button></div></div></div>`).join('');
  } else {
    res.sort((a, b) => (b.rating || 0) * Math.log10((b.reviews || 0) + 10) - (a.rating || 0) * Math.log10((a.reviews || 0) + 10));
    body = `<div class="card"><ul class="list">${res.map(p => `<li class="li"><div class="main"><div class="t">${esc(p.name)}</div>
      <div class="small muted">${p.type ? esc(p.type) + ' · ' : ''}${p.rating ? `⭐ ${p.rating} (${p.reviews})` : ''}${p.price ? ' · ' + p.price : ''}${p.openNow === true ? ' · <span style="color:var(--green)">פתוח עכשיו</span>' : p.openNow === false ? ' · סגור עכשיו' : ''}</div>
      <div class="small muted">${esc(p.address || '')}</div>${p.topReview ? `<div class="small toprev">״${esc(p.topReview)}״</div>` : ''}<div style="margin-top:6px">${revBtn(p.name, p.address || '')}</div></div>${favBtn({ id: 'p:' + p.name, type: k === 'food' ? 'food' : 'history', name: p.name, place: p.address || p.name, lat: p.lat, lon: p.lon, link: p.link, note: p.rating ? '⭐ ' + p.rating : '' })}<a class="btn sm" href="${esc(heLink(p.link).url)}" target="_blank" rel="noopener">🧭</a></li>`).join('')}</ul></div>`;
  }
  return `<div class="section" id="hubLiveBox"><h2>⚡ כל הספקים · ${res.length} תוצאות</h2>${providerBar(L.providers)}${res.length ? body : '<div class="card muted">לא נמצאו תוצאות.</div>'}</div>`;
}
function bindSearch(t) {
  $$('[data-kind]').forEach(b => b.onclick = () => { hubState.kind = b.dataset.kind; render(); });
  if (hubState.kind === 'flights') return bindFlights(t);
  const form = $('#hubForm'); if (!form) return;
  form.onsubmit = e => { e.preventDefault(); hubState.forms[hubState.kind] = Object.fromEntries(new FormData(form)); (hubState.collapsed ||= {})[hubState.kind] = true; render(); scrollToResults(); };
  $('#editQ')?.addEventListener('click', () => { hubState.collapsed[hubState.kind] = false; render(); });
  $('#flexHotels')?.addEventListener('click', () => { hubState.forms.hotels = Object.fromEntries(new FormData(form)); runFlex('hotels'); });
  $$('#flexBox [data-flexpick]').forEach(b => { if (hubState.kind !== 'hotels') return; b.onclick = async () => { const c = hubState.flex.cells.find(x => x.n === +b.dataset.flexpick); if (!c) return; hubState.forms.hotels = { ...hubState.forms.hotels, checkin: c.q.checkin, checkout: c.q.checkout }; render(); $('#hubLive')?.click(); }; });
  $('#hubLive')?.addEventListener('click', async () => {
    const k = hubState.kind; hubState.forms[k] = Object.fromEntries(new FormData(form)); (hubState.collapsed ||= {})[k] = true;
    hubState.live[k] = { loading: true }; render();
    try { const j = await searchAll({ kind: k, ...hubState.forms[k] }); hubState.live[k] = { results: j.results || [], providers: j.providers }; }
    catch (e) { hubState.live[k] = { error: e.message }; }
    render(); $('#hubLiveBox')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $$('[data-savehotel]').forEach(b => b.onclick = async () => {
    const h = hubState.live.hotels.results[b.dataset.savehotel], f = hubState.forms.hotels;
    await mutate(x => x.bookings.push({ id: uid(), type: 'hotel', title: h.name, provider: h.source, conf: '', start: f.checkin, end: f.checkout, price: Math.round(h.total || h.perNight * Math.max(1, daysBetween(f.checkin, f.checkout))), currency: h.currency, status: 'planned', link: h.link, notes: h.sources || '', file: null }));
    toast('נשמר בהזמנות');
  });
}

// ---------- חוות דעת: הכי טובות קודם, בעברית ----------
const revBtn = (name, where = '') => `<button class="btn sm" data-rev="${esc(name)}" data-revwhere="${esc(where)}">⭐ חוות דעת</button>`;
const stars = r => r ? '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r)) : '';
async function openReviews(name, where) {
  const dlg = $('#modal');
  $('#modalTitle').textContent = `⭐ חוות דעת · ${name}`;
  $('#modalDelete').hidden = true; $('#modalSave').textContent = 'סגירה';
  $('#modalCancel').onclick = () => dlg.close(); $('#modalForm').onsubmit = e => { e.preventDefault(); dlg.close(); };
  const q = encodeURIComponent(`${name} ${where}`.trim());
  const links = `<div class="row wrap"><a class="btn sm" href="${esc(heLink(`https://www.google.com/maps/search/${q}`).url)}" target="_blank" rel="noopener">כל הביקורות בגוגל ↗</a><a class="btn sm" href="${esc(heLink(`https://www.tripadvisor.com/Search?q=${q}`).url)}" target="_blank" rel="noopener">TripAdvisor ↗</a></div>`;
  $('#modalBody').innerHTML = `<div class="empty"><span class="big">⏳</span>מחפש את חוות הדעת הכי טובות…</div>`;
  if (!dlg.open) dlg.showModal();
  try {
    const j = await searchAll({ kind: 'reviews', name, where });
    const pl = j.results?.[0];
    if (!pl) throw new Error(j.providers?.[0]?.status === 'off' ? 'חוות דעת חיות יופיעו אחרי חיבור GOOGLE_PLACES_KEY.' : 'לא נמצאו חוות דעת למקום הזה.');
    $('#modalBody').innerHTML = `<div class="card"><div class="row"><b class="spacer">${esc(pl.name)}</b><span class="rstars">${stars(pl.rating)}</span></div>
        <div class="small muted">⭐ ${pl.rating ?? '–'} מתוך 5 · ${(pl.count || 0).toLocaleString('he-IL')} ביקורות</div>${pl.summary ? `<p class="small" style="margin:8px 0 0">${esc(pl.summary)}</p>` : ''}</div>
      ${pl.reviews.length ? pl.reviews.map(v => `<div class="card review"><div class="row"><span class="rstars">${stars(v.rating)}</span><span class="spacer"></span><span class="small muted">${esc(v.author)}${v.when ? ' · ' + esc(v.when) : ''}</span></div>
        <p class="small" style="margin:6px 0 0">${esc(v.text)}</p>${v.original && v.original !== v.text ? `<details class="small muted"><summary>מקור</summary>${esc(v.original)}</details>` : ''}</div>`).join('') : '<div class="small muted">אין טקסט ביקורות זמין.</div>'}
      <div class="small muted">ממוין מהדירוג הגבוה. מתורגם לעברית ע״י Google.</div>${links}`;
  } catch (e) {
    $('#modalBody').innerHTML = `<div class="card small">${esc(e.message)}</div><div class="small muted">בינתיים – הביקורות המלאות בעברית:</div>${links}`;
  }
}

// ---------- מועדפים ----------
const FAV_TYPES = { place: ['📍', 'מקומות'], hotel: ['🏨', 'מלונות'], flight: ['✈️', 'טיסות'], food: ['🍽️', 'אוכל'], cafe: ['☕', 'אוכל'], market: ['🧺', 'שווקים'], wine: ['🍷', 'יין'], nature: ['🏞️', 'מקומות'], history: ['🏛️', 'מקומות'], family: ['👨‍👩‍👧', 'מקומות'], shopping: ['🛍️', 'קניות'] };
const favIco = type => (FAV_TYPES[type] || ['⭐'])[0];
const favReg = new Map();
function favBtn(item, big = false) {
  favReg.set(item.id, item);
  const on = (curTrip()?.favorites || []).some(f => f.id === item.id);
  return `<button class="${big ? 'btn sm' : 'mini'} fav ${on ? 'on' : ''}" data-fav="${esc(item.id)}" aria-label="${on ? 'הסר ממועדפים' : 'הוסף למועדפים'}" title="מועדפים">${on ? '❤️' : '🤍'}${big ? (on ? ' במועדפים' : ' למועדפים') : ''}</button>`;
}
function toggleFav(id) {
  const item = favReg.get(id); const t = curTrip(); if (!t) return;
  const exists = (t.favorites || []).some(f => f.id === id);
  mutate(x => { x.favorites ||= []; if (exists) x.favorites = x.favorites.filter(f => f.id !== id); else if (item) x.favorites.unshift({ ...item, addedAt: Date.now() }); });
  toast(exists ? 'הוסר מהמועדפים' : '❤️ נוסף למועדפים');
}
function favToItinerary(t, f) {
  if (!f) return;
  const days = tripDays(t);
  openForm({
    title: `➕ ${f.name} למסלול`,
    fields: [{ key: 'day', label: 'באיזה יום', type: 'select', options: days.map((d, i) => [d, `יום ${i + 1} · ${fmtDate(d)}`]) }, { key: 'time', label: 'שעה', type: 'time' }],
    values: { day: days[0], time: '10:00' },
    onSave: v => mutate(x => { x.days[v.day] ||= { title: '', notes: '', stops: [] }; x.days[v.day].stops.push({ id: uid(), time: v.time, title: f.name, place: f.place || f.name, notes: f.note || '' }); sortStops(x.days[v.day].stops); }).then(() => toast('נוסף למסלול'))
  });
}
function renderFavorites(t) {
  const favs = t.favorites || [];
  if (!favs.length) return `<div class="section"><div class="section-head"><h2>❤️ מועדפים</h2></div><div class="card small muted">לחצו 🤍 על מקום, מלון, טיסה או מסעדה במדריך ובחיפוש, והם יחכו לכם כאן.</div></div>`;
  const groups = [...new Set(favs.map(f => (FAV_TYPES[f.type] || ['', 'אחר'])[1]))];
  const cur = state.favFilter && groups.includes(state.favFilter) ? state.favFilter : 'הכל';
  const shown = cur === 'הכל' ? favs : favs.filter(f => (FAV_TYPES[f.type] || ['', 'אחר'])[1] === cur);
  return `<div class="section"><div class="section-head"><h2>❤️ מועדפים <span class="small muted">(${favs.length})</span></h2></div>
    ${groups.length > 1 ? `<div class="row wrap" style="margin-bottom:8px">${['הכל', ...groups].map(g => `<button class="chipbtn ${g === cur ? 'on' : ''}" data-favfilter="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}
    <div class="card"><ul class="list">${shown.map(f => `<li class="li"><div class="ico">${favIco(f.type)}</div><div class="main"><div class="t">${esc(f.name)}</div>${f.note ? `<div class="small muted">${esc(f.note)}</div>` : ''}
      <div class="row wrap" style="margin-top:6px">${f.lat != null ? `<a class="btn sm" href="${navUrl(f.lat, f.lon)}" target="_blank" rel="noopener">🧭 ניווט</a>${rideBtns(f.lat, f.lon, f.name, true)}` : ''}${f.link ? `<a class="btn sm" href="${esc(heLink(f.link).url)}" target="_blank" rel="noopener">↗ פתח</a>` : ''}${f.type !== 'flight' ? `<button class="btn sm" data-favplan="${esc(f.id)}">➕ למסלול</button>${revBtn(f.place || f.name, t.city || '')}` : ''}<button class="mini" data-favrm="${esc(f.id)}" aria-label="הסר">✕</button></div></div></li>`).join('')}</ul></div></div>`;
}

// =====================================================================
//  נסיעות: Uber · Lyft · Waze
// =====================================================================
const uberUrl = (lat, lon, name = '') => `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${lat}&dropoff[longitude]=${lon}&dropoff[nickname]=${encodeURIComponent(name)}`;
const lyftUrl = (lat, lon) => `https://lyft.com/ride?id=lyft&destination[latitude]=${lat}&destination[longitude]=${lon}`;
const wazeUrl = (lat, lon) => `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
const rideBtns = (lat, lon, name, compact = false) => lat == null ? '' : `<span class="rides">
  <a class="${compact ? 'mini' : 'btn sm'}" href="${uberUrl(lat, lon, name)}" target="_blank" rel="noopener" title="הזמן Uber">🚕${compact ? '' : ' Uber'}</a>
  <a class="${compact ? 'mini' : 'btn sm'}" href="${lyftUrl(lat, lon)}" target="_blank" rel="noopener" title="הזמן Lyft">🚗${compact ? '' : ' Lyft'}</a>
  <a class="${compact ? 'mini' : 'btn sm'}" href="${wazeUrl(lat, lon)}" target="_blank" rel="noopener" title="נווט ב-Waze">🧭${compact ? '' : ' Waze'}</a></span>`;

// =====================================================================
//  מיקומים, זמני נסיעה ומפה
// =====================================================================
const geoCache = (() => { try { return JSON.parse(localStorage.getItem('tt-geo')) || {}; } catch (e) { return {}; } })();
const saveGeo = () => { try { localStorage.setItem('tt-geo', JSON.stringify(geoCache)); } catch (e) { } };
function coordsFor(s) {
  if (!s) return null;
  if (s.lat != null && s.lon != null) return { lat: +s.lat, lon: +s.lon };
  const g = GUIDE[s.place]; if (g) return { lat: g.lat, lon: g.lon };
  if (s.place === 'SFO' || /^SFO\b/.test(s.place || '')) return { lat: 37.6213, lon: -122.379 };
  return geoCache[s.place] || null;
}
let geoBusy = false;
const geoFail = new Set();
async function ensureCoords(t) {
  if (geoBusy) return; geoBusy = true;
  const missing = [...new Set(tripDays(t).flatMap(d => (t.days[d]?.stops || []).filter(s => s.place && !coordsFor(s) && !geoFail.has(s.place)).map(s => s.place)))];
  let changed = false;
  for (const q of missing.slice(0, 15)) {
    try { const c = await geocode(q + (t.city ? ', ' + t.city.split(',').slice(-1)[0] : '')) || await geocode(q); if (c) { geoCache[q] = c; changed = true; } else geoFail.add(q); } catch (e) { geoFail.add(q); }
    await new Promise(r => setTimeout(r, 1100)); // מדיניות Nominatim: בקשה לשנייה
  }
  geoBusy = false; if (changed) { saveGeo(); render(); }
}
const routeCache = {};
async function dayRoute(t, d) {
  const pts = (t.days[d]?.stops || []).map(coordsFor);
  if (pts.length < 2 || pts.some(p => !p)) return null;
  const key = d + ':' + pts.map(p => p.lat.toFixed(4) + ',' + p.lon.toFixed(4)).join(';');
  if (routeCache[key] !== undefined) return routeCache[key];
  routeCache[key] = null;
  try {
    const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${pts.map(p => p.lon + ',' + p.lat).join(';')}?overview=full&geometries=geojson`)).json();
    const r = j.routes?.[0]; if (r) routeCache[key] = { legs: r.legs.map(l => ({ min: Math.round(l.duration / 60), km: Math.round(l.distance / 1000) })), geo: r.geometry.coordinates.map(([lo, la]) => [la, lo]), min: Math.round(r.duration / 60), km: Math.round(r.distance / 1000) };
  } catch (e) { }
  return routeCache[key];
}
function routeFor(t, d) {
  const pts = (t.days[d]?.stops || []).map(coordsFor);
  if (pts.length < 2 || pts.some(p => !p)) return null;
  return routeCache[d + ':' + pts.map(p => p.lat.toFixed(4) + ',' + p.lon.toFixed(4)).join(';')] || null;
}
let routesBusy = false;
async function loadRoutes(t) {
  if (routesBusy) return; routesBusy = true; let any = false;
  for (const d of tripDays(t)) { if (!routeFor(t, d)) { const r = await dayRoute(t, d); if (r) any = true; } }
  routesBusy = false; if (any) render();
}
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} ש׳ ${m % 60 ? (m % 60) + ' ד׳' : ''}` : `${m} ד׳`;

// Leaflet – נטען רק כשפותחים מפה
let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return leafletP ||= new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = () => res(window.L); s.onerror = () => rej(new Error('המפה לא נטענה')); document.head.appendChild(s);
  });
}
const DAY_COLORS = ['#C9AE7C', '#7CB518', '#4FA3E0', '#E0614F', '#B07CE0', '#E8B33C', '#3CC6B5', '#E07CB0'];
let mapObj = null;
async function drawMap(t) {
  const el = $('#tripMap'); if (!el) return;
  let L; try { L = await loadLeaflet(); } catch (e) { el.innerHTML = '<div class="empty">המפה לא זמינה כרגע (אין חיבור?)</div>'; return; }
  if (mapObj) { mapObj.remove(); mapObj = null; }
  el.innerHTML = '';
  mapObj = L.map(el, { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(mapObj);
  const bounds = []; const days = tripDays(t); const only = state.mapDay;
  days.forEach((d, i) => {
    if (only && only !== d) return;
    const col = DAY_COLORS[i % DAY_COLORS.length];
    const stops = t.days[d]?.stops || [];
    stops.forEach((s, si) => {
      const c = coordsFor(s); if (!c) return; bounds.push([c.lat, c.lon]);
      L.marker([c.lat, c.lon], { icon: L.divIcon({ className: 'pin', html: `<span style="background:${col}">${i + 1}.${si + 1}</span>`, iconSize: [34, 22] }) })
        .addTo(mapObj).bindPopup(`<b>${esc(s.title)}</b><br>${esc(s.time || '')} · יום ${i + 1}<br><a href="${navUrl(c.lat, c.lon)}" target="_blank">ניווט</a> · <a href="${uberUrl(c.lat, c.lon, s.title)}" target="_blank">Uber</a> · <a href="${lyftUrl(c.lat, c.lon)}" target="_blank">Lyft</a>`);
    });
    const r = routeFor(t, d);
    const line = r ? r.geo : stops.map(coordsFor).filter(Boolean).map(c => [c.lat, c.lon]);
    if (line.length > 1) L.polyline(line, { color: col, weight: 4, opacity: .85, dashArray: r ? null : '6 6' }).addTo(mapObj);
  });
  if (!only) (t.favorites || []).filter(f => f.lat != null).forEach(f => { bounds.push([f.lat, f.lon]); L.marker([f.lat, f.lon], { icon: L.divIcon({ className: 'pin fav', html: '<span>❤️</span>', iconSize: [24, 24] }) }).addTo(mapObj).bindPopup(`<b>${esc(f.name)}</b><br><a href="${navUrl(f.lat, f.lon)}" target="_blank">ניווט</a>`); });
  if (bounds.length) mapObj.fitBounds(bounds, { padding: [30, 30] }); else mapObj.setView([36.6, -121.9], 9);
}

// =====================================================================
//  מזג אוויר לכל יום (Open-Meteo, חינם)
// =====================================================================
const WMO = c => c == null ? '' : c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '🌫️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '🌨️' : c <= 82 ? '🌧️' : c <= 86 ? '🌨️' : '⛈️';
const wxState = {};
async function loadWeather(t) {
  const key = t.id + t.start + t.end; if (wxState[key]) return;
  wxState[key] = { loading: true };
  const first = tripDays(t).flatMap(d => (t.days[d]?.stops || []).map(coordsFor)).find(Boolean) || (t.city ? await geocode(t.city).catch(() => null) : null);
  if (!first) { wxState[key] = { none: true }; return; }
  const today = isoDate(new Date()); const ahead = daysBetween(today, t.end);
  const daily = 'temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset';
  try {
    let url, mode;
    if (ahead <= 15 && t.end >= today) { url = `https://api.open-meteo.com/v1/forecast?latitude=${first.lat}&longitude=${first.lon}&daily=${daily},precipitation_probability_max&timezone=auto&start_date=${t.start < today ? today : t.start}&end_date=${t.end}`; mode = 'forecast'; }
    else { const ly = s => (+s.slice(0, 4) - 1) + s.slice(4); url = `https://archive-api.open-meteo.com/v1/archive?latitude=${first.lat}&longitude=${first.lon}&daily=${daily},precipitation_sum&timezone=auto&start_date=${ly(t.start)}&end_date=${ly(t.end)}`; mode = 'history'; }
    const j = await (await fetch(url)).json(); const D = j.daily || {}; const days = {};
    (D.time || []).forEach((tm, i) => { const k = mode === 'history' ? (+tm.slice(0, 4) + 1) + tm.slice(4) : tm; days[k] = { tmax: Math.round(D.temperature_2m_max[i]), tmin: Math.round(D.temperature_2m_min[i]), code: D.weathercode[i], sunset: (D.sunset[i] || '').slice(11, 16), sunrise: (D.sunrise[i] || '').slice(11, 16), rain: mode === 'forecast' ? D.precipitation_probability_max?.[i] : D.precipitation_sum?.[i] }; });
    wxState[key] = { mode, days };
  } catch (e) { wxState[key] = { none: true }; }
  render();
}
const wxFor = (t, d) => wxState[t.id + t.start + t.end]?.days?.[d];
const wxMode = t => wxState[t.id + t.start + t.end]?.mode;
const wxChip = (t, d) => { const w = wxFor(t, d); if (!w) return ''; const rain = wxMode(t) === 'forecast' ? (w.rain >= 30 ? ` · ☔ ${w.rain}%` : '') : (w.rain >= 2 ? ` · ☔ ${Math.round(w.rain)} מ״מ` : ''); return `<span class="chip wx" title="${wxMode(t) === 'history' ? 'לפי אותם תאריכים בשנה שעברה' : 'תחזית'}">${WMO(w.code)} ${w.tmax}°/${w.tmin}°${rain} · 🌅 ${w.sunset}</span>`; };

// =====================================================================
//  חלוקת הוצאות בין הנוסעים
// =====================================================================
function splitBalances(t) {
  const names = (t.travelersList || []).map(x => x.name).filter(Boolean);
  if (names.length < 2) return null;
  const paid = Object.fromEntries(names.map(n => [n, 0])); let total = 0;
  const add = (who, ils, forWhom) => { total += ils; if (who && paid[who] != null) paid[who] += ils; const share = forWhom && forWhom !== 'all' ? [forWhom] : names; share.forEach(n => owes[n] += ils / share.length); };
  const owes = Object.fromEntries(names.map(n => [n, 0]));
  t.expenses.forEach(e => add(e.payer, toILS(t, e.amount, e.currency), e.split));
  t.bookings.filter(b => b.status === 'paid').forEach(b => add(b.payer, toILS(t, b.price, b.currency), b.split));
  const bal = names.map(n => ({ name: n, paid: paid[n], owes: owes[n], net: paid[n] - owes[n] }));
  // סגירת חובות במינימום העברות
  const cred = bal.filter(b => b.net > 1).map(b => ({ ...b })), debt = bal.filter(b => b.net < -1).map(b => ({ ...b, net: -b.net }));
  const moves = [];
  for (const d of debt) for (const c of cred) { if (d.net < 1) break; const x = Math.min(d.net, c.net); if (x >= 1) { moves.push({ from: d.name, to: c.name, ils: x }); d.net -= x; c.net -= x; } }
  const unassigned = t.expenses.filter(e => !e.payer || paid[e.payer] == null).length + t.bookings.filter(b => b.status === 'paid' && (!b.payer || paid[b.payer] == null)).length;
  return { names, bal, moves, total, unassigned };
}
function renderSplit(t) {
  const s = splitBalances(t);
  if (!s) return `<div class="card section small muted">כדי לחלק הוצאות, הוסיפו שמות נוסעים בהגדרות הטיול (למשל: צחי:TLV, רחל:DFW).</div>`;
  return `<div class="card section"><h3>⚖️ מי שילם ומי חייב</h3>
    <ul class="list">${s.bal.map(b => `<li class="li"><div class="ico">👤</div><div class="main"><div class="t">${esc(b.name)}</div><div class="small muted">שילם ${fmtMoney(b.paid)} · חלקו ${fmtMoney(b.owes)}</div></div><div class="amt" style="color:${b.net >= 0 ? 'var(--green)' : 'var(--danger)'}">${b.net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(b.net))}</div></li>`).join('')}</ul>
    <div class="settle">${s.moves.length ? s.moves.map(m => `<div>💸 <b>${esc(m.from)}</b> מעביר/ה ל<b>${esc(m.to)}</b> <b dir="ltr">${fmtMoney(m.ils)}</b> <span class="muted small">(≈ $${Math.round(m.ils / (t.rates?.USD || 3.1))})</span></div>`).join('') : '<div>✅ אתם מאוזנים</div>'}</div>
    ${s.unassigned ? `<div class="small" style="color:var(--warn);margin-top:6px">⚠️ ${s.unassigned} הוצאות בלי ״מי שילם״ – לא נכללות בחלוקה. לחצו עליהן כדי לעדכן.</div>` : ''}
    <div class="small muted" style="margin-top:6px">כל הוצאה מתחלקת שווה, אלא אם בחרתם ״עבור״ נוסע מסוים.</div></div>`;
}

// =====================================================================
//  התראות מחיר
// =====================================================================
const WATCH_EVERY = 6 * 3600e3;
function watchKey(kind, o) { return kind === 'flight' ? `f:${o.owner}|${o.slices?.[0]?.departing_at?.slice(0, 16) || ''}` : `h:${o.name}`; }
function watchBtn(kind, o, query) {
  const t = curTrip(); const k = watchKey(kind, o); const on = (t?.watch || []).some(w => w.key === k);
  favReg.set('w:' + k, { kind, key: k, label: kind === 'flight' ? `${o.owner} · ${query.from}→${query.to}` : o.name, query, ils: Math.round(o.ils ?? o._ils ?? toILS(t, o.total || o.perNight, o.currency)), currency: o.currency, total: o.total || o.perNight });
  return `<button class="btn sm ${on ? 'green' : ''}" data-watch="${esc('w:' + k)}" title="התראת מחיר">${on ? '🔔 במעקב' : '🔔 עקוב'}</button>`;
}
async function toggleWatch(id) {
  const it = favReg.get(id); const t = curTrip(); if (!it || !t) return;
  const on = (t.watch || []).some(w => w.key === it.key);
  if (!on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { } }
  await mutate(x => { x.watch ||= []; if (on) x.watch = x.watch.filter(w => w.key !== it.key); else x.watch.push({ id: uid(), kind: it.kind, key: it.key, label: it.label, query: it.query, base: it.ils, last: it.ils, history: [{ t: Date.now(), ils: it.ils }], checked: Date.now() }); });
  toast(on ? 'הוסר מהמעקב' : '🔔 נעקוב ונתריע כשהמחיר יורד');
}
function notify(title, body) { try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'logo.svg' }); } catch (e) { } toast(title + ' – ' + body); }
// ---- בדיקה חיה: כל מנוע בנפרד, עם חיווי, ואז פתיחת התוצאות ----
const WATCH_PROVIDERS = { flight: ['Duffel', 'Google Flights', 'Aviasales'], hotel: ['Google Hotels'] };
const PROV_ICO = { 'Duffel': '🛫', 'Google Flights': '🟢', 'Aviasales': '🔶', 'Google Hotels': '🏨' };
const WATCH_INTERVALS = [[0, 'כבוי'], [10, '10 דק׳'], [15, 'רבע שעה'], [30, 'חצי שעה'], [60, 'שעה'], [180, '3 שעות'], [360, '6 שעות']];
const watchRun = { busy: false, done: false, rows: [], last: 0 };
const watchEvery = t => (t?.watchEvery ?? 15);
const everyLabel = m => (WATCH_INTERVALS.find(x => x[0] === m) || [m, `${m} דק׳`])[1];
function nextCheckIn(t) {
  const ev = watchEvery(t); if (!ev || !(t?.watch || []).length) return null;
  const lastChecked = Math.max(watchRun.last, ...(t.watch || []).map(w => w.checked || 0));
  return Math.max(0, lastChecked + ev * 60e3 - Date.now());
}
const fmtLeft = ms => { const s = Math.round(ms / 1000); if (s >= 3600) { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return `${h} ש׳${m ? ' ו-' + m + ' דק׳' : ''}`; } if (s >= 60) return `${Math.ceil(s / 60)} דק׳`; return `${s} שנ׳`; };

async function checkWatches({ show = false } = {}) {
  const t = curTrip(); if (!t || watchRun.busy || !(t.watch || []).length) { if (show && watchRun.busy) openWatchPanel(); return; }
  watchRun.busy = true; watchRun.done = false; watchRun.last = Date.now();
  watchRun.rows = t.watch.map(w => ({ w, provs: (WATCH_PROVIDERS[w.kind] || []).map(name => ({ name, st: 'run', count: 0, note: '' })), results: [], out: null }));
  if (show) openWatchPanel(); else drawWatchPanel();
  const jobs = watchRun.rows.flatMap(row => row.provs.map(async pv => {
    try {
      const j = await searchAll({ kind: row.w.kind === 'flight' ? 'flights' : 'hotels', ...row.w.query, only: pv.name });
      const pr = (j.providers || [])[0] || {}; pv.st = pr.status === 'ok' ? 'ok' : pr.status === 'off' ? 'off' : 'err'; pv.count = pr.count || 0; pv.note = pr.note || '';
      row.results.push(...(j.results || []));
    } catch (e) { pv.st = 'err'; pv.note = e.message; }
    drawWatchPanel();
  }));
  await Promise.all(jobs);
  // סיכום לכל פריט במעקב
  const updates = {}; let dropped = false;
  for (const row of watchRun.rows) {
    const w = row.w; const res = row.results;
    if (!res.length) { row.out = { none: true, why: row.provs.find(p => p.note)?.note || '' }; continue; }
    let list;
    if (w.kind === 'flight') list = compareFlights(t, res).map(o => ({ key: watchKey('flight', o), name: o.owner, ils: Math.round(o.ils), ilsBag: Math.round(o.ilsBag), sub: `${(o.slices || []).map(sl => (sl.segments || []).length - 1).map(n => n === 0 ? 'ישירה' : n === 1 ? 'עצירה אחת' : n + ' עצירות').join(' / ')}${o.info?.checked ? ' · כולל מזוודה' : ''}`, link: o.link || '', src: o.source }));
    else list = res.map(o => ({ key: watchKey('hotel', o), name: o.name, ils: Math.round(toILS(t, o.total || o.perNight, o.currency)), sub: `${o.rating ? '★ ' + o.rating : ''}${o.reviews ? ' · ' + o.reviews + ' ביקורות' : ''}`, link: o.link || '', src: o.source }));
    list.sort((a, b) => a.ils - b.ils);
    const same = list.find(o => o.key === w.key);
    const cur = same ? same.ils : null; const cheapest = list[0].ils;
    updates[w.id] = { ils: cur, cheapest };
    if (cur != null && cur < w.last - 20) dropped = true;
    row.out = { cur, prev: w.last, base: w.base, cheapest, top: list.slice(0, 3), total: list.length };
  }
  if (Object.keys(updates).length) await mutate(x => (x.watch || []).forEach(w => {
    const u = updates[w.id]; if (!u) return; w.checked = Date.now(); w.cheapest = u.cheapest;
    if (u.ils != null) { if (u.ils < w.last - 20) notify('📉 המחיר ירד!', `${w.label}: ${fmtMoney(u.ils)} (היה ${fmtMoney(w.last)})`); w.last = u.ils; w.history = [...(w.history || []), { t: Date.now(), ils: u.ils }].slice(-30); }
  }));
  watchRun.busy = false; watchRun.done = true;
  if (dropped && !show) openWatchPanel(); else drawWatchPanel();
  if (!$('#watchPanel')) render();
}

function openWatchPanel() {
  let el = $('#watchPanel');
  if (!el) { el = document.createElement('div'); el.id = 'watchPanel'; el.className = 'wp-wrap'; el.innerHTML = `<div class="wp card" role="dialog" aria-label="בדיקת מחירים"><div id="wpInner"></div></div>`; document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) closeWatchPanel(); }); }
  drawWatchPanel();
}
function closeWatchPanel() { $('#watchPanel')?.remove(); render(); }
function drawWatchPanel() {
  const box = $('#wpInner'); if (!box) return; const t = curTrip(); if (!t) return;
  const R = watchRun.rows; const all = R.flatMap(r => r.provs); const doneN = all.filter(p => p.st !== 'run').length;
  const pct = all.length ? Math.round(doneN / all.length * 100) : 0;
  const head = watchRun.busy
    ? `<div class="wp-head"><div class="wp-radar"><i></i><i></i><i></i><span>🔎</span></div><div class="spacer"><b>בודק עכשיו בכל המנועים באונליין…</b><div class="small muted">${doneN}/${all.length} מנועים החזירו תשובה</div></div><button class="mini" data-wpclose aria-label="סגירה">✕</button></div>
       <div class="bar gold wp-bar"><i style="width:${Math.max(6, pct)}%"></i></div>`
    : `<div class="wp-head"><span class="wp-done">✓</span><div class="spacer"><b>הבדיקה הסתיימה</b><div class="small muted">נבדק עכשיו · ${new Date(watchRun.last).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div></div><button class="mini" data-wpclose aria-label="סגירה">✕</button></div>`;
  const stIco = { run: '<span class="spin"></span>', ok: '✓', off: '○', err: '⚠' };
  const stTxt = p => p.st === 'run' ? 'בודק…' : p.st === 'ok' ? `${p.count} תוצאות` : p.st === 'off' ? 'לא מחובר' : 'לא זמין';
  const body = R.map(r => {
    const w = r.w; const o = r.out;
    const provs = `<div class="wp-provs">${r.provs.map(p => `<span class="wp-prov ${p.st}" title="${esc(p.note)}">${stIco[p.st]} ${PROV_ICO[p.name] || ''} ${esc(p.name)} <small>${stTxt(p)}</small></span>`).join('')}</div>`;
    let res = '';
    if (o?.none) {
      const links = (w.kind === 'flight' ? flightLinks(w.query) : hubLinks('hotels', w.query)).slice(0, 3);
      res = `<div class="wp-none">לא התקבלו מחירים חיים${/פריסה|Netlify/.test(o.why) ? ' – החיפוש החי יעבוד אחרי פריסה ל-Netlify עם מפתחות הספקים' : o.why ? ' – ' + esc(o.why) : ''}.<div class="row wrap" style="margin-top:8px">${links.map(l => `<a class="btn sm" href="${esc(heLink(l.url).url)}" target="_blank" rel="noopener">${l.ico} ${esc(l.name)} ↗</a>`).join('')}</div></div>`;
    } else if (o) {
      const d = o.cur != null ? o.cur - o.prev : null;
      const verdict = o.cur == null ? `<span class="chip">ההצעה המקורית לא נמצאה עכשיו</span>` : d < -20 ? `<span class="chip ok">📉 ירד ב-${fmtMoney(-d)}</span>` : d > 20 ? `<span class="chip warn">📈 עלה ב-${fmtMoney(d)}</span>` : `<span class="chip">ללא שינוי</span>`;
      res = `<div class="wp-price"><div><div class="small muted">המחיר שלך עכשיו</div><b>${o.cur != null ? fmtMoney(o.cur) : '—'}</b> ${verdict}</div>
          <div class="small muted" style="text-align:end">התחלה ${fmtMoney(o.base)}<br>הזול בשוק <b style="color:var(--green)">${fmtMoney(o.cheapest)}</b></div></div>
        <ol class="wp-top">${o.top.map((x, i) => `<li><span class="wp-rank">${i === 0 ? '💰' : i + 1}</span><div class="spacer"><b>${esc(x.name)}</b><div class="small muted">${esc(x.sub)}${x.src ? ' · ' + esc(x.src) : ''}</div></div><b dir="ltr">${fmtMoney(x.ils)}</b>${x.link ? `<a class="mini" href="${esc(heLink(x.link).url)}" target="_blank" rel="noopener" aria-label="פתח">↗</a>` : ''}</li>`).join('')}</ol>
        <button class="btn sm" data-wpall="${w.id}" style="width:100%">🔎 כל ${o.total} התוצאות בהשוואה המלאה</button>`;
    }
    return `<div class="wp-item"><div class="row"><span>${w.kind === 'flight' ? '✈️' : '🏨'}</span><b class="spacer">${esc(w.label)}</b></div>${provs}${res}</div>`;
  }).join('');
  const ev = watchEvery(t); const left = nextCheckIn(t);
  const foot = `<div class="wp-foot"><div class="small muted" style="margin-bottom:6px">🔁 בדיקה אוטומטית ${ev ? `כל <b>${everyLabel(ev)}</b>${left != null && !watchRun.busy ? ` · הבאה בעוד <b id="wpLeft">${fmtLeft(left)}</b>` : ''}` : 'כבויה'}</div>
    <div class="wp-every">${WATCH_INTERVALS.map(([m, l]) => `<button class="chip ${m === ev ? 'on' : ''}" data-wevery="${m}">${l}</button>`).join('')}<label class="chip wp-custom">אחר <input type="number" min="5" max="1440" step="5" inputmode="numeric" placeholder="דק׳" data-wcustom value="${WATCH_INTERVALS.some(x => x[0] === ev) ? '' : ev}"></label></div>
    ${watchRun.busy ? '' : `<button class="btn green" data-wpagain style="width:100%;margin-top:10px">🔄 בדוק שוב עכשיו</button>`}</div>`;
  box.innerHTML = head + `<div class="wp-body">${body}</div>` + foot;
  bindWatchControls(box);
  box.querySelectorAll('[data-wpclose]').forEach(b => b.onclick = closeWatchPanel);
  box.querySelector('[data-wpagain]')?.addEventListener('click', () => checkWatches({ show: true }));
  box.querySelectorAll('[data-wpall]').forEach(b => b.onclick = () => {
    const w = curTrip().watch.find(x => x.id === b.dataset.wpall); if (!w) return; closeWatchPanel();
    if (w.kind === 'flight') { hubState.kind = 'flights'; flightState.form = { ...defaultFlightForm(curTrip()), ...w.query }; go(`#/trip/${state.tripId}/search`); liveFlightSearch().then(() => $('#liveBox')?.scrollIntoView({ behavior: 'smooth' })); }
    else { hubState.kind = 'hotels'; hubState.forms.hotels = { ...(hubState.forms.hotels || {}), ...w.query }; go(`#/trip/${state.tripId}/search`); setTimeout(() => $('#hubLive')?.click(), 80); }
  });
}
function bindWatchControls(root) {
  const setEvery = async m => { m = Math.max(0, Math.min(1440, Math.round(+m || 0))); if (m && m < 5) m = 5; await mutate(x => { x.watchEvery = m; }); toast(m ? `🔁 בדיקה אוטומטית כל ${everyLabel(m)}` : 'בדיקה אוטומטית כבויה'); drawWatchPanel(); };
  root.querySelectorAll('[data-wevery]').forEach(b => b.onclick = () => setEvery(+b.dataset.wevery));
  root.querySelectorAll('[data-wcustom]').forEach(i => i.onchange = () => i.value && setEvery(i.value));
}
// טיימר: בדיקה אוטומטית לפי המרווח שנבחר + ספירה לאחור
setInterval(() => {
  const t = curTrip(); if (!t) return;
  const left = nextCheckIn(t);
  if (left != null) { const txt = fmtLeft(left); $$('#wpLeft,#wNext').forEach(e => e.textContent = txt); }
  if (left === 0 && !watchRun.busy && Date.now() - watchRun.last > 60e3) checkWatches({ show: false });
}, 1000);
const spark = h => { if (!h || h.length < 2) return ''; const v = h.map(x => x.ils), mn = Math.min(...v), mx = Math.max(...v), W = 80, H = 22; const pts = v.map((y, i) => `${(i / (v.length - 1)) * W},${H - (mx === mn ? H / 2 : ((y - mn) / (mx - mn)) * (H - 4) + 2)}`).join(' '); return `<svg width="${W}" height="${H}" class="spark"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`; };
function renderWatches(t) {
  const ws = t.watch || []; if (!ws.length) return '';
  return `<div class="card watchbox"><div class="row"><b class="spacer">🔔 מחירים במעקב (${ws.length})</b><button class="btn sm green" id="checkNow">${watchRun.busy ? '<span class="spin"></span> בודק…' : '🔄 בדוק עכשיו'}</button></div>
    <ul class="list">${ws.map(w => { const d = w.last - w.base; return `<li class="li"><div class="ico">${w.kind === 'flight' ? '✈️' : '🏨'}</div><div class="main"><div class="t">${esc(w.label)}</div>
      <div class="small muted">התחלה ${fmtMoney(w.base)} · עכשיו <b style="color:${d < 0 ? 'var(--green)' : d > 0 ? 'var(--danger)' : 'inherit'}">${fmtMoney(w.last)}</b>${d ? ` (${d < 0 ? '↓' : '↑'}${fmtMoney(Math.abs(d))})` : ''}${w.cheapest && w.cheapest < w.last ? ` · הזול בשוק ${fmtMoney(w.cheapest)}` : ''} · נבדק ${w.checked ? new Date(w.checked).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div></div>
      <span class="${d <= 0 ? 'yes' : 'no'}">${spark(w.history)}</span><button class="mini" data-unwatch="${w.id}" aria-label="הסר">✕</button></li>`; }).join('')}</ul>
    <div class="wp-foot" style="border:0;padding:8px 0 0"><div class="small muted" style="margin-bottom:6px">🔁 בדיקה אוטומטית ${watchEvery(t) ? `כל <b>${everyLabel(watchEvery(t))}</b> כשהאפליקציה פתוחה · הבאה בעוד <b id="wNext">${fmtLeft(nextCheckIn(t) || 0)}</b>` : 'כבויה'} · התראה כשמחיר יורד</div>
    <div class="wp-every">${WATCH_INTERVALS.map(([m, l]) => `<button class="chip ${m === watchEvery(t) ? 'on' : ''}" data-wevery="${m}">${l}</button>`).join('')}<label class="chip wp-custom">אחר <input type="number" min="5" max="1440" step="5" inputmode="numeric" placeholder="דק׳" data-wcustom value="${WATCH_INTERVALS.some(x => x[0] === watchEvery(t)) ? '' : watchEvery(t)}"></label></div></div></div>`;
}

// =====================================================================
//  ייבוא אישור הזמנה מהמייל (הדבקת טקסט)
// =====================================================================
const PROVIDERS_RX = [['KLM', 'flight'], ['El Al', 'flight'], ['אל על', 'flight'], ['United', 'flight'], ['Delta', 'flight'], ['American Airlines', 'flight'], ['British Airways', 'flight'], ['Lufthansa', 'flight'], ['Swiss', 'flight'], ['Frontier', 'flight'], ['Alaska', 'flight'], ['ITA', 'flight'], ['Iberia', 'flight'], ['Kiwi.com', 'flight'], ['Booking.com', 'hotel'], ['Expedia', 'hotel'], ['Hotels.com', 'hotel'], ['Agoda', 'hotel'], ['Airbnb', 'hotel'], ['Marriott', 'hotel'], ['Hilton', 'hotel'], ['Hyatt', 'hotel'], ['Hertz', 'car'], ['Avis', 'car'], ['Enterprise', 'car'], ['Budget', 'car'], ['Sixt', 'car'], ['Alamo', 'car'], ['National', 'car'], ['DiscoverCars', 'car'], ['Rentalcars', 'car'], ['GetYourGuide', 'activity'], ['Viator', 'activity'], ['OpenTable', 'restaurant']];
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12 };
function parseConfirmation(txt) {
  const out = { type: 'other', status: 'booked', currency: 'USD' };
  const prov = PROVIDERS_RX.find(([n]) => new RegExp(n.replace('.', '\\.'), 'i').test(txt)); if (prov) { out.provider = prov[0]; out.type = prov[1]; }
  if (!prov) out.type = /flight|טיסה|boarding|departure/i.test(txt) ? 'flight' : /hotel|מלון|check-?in|צ׳ק|צ'ק/i.test(txt) ? 'hotel' : /car rental|השכרת רכב|pick-?up/i.test(txt) ? 'car' : 'other';
  const conf = /(?:confirmation|booking|reservation|record locator|PNR|itinerary|מספר הזמנה|קוד הזמנה|אישור)\s*(?:number|code|no\.?|#|ID)?\s*[:#\-]?\s*([A-Z0-9]{5,12})\b/i.exec(txt); if (conf) out.conf = conf[1].toUpperCase();
  const dates = [];
  txt.replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (_, y, m, d) => dates.push(`${y}-${m}-${d}`));
  txt.replace(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/g, (_, d, m, y) => dates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`));
  txt.replace(/\b([A-Za-zא-ת]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/g, (_, mo, d, y) => { const m = MONTHS[mo.toLowerCase().slice(0, 3)] || MONTHS[mo]; if (m) dates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); });
  txt.replace(/\b(\d{1,2})\s+([A-Za-zא-ת]{3,9})\.?,?\s+(20\d{2})\b/g, (_, d, mo, y) => { const m = MONTHS[mo.toLowerCase().slice(0, 3)] || MONTHS[mo]; if (m) dates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); });
  const ds = [...new Set(dates)].sort(); if (ds[0]) out.start = ds[0]; if (ds.length > 1) out.end = ds.at(-1);
  const money = [...txt.matchAll(/(?:total|סה״כ|סה"כ|סך הכל|amount|price|מחיר)[^\d$€₪]{0,25}([$€₪])\s?([\d,]+(?:\.\d{2})?)|([$€₪])\s?([\d,]+(?:\.\d{2})?)/gi)].map(m => ({ cur: m[1] || m[3], v: +(m[2] || m[4]).replace(/,/g, ''), labeled: !!m[1] })).filter(x => x.v > 0);
  const pickM = money.find(m => m.labeled) || money.sort((a, b) => b.v - a.v)[0];
  if (pickM) { out.price = pickM.v; out.currency = { '$': 'USD', '€': 'EUR', '₪': 'ILS' }[pickM.cur]; }
  const subj = txt.split('\n').map(l => l.trim()).find(l => l.length > 6 && l.length < 90) || '';
  out.title = `${out.provider || bookType(out.type).name}${out.conf ? ' · ' + out.conf : ''}`;
  out.notes = subj;
  return out;
}
function openEmailImport(t) {
  openForm({
    title: '📧 ייבוא אישור הזמנה מהמייל', saveLabel: 'המשך',
    fields: [{ key: 'txt', label: 'הדביקו כאן את תוכן מייל האישור (מכל חברה, בעברית או באנגלית)', type: 'textarea', placeholder: 'Your booking is confirmed… Confirmation: ABC123…' }],
    onSave: async v => {
      if (!v.txt || v.txt.length < 20) throw new Error('הדביקו את תוכן המייל');
      const b = parseConfirmation(v.txt);
      setTimeout(() => { editBooking(t, null); setTimeout(() => { Object.entries(b).forEach(([k, val]) => { const el = $(`#modalBody [name="${k}"]`); if (el && val != null) el.value = val; }); toast('✨ זיהיתי את הפרטים – בדקו ושמרו'); }, 30); }, 30);
    }
  });
  const ta = $('#f_txt'); if (ta) ta.rows = 10;
}

// =====================================================================
//  סיכום הבוקר
// =====================================================================
function renderMorning(t) {
  const today = isoDate(new Date()); const days = tripDays(t);
  const inTrip = days.includes(today); const d = inTrip ? today : days[0]; if (!d) return '';
  const day = t.days[d] || { stops: [] }; const w = wxFor(t, d); const r = routeFor(t, d);
  const first = (day.stops || [])[0];
  const bk = t.bookings.filter(b => b.start === d || b.end === d);
  const hotelTonight = t.bookings.find(b => b.type === 'hotel' && b.start <= d && b.end > d);
  return `<div class="card morning section"><div class="row"><b class="spacer">${inTrip ? '☀️ בוקר טוב! הנה היום שלכם' : '🧳 היום הראשון בטיול'}</b><span class="small muted">${fmtDate(d)}</span></div>
    <div class="mgrid">
      ${w ? `<div><span class="big2">${WMO(w.code)}</span><div><b>${w.tmax}°/${w.tmin}°</b><div class="small muted">${wxMode(t) === 'history' ? 'ממוצע שנה שעברה' : 'תחזית'}</div></div></div>
        <div><span class="big2">🌅</span><div><b>${w.sunset}</b><div class="small muted">שקיעה – לתכנן נהיגה באור</div></div></div>` : ''}
      ${first ? `<div><span class="big2">⏰</span><div><b>${esc(first.time || '')} ${esc(first.title)}</b><div class="small muted">התחנה הראשונה</div></div></div>` : ''}
      ${r ? `<div><span class="big2">🚗</span><div><b>${fmtMin(r.min)} · ${r.km} ק״מ</b><div class="small muted">נהיגה כוללת היום</div></div></div>` : ''}
      ${hotelTonight ? `<div><span class="big2">🛏️</span><div><b>${esc(hotelTonight.title.split(' · ')[0])}</b><div class="small muted">לינה הלילה${hotelTonight.conf ? ' · #' + esc(hotelTonight.conf) : ''}</div></div></div>` : ''}
    </div>
    ${bk.length ? `<div class="small" style="margin-top:8px">🎫 היום: ${bk.map(b => esc(b.title)).join(' · ')}</div>` : ''}
    ${day.notes ? `<div class="small muted" style="margin-top:6px">💡 ${esc(day.notes)}</div>` : ''}</div>`;
}


// =====================================================================
//  השוואת תאריכים: ±3 ימים, אותו אורך טיול
// =====================================================================
const addDays = (d, n) => { const x = parseDate(d); x.setDate(x.getDate() + n); return isoDate(x); };
async function runFlex(kind) {
  const t = curTrip(); const isF = kind === 'flights';
  const base = isF ? flightState.form : hubState.forms.hotels; if (!base) return;
  const st = isF ? (flightState.flex = { loading: true, cells: [] }) : (hubState.flex = { loading: true, cells: [] });
  render();
  const shifts = [-3, -2, -1, 0, 1, 2, 3];
  const jobs = shifts.map(async n => {
    const q = isF ? { ...base, depart: addDays(base.depart, n), ret: base.ret ? addDays(base.ret, n) : '' } : { ...base, checkin: addDays(base.checkin, n), checkout: addDays(base.checkout, n) };
    try {
      const j = await searchAll({ kind: isF ? 'flights' : 'hotels', ...q });
      const res = j.results || []; if (!res.length) return { n, q, none: true };
      if (isF) {
        const list = compareFlights(t, res);
        const c = [...list].sort((a, b) => a.ils - b.ils)[0], cb = [...list].sort((a, b) => a.ilsBag - b.ilsBag)[0], v = [...list].sort((a, b) => a.value - b.value)[0];
        return { n, q, min: c.ils, minBag: cb.ilsBag, best: v.ils, owner: c.owner, bestOwner: v.owner };
      }
      const nights = Math.max(1, daysBetween(q.checkin, q.checkout));
      const ils = res.map(h => toILS(t, h.total || h.perNight * nights, h.currency)).sort((a, b) => a - b);
      return { n, q, min: ils[0], best: ils[Math.min(2, ils.length - 1)] };
    } catch (e) { return { n, q, err: e.message }; }
  });
  st.cells = await Promise.all(jobs); st.loading = false;
  if (st.cells.every(c => c.err)) st.error = st.cells[0].err;
  render(); $('#flexBox')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderFlex(kind) {
  const isF = kind === 'flights'; const F = isF ? flightState.flex : hubState.flex; if (!F) return '';
  if (F.loading) return `<div class="card empty section" id="flexBox"><span class="big">📅</span>משווה מחירים ב-7 תאריכים…</div>`;
  if (F.error) return `<div class="card section" id="flexBox"><b>השוואת תאריכים לא זמינה</b><div class="small muted">${esc(F.error)}</div></div>`;
  const ok = F.cells.filter(c => c.min != null); if (!ok.length) return '';
  const key = isF ? 'minBag' : 'min';
  const lo = Math.min(...ok.map(c => c[key])), hi = Math.max(...ok.map(c => c[key]));
  const cur = F.cells.find(c => c.n === 0);
  const bestCell = ok.reduce((a, b) => b[key] < a[key] ? b : a, ok[0]);
  const save = cur?.min != null ? cur[key] - bestCell[key] : 0;
  return `<div class="section" id="flexBox"><h2>📅 השוואת תאריכים (±3 ימים)</h2>
    <div class="small muted" style="margin-bottom:8px">${isF ? 'אותו אורך טיול · מחיר הכי זול כולל מזוודה' : 'אותו מספר לילות · המחיר הכי זול לשהייה'} · לחצו על תאריך כדי לחפש בו</div>
    <div class="flexgrid">${F.cells.map(c => { if (c.min == null) return `<div class="fcell na"><div class="fd">${fmtDate(isF ? c.q.depart : c.q.checkin)}</div><div class="fp">—</div></div>`;
      const r = hi === lo ? 0 : (c[key] - lo) / (hi - lo);
      return `<button class="fcell ${c.n === 0 ? 'cur' : ''} ${c === bestCell ? 'best' : ''}" data-flexpick="${c.n}" style="--h:${Math.round(120 - r * 120)}">
        <div class="fd">${fmtDate(isF ? c.q.depart : c.q.checkin)}</div><div class="fp" dir="ltr">${fmtMoney(c[key])}</div>
        ${isF ? `<div class="fo">${esc((c.owner || '').split(' + ')[0])}</div>` : ''}${c === bestCell ? '<div class="fb">הכי זול</div>' : c.n === 0 ? '<div class="fb">התאריך שלכם</div>' : ''}</button>`; }).join('')}</div>
    <div class="small" style="margin-top:8px">${save > 30 ? `💡 הזזה ל-${fmtDate(isF ? bestCell.q.depart : bestCell.q.checkin)} חוסכת כ-<b>${fmtMoney(save)}</b>.` : '✅ התאריכים שלכם כבר בין הזולים בשבוע.'}</div></div>`;
}


// =====================================================================
//  🤖 סוכן חכם אונליין – מכיר את כל הטיול, מחפש מחירים חיים ומוסיף למסלול
//  מנוע 1: בתוך Claude (artifact) – דרך claude.use('sample'), על חשבון הצופה
//  מנוע 2: ב-Netlify – פונקציה advisor.mjs עם ANTHROPIC_API_KEY
// =====================================================================
const AI = { mode: null, sample: null, tools: false, busy: false, ctl: null, turns: [] };
async function aiEngine() {
  if (AI.mode) return AI.mode;
  if (window.claude?.use) {
    try { const sm = await window.claude.use('sample'); if (sm) { AI.sample = sm; const lim = await sm.limits().catch(() => null); AI.tools = !!lim?.tools; return (AI.mode = 'claude'); } } catch (e) { }
  }
  return (AI.mode = 'netlify');
}
const aiKey = () => 'tt-ai-' + state.tripId;
function aiLoad() { try { AI.turns = JSON.parse(localStorage.getItem(aiKey())) || []; } catch (e) { AI.turns = []; } }
function aiSave() { try { localStorage.setItem(aiKey(), JSON.stringify(AI.turns.slice(-30))); } catch (e) { } }

function tripContext(t) {
  const tot = totals(t); const L = [];
  L.push(`היום: ${isoDate(new Date())}. טיול: "${t.name}" · ${t.destination} · ${t.start} עד ${t.end} · ${t.travelers} נוסעים.`);
  L.push('נוסעים: ' + (t.travelersList || []).map(x => `${x.name} (יוצא מ-${x.origin})`).join(', ') + (t.airport ? ` · שדה יעד ${t.airport}` : '') + (t.city ? ` · עיר בסיס ${t.city}` : ''));
  L.push(`שער: 1$=₪${t.rates?.USD || 3.1}. תקציב מתוכנן ₪${Math.round(tot.planned)}, שולם ₪${Math.round(tot.actual)}, מחויב ₪${Math.round(tot.committed)}.`);
  L.push('תקציב לפי קטגוריה: ' + CATS.map(c => `${c.name} ₪${t.budget?.[c.id] || 0} (בפועל ₪${Math.round(tot.byCat[c.id] || 0)})`).join(', '));
  L.push('מסלול:'); tripDays(t).forEach(d => { const x = t.days[d] || {}; L.push(`- ${d} ${x.title || ''}${x.notes ? ' [' + x.notes + ']' : ''}: ` + (x.stops || []).map(s => `${s.time} ${s.title}${s.place ? ' @ ' + s.place : ''}`).join(' | ')); });
  L.push('הזמנות:'); (t.bookings || []).forEach(b => L.push(`- ${bookType(b.type).name}: ${b.title} · ${b.provider || ''} · ${b.start || ''}${b.end ? '→' + b.end : ''} · ${b.price} ${b.currency} · ${STATUS[b.status]?.name || b.status}${b.notes ? ' · ' + b.notes.slice(0, 160) : ''}`));
  const open = (t.lists?.tasks || []).filter(x => !x.done).map(x => x.text); if (open.length) L.push('משימות פתוחות: ' + open.join('; '));
  if (t.favorites?.length) L.push('מועדפים: ' + t.favorites.map(f => f.name).join(', '));
  const wx = wxState[t.id + t.start + t.end]; if (wx?.days) L.push(`מזג אוויר (${wx.mode === 'forecast' ? 'תחזית' : 'אותם תאריכים בשנה שעברה'}): ` + Object.entries(wx.days).map(([d, w]) => `${d} ${w.tmax}°/${w.tmin}° שקיעה ${w.sunset}${w.rain ? (wx.mode === 'forecast' ? ' סיכוי גשם ' + w.rain + '%' : ' גשם ' + w.rain + 'מ״מ') : ''}`).join(', '));
  return L.join('\n');
}
const AI_RULES = `אתה "הסוכן החכם של Tizon Tour" – סוכן טיולים אישי, חכם וחם. ענה תמיד בעברית, קצר וברור (עד ~150 מילים אלא אם ביקשו יותר), עם רשימות קצרות כשמתאים.
יש לך את כל נתוני הטיול למטה – השתמש בהם (תאריכים, שעות, מלונות, תקציב). המלץ באופן קונקרטי: שם מקום, שעה, מחיר משוער, למה.
כשמבקשים מחירים עדכניים – השתמש בכלי search_live. כשהמשתמש מבקש להוסיף משהו – השתמש בכלים add_stop / add_task / add_expense ואמור מה הוספת. אל תוסיף בלי שביקשו.
אם כלי נכשל – אמור זאת בכנות והצע קישור חיפוש (Google Maps / Skyscanner / Booking). מחירים שאינם מהכלים – ציין שהם משוערים. אל תמציא קודי הזמנה או מחירים מדויקים.`;

function aiTools(t) {
  const sum = (j, kind) => (j.results || []).slice(0, 6).map(r => kind === 'flights'
    ? { airline: r.owner, price: r.total, currency: r.currency, stops: (r.slices || []).map(sl => (sl.segments || []).length - 1), depart: r.slices?.[0]?.departing_at, arrive: r.slices?.[0]?.arriving_at, checkedBag: r.info?.checked ?? null, source: r.source }
    : { name: r.name, price: r.total || r.perNight, currency: r.currency, rating: r.rating, reviews: r.reviews || r.count, address: r.address, open: r.openNow, link: r.link });
  const touched = msg => { aiNote(msg); };
  return [
    { name: 'search_live', description: 'חיפוש מחירים חי בכל הספקים (טיסות, מלונות, מסעדות, אטרקציות). מחזיר עד 6 תוצאות מסוכמות. לטיסות: from,to (IATA), depart, ret. למלונות: where, checkin, checkout. למסעדות/אטרקציות: where + query.',
      inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['flights', 'hotels', 'food', 'things'] }, from: { type: 'string' }, to: { type: 'string' }, depart: { type: 'string', description: 'YYYY-MM-DD' }, ret: { type: 'string' }, where: { type: 'string' }, checkin: { type: 'string' }, checkout: { type: 'string' }, query: { type: 'string' } }, required: ['kind'] },
      async execute(i) { const kind = String(i.kind); aiNote('🔎 מחפש ' + ({ flights: 'טיסות', hotels: 'מלונות', food: 'מסעדות', things: 'אטרקציות' }[kind] || '') + '…');
        const body = kind === 'flights' ? { kind, from: String(i.from || 'TLV'), to: String(i.to || t.airport || ''), depart: String(i.depart || t.start), ret: String(i.ret || ''), adults: 1, cabin: 'economy' }
          : kind === 'hotels' ? { kind, where: String(i.where || t.city), checkin: String(i.checkin || t.start), checkout: String(i.checkout || t.end), adults: t.travelers || 2, rooms: 1 }
          : { kind, where: String(i.where || t.city), q: String(i.query || '') };
        const j = await searchAll(body); return { providers: (j.providers || []).filter(p => p.status === 'ok').map(p => p.name), results: sum(j, kind) }; } },
    { name: 'add_stop', description: 'מוסיף תחנה למסלול ביום מסוים. מחזיר אישור.',
      inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD בתוך תאריכי הטיול' }, time: { type: 'string', description: 'HH:MM' }, title: { type: 'string' }, place: { type: 'string', description: 'שם מקום/כתובת באנגלית למפות' }, notes: { type: 'string' } }, required: ['date', 'title'] },
      async execute(i) { const d = String(i.date); if (!tripDays(t).includes(d)) throw new Error('התאריך מחוץ לטיול'); const st = { id: uid(), time: String(i.time || ''), title: String(i.title), place: String(i.place || ''), notes: String(i.notes || '') };
        await mutate(x => { x.days[d] = x.days[d] || { title: '', notes: '', stops: [] }; x.days[d].stops = sortStops([...(x.days[d].stops || []), st]); }); touched(`✅ נוסף למסלול: ${st.title} · ${fmtDate(d)} ${st.time}`); return 'נוסף'; } },
    { name: 'add_task', description: 'מוסיף פריט לרשימת משימות (tasks) או ציוד (packing).',
      inputSchema: { type: 'object', properties: { text: { type: 'string' }, list: { type: 'string', enum: ['tasks', 'packing'] } }, required: ['text'] },
      async execute(i) { const list = i.list === 'packing' ? 'packing' : 'tasks'; await mutate(x => { x.lists[list].push({ id: uid(), text: String(i.text), done: false }); }); touched(`✅ נוסף ל${list === 'packing' ? 'ציוד' : 'משימות'}: ${i.text}`); return 'נוסף'; } },
    { name: 'add_expense', description: 'רושם הוצאה בתקציב. cat אחד מ: ' + CATS.map(c => c.id).join(','),
      inputSchema: { type: 'object', properties: { title: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string', enum: ['USD', 'ILS', 'EUR'] }, cat: { type: 'string' }, date: { type: 'string' }, payer: { type: 'string' } }, required: ['title', 'amount'] },
      async execute(i) { const e = { id: uid(), title: String(i.title), amount: Number(i.amount) || 0, currency: ['USD', 'ILS', 'EUR'].includes(i.currency) ? i.currency : 'USD', cat: CATS.some(c => c.id === i.cat) ? i.cat : 'misc', date: String(i.date || isoDate(new Date())), payer: String(i.payer || ''), split: 'all' };
        await mutate(x => { x.expenses.push(e); }); touched(`✅ נרשמה הוצאה: ${e.title} ${fmtMoney(e.amount, e.currency)}`); return 'נרשם'; } }
  ];
}

// ---- Netlify engine: Anthropic Messages API עם לולאת כלים בצד הלקוח ----
async function aiNetlify(t, system, turns, onText) {
  const tools = aiTools(t); const msgs = turns.map(x => ({ role: x.role, content: x.content })); let out = '';
  for (let round = 0; round < 6; round++) {
    let r; try { r = await fetch('/.netlify/functions/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AI.ctl?.signal, body: JSON.stringify({ system, messages: msgs, tools: tools.map(x => ({ name: x.name, description: x.description, input_schema: x.inputSchema })) }) }); }
    catch (e) { if (e.name === 'AbortError') throw { code: 'cancelled' }; throw new Error('אין חיבור לשרת'); }
    if (r.status === 404) throw new Error('הסוכן החכם יעבוד אחרי פריסה ל-Netlify עם הפונקציה advisor ומפתח ANTHROPIC_API_KEY (הסבר ב-README), או בתוך Claude.');
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || j.error || ('שגיאה ' + r.status));
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n'); if (text) { out += (out ? '\n\n' : '') + text; onText(out); }
    const uses = (j.content || []).filter(c => c.type === 'tool_use'); if (!uses.length || j.stop_reason !== 'tool_use') return out;
    msgs.push({ role: 'assistant', content: j.content });
    const results = await Promise.all(uses.map(async u => { const tool = tools.find(x => x.name === u.name);
      try { const res = await tool.execute(u.input || {}); return { type: 'tool_result', tool_use_id: u.id, content: typeof res === 'string' ? res : JSON.stringify(res) }; }
      catch (e) { return { type: 'tool_result', tool_use_id: u.id, content: 'Error: ' + (e.message || e), is_error: true }; } }));
    msgs.push({ role: 'user', content: results });
  }
  return out;
}

async function aiAsk(text) {
  const t = curTrip(); if (!t || AI.busy || !text.trim()) return;
  AI.turns.push({ role: 'user', content: text.trim() }); aiSave();
  AI.busy = true; AI.ctl = new AbortController(); AI.notes = []; aiRender(); const live = $('#aiLive');
  const show = txt => { if (live) live.innerHTML = aiFmt(txt); aiScroll(); };
  const ctx = AI_RULES + '\n\n=== נתוני הטיול ===\n' + tripContext(t);
  const hist = AI.turns.slice(-12);
  try {
    const mode = await aiEngine(); let answer;
    if (mode === 'claude') {
      const opts = { cache: false, signal: AI.ctl.signal, onText: ({ text }) => show(text) };
      if (AI.tools) { opts.tools = aiTools(t); delete opts.cache; }
      answer = (await AI.sample([{ role: 'user', content: ctx }, ...hist], opts)).text;
    } else answer = await aiNetlify(t, ctx, hist, show);
    AI.turns.push({ role: 'assistant', content: answer || '…', notes: AI.notes });
  } catch (e) {
    const code = e?.code; const partial = e?.text;
    if (code !== 'cancelled') {
      const msg = { not_granted: 'צריך לאשר ל-Tizon Tour להשתמש ב-Claude כדי שהסוכן החכם יעבוד.', sampling_disabled: 'Claude לא זמין בחשבון הזה.', rate_limited: 'יותר מדי שאלות ברצף – נסו שוב בעוד דקה.', session_expired: 'צריך להתחבר מחדש ל-Claude.', refused: 'לא יכול לענות על זה – נסו לנסח אחרת.' }[code] || e?.message || 'משהו השתבש – נסו שוב.';
      AI.turns.push({ role: 'assistant', content: (partial ? partial + '\n\n' : '') + '⚠️ ' + msg, notes: AI.notes, err: true });
    } else if (partial) AI.turns.push({ role: 'assistant', content: partial + ' …', notes: AI.notes });
  } finally { AI.busy = false; AI.ctl = null; aiSave(); aiRender(); }
}
function aiNote(m) { (AI.notes = AI.notes || []).push(m); const el = $('#aiNotes'); if (el) el.innerHTML = AI.notes.map(n => `<span class="chip ok">${esc(n)}</span>`).join(''); aiScroll(); }
function aiFmt(s) {
  let h = esc(s);
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, a, u) => `<a href="${heLink(u.replace(/&amp;/g, '&')).url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener">${a}</a>`);
  h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">קישור ↗</a>`);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>');
  h = h.replace(/^\s*[-•*]\s+(.+)$/gm, '<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>').replace(/<\/li>\s*\n\s*<li>/g, '</li><li>');
  return h.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>').replace(/<br>(<\/?ul>)/g, '$1').replace(/(<\/?ul>)<br>/g, '$1');
}
const aiScroll = () => { const b = $('#aiMsgs'); if (b) b.scrollTop = b.scrollHeight; };
const AI_SUGGEST = ['מה חסר לי בתכנון?', 'איפה כדאי לאכול הערב?', 'כמה נשאר בתקציב ואיפה לחסוך?', 'תכנן לי חלופה ליום גשום', 'מצא לי טיסה זולה יותר', 'מה לארוז לנובמבר בקרמל?'];
function aiRender() {
  const box = $('#aiMsgs'); if (!box) return;
  const t = curTrip();
  box.innerHTML = (AI.turns.length ? '' : `<div class="ai-hello"><b>שלום! אני הסוכן החכם שלך לטיול${t ? ' "' + esc(t.name) + '"' : ''} 👋</b><div class="small muted">מכיר את המסלול, ההזמנות והתקציב. יכול לחפש מחירים חיים, להמליץ ולהוסיף דברים למסלול.</div></div>`)
    + AI.turns.map((m, i) => `<div class="ai-msg ${m.role}${m.err ? ' err' : ''}">${m.notes?.length ? `<div class="ai-notes">${m.notes.map(n => `<span class="chip ok">${esc(n)}</span>`).join('')}</div>` : ''}<div>${m.role === 'user' ? esc(m.content) : aiFmt(m.content)}</div>${m.role === 'assistant' ? `<button class="mini" data-aisay="${i}" aria-label="הקראה">🔊</button>` : ''}</div>`).join('')
    + (AI.busy ? `<div class="ai-msg assistant"><div class="ai-notes" id="aiNotes"></div><div id="aiLive"><span class="ai-dots"><i></i><i></i><i></i></span> חושב…</div></div>` : '');
  $('#aiSug').innerHTML = AI.busy ? '' : AI_SUGGEST.map(q => `<button class="chip" data-aiq="${esc(q)}">${esc(q)}</button>`).join('');
  $('#aiSend').hidden = AI.busy; $('#aiStop').hidden = !AI.busy;
  $$('[data-aiq]').forEach(b => b.onclick = () => aiAsk(b.dataset.aiq));
  $$('[data-aisay]').forEach(b => b.onclick = () => { const m = AI.turns[+b.dataset.aisay]; stopSpeech(); speak(m.content.replace(/\*\*|[#*•]|\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, ''), 'he'); });
  aiScroll();
}
function aiOpen() {
  const p = $('#aiPanel'); aiLoad(); p.hidden = false; document.body.classList.add('ai-open'); aiRender(); aiEngine();
  setTimeout(() => $('#aiInput')?.focus(), 60);
}
function aiClose() { $('#aiPanel').hidden = true; document.body.classList.remove('ai-open'); }
function setupAdvisor() {
  $('#aiFab').onclick = aiOpen; $('#aiClose').onclick = aiClose;
  $('#aiClear').onclick = () => { if (AI.busy) return; AI.turns = []; aiSave(); aiRender(); };
  $('#aiStop').onclick = () => AI.ctl?.abort();
  $('#aiForm').onsubmit = e => { e.preventDefault(); const i = $('#aiInput'); const v = i.value; i.value = ''; aiAsk(v); };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const mic = $('#aiMic');
  if (!SR) mic.hidden = true; else mic.onclick = () => { const r = new SR(); r.lang = 'he-IL'; r.interimResults = false; mic.classList.add('speaking');
    r.onresult = ev => { const v = ev.results[0][0].transcript; aiAsk(v); }; r.onend = () => mic.classList.remove('speaking'); r.onerror = () => { mic.classList.remove('speaking'); toast('לא הצלחתי לשמוע – נסו שוב'); }; r.start(); };
}

// ---------- bind trip ----------
function bindTrip(t) {
  $$('[data-iv]').forEach(b => b.onclick = () => { state.itinView = b.dataset.iv; render(); });
  $$('[data-mapday]').forEach(b => b.onclick = () => { state.mapDay = b.dataset.mapday || null; render(); });
  if ($('#tripMap')) drawMap(t);
  if (state.tab === 'itinerary' || state.tab === 'overview') { ensureCoords(t).then(() => loadRoutes(t)); loadRoutes(t); loadWeather(t); }
  $$('[data-watch]').forEach(b => b.onclick = e => { e.stopPropagation(); toggleWatch(b.dataset.watch); });
  $$('[data-unwatch]').forEach(b => b.onclick = () => mutate(x => { x.watch = (x.watch || []).filter(w => w.id !== b.dataset.unwatch); }));
  $('#checkNow')?.addEventListener('click', () => checkWatches({ show: true })); if ($('.watchbox')) bindWatchControls($('.watchbox'));
  $('#emailImport')?.addEventListener('click', () => openEmailImport(t));
  $$('[data-rev]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); openReviews(b.dataset.rev, b.dataset.revwhere); });
  $$('[data-fav]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); toggleFav(b.dataset.fav); });
  $$('[data-favrm]').forEach(b => b.onclick = () => mutate(x => { x.favorites = (x.favorites || []).filter(f => f.id !== b.dataset.favrm); }));
  $$('[data-favplan]').forEach(b => b.onclick = () => favToItinerary(t, (t.favorites || []).find(f => f.id === b.dataset.favplan)));
  $$('[data-favfilter]').forEach(b => b.onclick = () => { state.favFilter = b.dataset.favfilter; render(); });
  $('#editTrip')?.addEventListener('click', () => openTripForm(t));
  $('#renameTrip')?.addEventListener('click', () => openRename(t));
  $('#printBtn')?.addEventListener('click', () => window.print());
  // itinerary
  $$('[data-addstop]').forEach(b => b.onclick = () => { const d = b.dataset.addstop; openForm({ title: 'תחנה חדשה · ' + fmtDate(d), fields: stopFields, onSave: v => mutate(x => { x.days[d] ||= { title: '', notes: '', stops: [] }; x.days[d].stops.push({ id: uid(), ...v }); sortStops(x.days[d].stops); }) }); });
  $$('[data-editstop]').forEach(b => b.onclick = () => {
    const [d, id] = b.dataset.editstop.split('|'); const s = t.days[d].stops.find(x => x.id === id);
    openForm({ title: 'עריכת תחנה', fields: stopFields, values: s, onSave: v => mutate(x => { Object.assign(x.days[d].stops.find(y => y.id === id), v); sortStops(x.days[d].stops); }), onDelete: () => mutate(x => { x.days[d].stops = x.days[d].stops.filter(y => y.id !== id); }) });
  });
  $$('[data-move]').forEach(b => b.onclick = () => {
    const [d, id, dir] = b.dataset.move.split('|');
    mutate(x => { const arr = x.days[d].stops; const i = arr.findIndex(y => y.id === id); const j = i + Number(dir); if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; const ti = arr[i].time; arr[i].time = arr[j].time; arr[j].time = ti; });
  });
  $$('[data-dayedit]').forEach(b => b.onclick = () => { const d = b.dataset.dayedit; const day = t.days[d] || {}; openForm({ title: fmtDate(d), fields: [{ key: 'title', label: 'כותרת היום' }, { key: 'notes', label: 'הערות ליום', type: 'textarea' }], values: day, onSave: v => mutate(x => { x.days[d] ||= { stops: [] }; Object.assign(x.days[d], v); }) }); });
  // budget
  $$('[data-bv]').forEach(b => b.onclick = () => { state.budgetView = b.dataset.bv; render(); });
  $('#addExpense')?.addEventListener('click', () => openForm({ title: 'הוצאה חדשה', fields: expenseFields(), values: { currency: 'USD', cat: 'food', date: isoDate(new Date()) }, onSave: v => mutate(x => x.expenses.push({ id: uid(), ...v })) }));
  $$('[data-exp]').forEach(b => b.onclick = () => { const e = t.expenses.find(x => x.id === b.dataset.exp); openForm({ title: 'עריכת הוצאה', fields: expenseFields(), values: e, onSave: v => mutate(x => Object.assign(x.expenses.find(y => y.id === e.id), v)), onDelete: () => mutate(x => { x.expenses = x.expenses.filter(y => y.id !== e.id); }) }); });
  $$('[data-cat]').forEach(b => b.onclick = () => { const c = catById(b.dataset.cat); openForm({ title: `${c.ico} ${c.name} – תקציב מתוכנן`, fields: [{ key: 'amount', label: 'סכום מתוכנן (₪)', type: 'number' }], values: { amount: t.budget[c.id] || '' }, onSave: v => mutate(x => { x.budget[c.id] = v.amount; }) }); });
  // bookings
  $('#addBooking')?.addEventListener('click', () => editBooking(t, null));
  $$('[data-book]').forEach(b => b.onclick = () => openBookingView(t, t.bookings.find(x => x.id === b.dataset.book)));
  // checklist
  $$('[data-check]').forEach(c => c.onchange = () => { const [l, id] = c.dataset.check.split('|'); mutate(x => { const it = x.lists[l].find(y => y.id === id); it.done = c.checked; }); });
  $$('[data-delitem]').forEach(b => b.onclick = e => { e.preventDefault(); const [l, id] = b.dataset.delitem.split('|'); mutate(x => { x.lists[l] = x.lists[l].filter(y => y.id !== id); }); });
  $$('[data-add]').forEach(f => f.onsubmit = e => { e.preventDefault(); const v = f.querySelector('input').value.trim(); if (!v) return; mutate(x => x.lists[f.dataset.add].push({ id: uid(), text: v, done: false })); });
  $$('[data-tpl]').forEach(b => b.onclick = () => { const l = b.dataset.tpl; const tpl = l === 'packing' ? PACK_TEMPLATE : TASK_TEMPLATE; mutate(x => { const have = new Set(x.lists[l].map(i => i.text)); tpl.filter(s => !have.has(s)).forEach(s => x.lists[l].push({ id: uid(), text: s, done: false })); }); });
  $$('[data-cleardone]').forEach(b => b.onclick = () => { const l = b.dataset.cleardone; mutate(x => { x.lists[l] = x.lists[l].filter(i => !i.done); }); });
}

// ---------- user menu ----------
function openUserMenu() {
  const S = state.store, t = curTrip(); const dlg = $('#modal');
  $('#modalTitle').textContent = 'חשבון והגדרות';
  $('#modalBody').innerHTML = `
    <div class="card">${S.mode === 'cloud' ? (S.user ? `מחובר כ-<b>${esc(S.user.email || S.user.displayName)}</b>` : 'לא מחובר') : `<b>מצב מקומי</b><div class="small muted">הנתונים נשמרים בדפדפן הזה בלבד. כדי לסנכרן בין מכשירים ולשתף – הגדר Firebase בקובץ firebase-config.js.</div>`}</div>
    ${t && S.mode === 'cloud' ? `<div class="card"><h3>שיתוף "${esc(t.name)}"</h3><div class="small muted">הזמן שותפים לפי אימייל – הם יראו ויערכו את הטיול אחרי שיתחברו.</div>
      <div class="add-inline"><input id="shareEmail" type="email" placeholder="email@example.com"><button type="button" class="btn sm primary" id="shareBtn">הזמן</button></div>
      <div class="small muted" style="margin-top:6px">${(t.inviteEmails || []).map(esc).join(', ') || 'אין עדיין שותפים'}</div></div>` : ''}
    <div class="grid">
      <button type="button" class="btn" id="verBtn">ℹ️ גרסה ${APP_VERSION} · ${APP_BUILD.split(' ')[0].split('-').reverse().join('/')} ${APP_BUILD.split(' ')[1]} · מה חדש</button>
      <div class="theme-seg">${THEMES.map(([id, ico, name]) => `<button type="button" class="btn" data-themepick="${id}">${ico} ${name.split(' ')[0]}</button>`).join('')}</div>
      <button type="button" class="btn" id="exportBtn">⬇️ ייצוא גיבוי (JSON)</button>
      <label class="btn" style="text-align:center">⬆️ ייבוא גיבוי<input type="file" id="importFile" accept="application/json" hidden></label>
      ${S.mode === 'cloud' && S.user ? `<button type="button" class="btn danger" id="logoutBtn">יציאה</button>` : ''}
    </div>`;
  $('#modalDelete').hidden = true; $('#modalSave').textContent = 'סגירה';
  $('#modalCancel').onclick = () => dlg.close(); $('#modalForm').onsubmit = e => { e.preventDefault(); dlg.close(); };
  dlg.showModal();
  $('#verBtn').onclick = () => { dlg.close(); openChangelog(); };
  $$('.theme-seg [data-themepick]').forEach(b => b.onclick = () => setTheme(b.dataset.themepick)); applyTheme();
  $('#exportBtn').onclick = () => { const blob = new Blob([JSON.stringify({ app: 'tizon-tour', v: 1, trips: state.trips }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tizon-tour-backup-${isoDate(new Date())}.json`; a.click(); };
  $('#importFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const data = JSON.parse(await f.text()); const trips = data.trips || []; for (const tr of trips) await S.saveTrip({ ...blankTrip(), ...tr }); toast(`יובאו ${trips.length} טיולים`); dlg.close(); }
    catch (err) { toast('קובץ לא תקין'); }
  };
  $('#logoutBtn')?.addEventListener('click', () => { S.signOut(); dlg.close(); go('#/'); });
  $('#shareBtn')?.addEventListener('click', async () => { const em = $('#shareEmail').value.trim().toLowerCase(); if (!em.includes('@')) return toast('אימייל לא תקין'); await mutate(x => { x.inviteEmails = [...new Set([...(x.inviteEmails || []), em])]; }); toast('השותף הוזמן'); dlg.close(); });
}


// ---------- ערכת צבע: כהה / בהירה / אוטומטית ----------
const THEMES = [['auto', '🌗', 'אוטומטי (לפי המכשיר)'], ['light', '☀️', 'בהיר'], ['dark', '🌙', 'כהה']];
const themeMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
function themePref() { try { return localStorage.getItem('tt-theme') || 'auto'; } catch (e) { return 'auto'; } }
function applyTheme(pref = themePref()) {
  const r = document.documentElement; const light = pref === 'light' || (pref === 'auto' && !!themeMQ?.matches);
  r.dataset.theme = light ? 'light' : 'dark'; r.dataset.themePref = pref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#FAF7F1' : '#14130f');
  const b = $('#themeToggle'); if (b) { const t = THEMES.find(x => x[0] === pref) || THEMES[0]; b.textContent = t[1]; b.title = 'ערכת צבע: ' + t[2]; }
  $$('[data-themepick]').forEach(x => x.classList.toggle('active', x.dataset.themepick === pref));
}
function setTheme(pref) { try { localStorage.setItem('tt-theme', pref); } catch (e) { } applyTheme(pref); }
function openThemeMenu() {
  $('#themeMenu')?.remove();
  const m = document.createElement('div'); m.id = 'themeMenu'; m.className = 'theme-menu card';
  m.innerHTML = `<div class="small muted" style="margin-bottom:6px">ערכת צבע</div>` + THEMES.map(([id, ico, name]) => `<button data-themepick="${id}"><span>${ico}</span>${name}</button>`).join('');
  document.body.appendChild(m); applyTheme();
  m.querySelectorAll('[data-themepick]').forEach(b => b.onclick = () => { setTheme(b.dataset.themepick); toast(b.textContent.trim()); m.remove(); });
  setTimeout(() => document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', off); } }), 0);
}
themeMQ?.addEventListener?.('change', () => { if (themePref() === 'auto') applyTheme('auto'); });

// ---------- boot ----------
function onTrips(trips) { state.trips = trips; state.ready = true; render(); }
async function boot() {
  const topH = () => document.documentElement.style.setProperty('--top-h', ($('.topbar')?.offsetHeight || 61) + 'px'); topH(); window.addEventListener('resize', topH);
  const vp = $('#verPill'); if (vp) { vp.textContent = 'v' + APP_VERSION; vp.title = 'גרסה ' + APP_VERSION + ' · ' + APP_BUILD; vp.onclick = openChangelog; }
  try { const seen = localStorage.getItem('tt-ver'); if (seen && seen !== APP_VERSION) setTimeout(() => toast(`✨ עודכן לגרסה ${APP_VERSION} – לחצו על מספר הגרסה לראות מה חדש`), 1200); localStorage.setItem('tt-ver', APP_VERSION); } catch (e) { }
  applyTheme(); $('#themeToggle').onclick = e => { e.stopPropagation(); openThemeMenu(); };
  readRoute();
  $('#homeBtn').onclick = () => go('#/');
  $('#userBtn').onclick = openUserMenu;
  $$('#tabbar button').forEach(b => b.onclick = () => state.tripId && go(`#/trip/${state.tripId}/${b.dataset.tab}`));
  setupAdvisor();
  render();
  if (firebaseConfig.apiKey) {
    state.store = CloudStore;
    try { await CloudStore.init(onTrips, user => { state.ready = true; if (!user) state.trips = []; render(); }); }
    catch (e) { console.error(e); toast('Firebase לא נטען – עובר למצב מקומי'); state.store = LocalStore; await LocalStore.init(onTrips); }
  } else { state.store = LocalStore; await LocalStore.init(onTrips); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  const net = () => { document.body.classList.toggle('offline', !navigator.onLine); const p = $('#modePill'); if (p && !navigator.onLine) p.textContent = '📴 אופליין'; };
  window.addEventListener('online', () => { net(); render(); toast('🟢 חזרתם לרשת'); }); window.addEventListener('offline', () => { net(); toast('📴 אופליין – הכל שמור במכשיר'); }); net();
}
boot();
