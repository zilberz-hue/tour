// =====================================================================
//  Tizon Tour – מערכת הדרכה אינטראקטיבית (מקור אמת אחד)
//  כל יכולת במערכת = שורה אחת ב-FEATURES (עברית + אנגלית + גרסה + איפה במסך).
//  ממנה נבנים אוטומטית: הסיור המודרך, "מה חדש" לפי גרסה, מרכז העזרה, והידע של הסוכן החכם.
//  ✳️ כל שינוי במערכת → מעדכנים/מוסיפים כאן שורה (ראו CLAUDE.md). tools/check.mjs בודק שלא שכחנו.
//  route: '#/' | '#/new' | '#/profile' | 'trip:<tab>'   sel: אלמנט להדגשה   tour: חלק מהסיור המלא
// =====================================================================
export const FEATURES = [
  // ---- לוח בקרה ----
  { id: 'dash', v: '2.0.0', area: 'home', route: '#/', sel: '.dash-hero', tour: 1,
    he: ['לוח הבקרה שלך', 'כאן רואים את הטיול הבא עם ספירה לאחור, או "אתם בטיול עכשיו" כשהוא מתחיל. לחיצה פותחת אותו.'],
    en: ['Your dashboard', 'See your next trip with a countdown – or "you are on the trip now" once it starts. Tap to open it.'] },
  { id: 'newtrip', v: '2.0.0', area: 'home', route: '#/', sel: '.section-head [data-go="#/new"]', tour: 1,
    he: ['טיול חדש באשף', '4 צעדים: יעד ותאריכים, מי נוסע ומאיפה, סגנון ותקציב – ובסוף הסוכן החכם בונה טיוטת מסלול יומי.'],
    en: ['New trip wizard', '4 steps: destination and dates, who travels and from where, style and budget – then the Smart Agent drafts a day-by-day route.'] },
  { id: 'sample', v: '2.2.2', area: 'home', route: '#/', sel: '[data-sample]', tour: 0,
    he: ['טיול קרמל לדוגמה', 'טיול סן פרנסיסקו → קרמל המלא (מסלול, הזמנות, תקציב) מופיע ב"הטיולים שלי". אם הוא לא שם – כפתור 🌊 מתחת לרשימה טוען אותו בלחיצה.'],
    en: ['Carmel sample trip', 'The full San Francisco → Carmel trip (route, bookings, budget) appears in My trips. If it is missing, the 🌊 button under the list loads it in one tap.'] },
  { id: 'stats', v: '2.0.0', area: 'home', route: '#/', sel: '.dash-stats', tour: 0,
    he: ['הסטטיסטיקות שלך', 'כמה טיולים, ימים בדרכים, יעדים ותקציב כולל – מתעדכן לבד.'],
    en: ['Your stats', 'Trips, days on the road, destinations and total budget – updated automatically.'] },
  { id: 'history', v: '2.0.0', area: 'home', route: '#/', sel: '.seg [data-lf="past"]', tour: 1,
    he: ['היסטוריה, ארכיון וסל מחזור', 'טיולים שהסתיימו נשמרים בהיסטוריה. אפשר לארכב, לשכפל לשנה הבאה, ולשחזר טיול שנמחק מסל המחזור.'],
    en: ['History, archive & trash', 'Finished trips stay in History. Archive, duplicate for next year, or restore a deleted trip from the trash.'] },
  { id: 'search-trips', v: '2.0.0', area: 'home', route: '#/', sel: '#tripSearch', tour: 0,
    he: ['חיפוש טיולים', 'חיפוש לפי שם טיול, יעד או נוסע.'], en: ['Search trips', 'Search by trip name, destination or traveler.'] },
  { id: 'profile', v: '2.0.0', area: 'home', route: '#/profile', sel: '#compRows', tour: 1,
    he: ['הפרופיל שלך ומלווים קבועים', 'שם, שדה בית, מלווים קבועים (למשל רחל מ-DFW) וסגנון טיול – ימולאו אוטומטית בכל טיול חדש.'],
    en: ['Your profile & companions', 'Name, home airport, regular companions (e.g. Rachel from DFW) and travel style – auto-filled in every new trip.'] },
  { id: 'wizard', v: '2.0.0', area: 'home', route: '#/new', sel: '.wiz-steps', tour: 0,
    he: ['אשף 4 הצעדים', 'עוברים צעד-צעד; בצעד האחרון בוחרים: הסוכן בונה מסלול, העתקה מטיול קודם, או מסלול ריק.'],
    en: ['The 4-step wizard', 'Go step by step; at the end choose: the agent builds a route, copy a previous trip, or start empty.'] },
  // ---- בתוך טיול ----
  { id: 'overview', v: '1.0.0', area: 'trip', route: 'trip:overview', sel: '#tabbar [data-tab="overview"]', tour: 1,
    he: ['סקירת הטיול', 'סיכום בוקר, מזג אוויר, תקציב, הזמנות קרובות ומשימות – הכל במבט אחד.'],
    en: ['Trip overview', 'Morning summary, weather, budget, upcoming bookings and tasks – at a glance.'] },
  { id: 'monitor', v: '2.2.0', area: 'trip', route: 'trip:overview', sel: '#monitorBox', tour: 1,
    he: ['מעקב מחירים אוטומטי', 'משימה מתוזמנת בודקת טיסות ומלונות בשבילכם ומציגה כאן את המחיר העדכני, את השינוי מול מחיר הבסיס, התראות על ירידות וקישור להזמנה. ב"כללי המעקב" רואים מה נבדק ומתי מתריעים.'],
    en: ['Automatic price monitoring', 'A scheduled task checks flights and hotels for you and shows the latest price, the change vs. the baseline, drop alerts and a booking link. "Monitoring rules" shows what is checked and when you get alerted.'] },
  { id: 'rename', v: '1.0.0', area: 'trip', route: 'trip:overview', sel: '#renameTrip', tour: 0,
    he: ['שינוי שם והגדרות', '✏️ לשינוי שם הטיול, ⚙️ להגדרות: תאריכים, נוסעים ונקודות יציאה, שערי מטבע.'],
    en: ['Rename & settings', '✏️ to rename the trip, ⚙️ for settings: dates, travelers and departure points, exchange rates.'] },
  { id: 'map', v: '1.5.0', area: 'trip', route: 'trip:itinerary', sel: '[data-iv="map"]', tour: 1,
    he: ['מסלול ומפה', 'תחנות לפי ימים, זמני נסיעה, מזג אוויר, ומפה עם קו נסיעה. בכל תחנה: Uber, Lyft ו-Waze בלחיצה.'],
    en: ['Route & map', 'Stops by day, drive times, weather, and a map with the driving line. Uber, Lyft and Waze on every stop.'] },
  { id: 'guide', v: '1.3.0', area: 'trip', route: 'trip:guide', sel: '#tabbar [data-tab="guide"]', tour: 1,
    he: ['מדריך קולי', 'קריין שמספר על כל מקום, מקומות ושירותים קרובים (דלק, סופר, שירותים), וסיור אוטומטי לפי מיקום.'],
    en: ['Audio guide', 'A narrator tells you about each place, nearby places and services (gas, groceries, restrooms), and an auto tour by location.'] },
  { id: 'search', v: '1.2.0', area: 'trip', route: 'trip:search', sel: '.kinds', tour: 1,
    he: ['חיפוש והשוואה', 'טיסות, מלונות, רכב, מסעדות ואטרקציות – חיפוש חי בכל הספקים במקביל, עם "הכי זול" ו"הכי משתלם".'],
    en: ['Search & compare', 'Flights, hotels, cars, restaurants and attractions – live search across all providers, with "cheapest" and "best value".'] },
  { id: 'pricecheck', v: '1.9.0', area: 'trip', route: 'trip:search', sel: '#checkNow', tour: 1,
    he: ['בדיקת מחירים חיה', '"בדוק עכשיו" מראה כל מנוע נבדק בזמן אמת ופותח את התוצאות. בוחרים בדיקה אוטומטית כל 10 דק׳, רבע שעה ועוד.'],
    en: ['Live price check', '"Check now" shows each engine checking in real time and opens the results. Pick auto-checks every 10 min, 15 min and more.'] },
  { id: 'dates', v: '1.6.0', area: 'trip', route: 'trip:search', sel: '#flexFlights', tour: 0,
    he: ['השוואת תאריכים', 'בודק 3 ימים לפני ואחרי באותו אורך טיול, ומסמן את התאריך הזול.'],
    en: ['Compare dates', 'Checks 3 days before and after with the same trip length, and highlights the cheapest date.'] },
  { id: 'israeli', v: '1.11.0', area: 'trip', route: 'trip:search', sel: '.linkcard.il', tour: 0,
    he: ['ספקים ישראליים', 'SkyGini, SKYMAX של מקס, איסתא, גוליבר ודקה 90 – בלחיצה פרטי החיפוש מועתקים להדבקה.'],
    en: ['Israeli providers', 'SkyGini, Max SKYMAX, Issta, Gulliver and Daka 90 – one tap copies your search details to paste.'] },
  { id: 'people', v: '1.10.0', area: 'trip', route: 'trip:budget', sel: '[data-bv="people"]', tour: 1,
    he: ['עלות לכל נוסע', 'כל אחד רואה בדיוק מה הוא משלם: טיסה מנקודת היציאה שלו, חלקו במשותף והערכה – בשקלים ובדולרים.'],
    en: ['Cost per traveler', 'Everyone sees exactly what they pay: their own flight, their share of joint costs, and estimates – in ₪ and $.'] },
  { id: 'split', v: '1.5.0', area: 'trip', route: 'trip:budget', sel: '[data-bv="split"]', tour: 0,
    he: ['חלוקת הוצאות', 'מי שילם, עבור מי, ומי מעביר למי בסוף – במינימום העברות.'],
    en: ['Split expenses', 'Who paid, for whom, and who pays whom at the end – with the fewest transfers.'] },
  { id: 'email', v: '1.5.0', area: 'trip', route: 'trip:bookings', sel: '#emailImport', tour: 0,
    he: ['ייבוא מהמייל', 'מדביקים אישור הזמנה – ספק, קוד אישור, תאריכים ומחיר מזוהים לבד.'],
    en: ['Import from email', 'Paste a booking confirmation – provider, confirmation code, dates and price are detected automatically.'] },
  { id: 'log', v: '2.0.0', area: 'trip', route: 'trip:overview', sel: '.tlog', tour: 0,
    he: ['היסטוריית שינויים', 'בתחתית הסקירה: מי שינה מה ומתי, כולל פעולות של הסוכן החכם.'],
    en: ['Change history', 'At the bottom of the overview: who changed what and when, including Smart Agent actions.'] },
  { id: 'agent', v: '1.7.0', area: 'trip', route: 'trip:overview', sel: '#tabAi', tour: 1,
    he: ['הסוכן החכם', 'מכיר את כל הטיול, מחפש מחירים חיים, ממליץ ומוסיף תחנות, משימות והוצאות. אפשר לשאול אותו גם "איך עושים…" במערכת.'],
    en: ['The Smart Agent', 'Knows your whole trip, searches live prices, recommends and adds stops, tasks and expenses. You can also ask it "how do I…" in the app.'] },
  // ---- כללי ----
  { id: 'lang', v: '2.1.0', area: 'app', route: '#/', sel: '#langToggle', tour: 1,
    he: ['עברית / English', 'המערכת כולה בשתי שפות. ברירת המחדל לפי שפת המכשיר, והבחירה נשמרת.'],
    en: ['English / עברית', 'The whole app works in both languages. Default follows your device, and your choice is saved.'] },
  { id: 'theme', v: '1.8.0', area: 'app', route: '#/', sel: '#themeToggle', tour: 0,
    he: ['כהה / בהיר', 'ערכת צבע כהה, בהירה, או אוטומטית לפי המכשיר.'], en: ['Dark / light', 'Dark, light, or automatic by device.'] },
  { id: 'help', v: '2.1.0', area: 'app', route: '#/', sel: '#helpBtn', tour: 1,
    he: ['מרכז העזרה', 'כל היכולות במקום אחד, עם "הראה לי" שמסמן איפה זה במסך, סיור מלא ו"מה חדש". מתעדכן אוטומטית בכל גרסה.'],
    en: ['Help center', 'Every feature in one place, with "show me" that points to it on screen, a full tour and "what\'s new". Updated automatically with every version.'] },
  { id: 'version', v: '1.9.0', area: 'app', route: '#/', sel: '#verPill', tour: 0,
    he: ['גרסה ומה חדש', 'מספר הגרסה ליד הלוגו – לחיצה מציגה מה השתנה ומתי.'], en: ['Version & what\'s new', 'The version number next to the logo – tap to see what changed and when.'] },
  { id: 'account', v: '1.12.0', area: 'app', route: '#/', sel: '#userBtn', tour: 1,
    he: ['חשבון, ענן ושיתוף', 'התחברות, שיתוף טיול לפי מייל, מפתחות API, גיבוי וייבוא.'], en: ['Account, cloud & sharing', 'Sign-in, share a trip by email, API keys, backup and import.'] }
];
export const AREAS = { home: ['🏠', 'הטיולים והחשבון', 'Trips & account'], trip: ['🧳', 'בתוך טיול', 'Inside a trip'], app: ['⚙️', 'כללי', 'General'] };

// ---------- גרסאות ----------
export const cmpV = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
export const seenVersion = () => { try { return localStorage.getItem('tt-help-seen') || ''; } catch (e) { return ''; } };
export const markSeen = v => { try { localStorage.setItem('tt-help-seen', v); } catch (e) { } };
export const newSince = (since, cur) => FEATURES.filter(f => (!since || cmpV(f.v, since) > 0) && cmpV(f.v, cur) <= 0);

// ---------- מנוע הסיור (הדגשת אלמנט + כרטיס הסבר) ----------
let T = null;
export function startTour(steps, ctx) {
  steps = steps.filter(Boolean); if (!steps.length) return ctx.toast(ctx.en ? 'Nothing to show here yet' : 'אין מה להציג כרגע');
  endTour(); T = { steps, i: 0, ctx };
  const wrap = document.createElement('div'); wrap.id = 'tourLayer'; wrap.innerHTML = '<div class="tour-hole"></div><div class="tour-card card" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(wrap); document.body.classList.add('touring');
  wrap.addEventListener('click', e => { if (e.target === wrap) endTour(); });
  window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
  document.addEventListener('keydown', keys);
  show(0);
}
function keys(e) { if (!T) return; if (e.key === 'Escape') endTour(); if (e.key === 'ArrowLeft') move(T.ctx.en ? -1 : 1); if (e.key === 'ArrowRight') move(T.ctx.en ? 1 : -1); }
export function endTour() {
  if (!T) return; const done = T.i >= T.steps.length - 1; const ctx = T.ctx; T = null;
  document.getElementById('tourLayer')?.remove(); document.body.classList.remove('touring');
  window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('keydown', keys);
  ctx.onEnd?.(done);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function show(i) {
  if (!T) return; T.i = i; const f = T.steps[i]; const ctx = T.ctx;
  const card = document.querySelector('.tour-card'); card.innerHTML = `<div class="small muted">${ctx.en ? 'Loading…' : 'טוען…'}</div>`;
  const want = ctx.routeOf(f);
  if (want && location.hash !== want) { ctx.go(want); await sleep(250); }
  let el = null; for (let k = 0; k < 20 && T; k++) { el = f.sel ? document.querySelector(f.sel) : null; if (el && el.offsetParent !== null) break; el = null; await sleep(100); }
  if (!T || T.i !== i) return;
  T.el = el; el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); await sleep(el ? 280 : 0);
  const [title, body] = ctx.en ? f.en : f.he; const n = T.steps.length;
  card.innerHTML = `<div class="row"><span class="tour-n">${i + 1}/${n}</span><span class="spacer"></span><button class="mini" data-tour="x" aria-label="${ctx.en ? 'Close' : 'סגירה'}">✕</button></div>
    <h3 style="margin:6px 0 4px">${title}</h3><div class="tour-body">${body}</div>
    ${!el && f.sel ? `<div class="small muted" style="margin-top:6px">${ctx.en ? 'This item is not on screen right now.' : 'הפריט לא מוצג כרגע במסך.'}</div>` : ''}
    <div class="row tour-nav">${i > 0 ? `<button class="btn sm" data-tour="prev">${ctx.en ? '← Back' : '→ הקודם'}</button>` : ''}<span class="spacer"></span>
      <button class="btn sm green" data-tour="next">${i < n - 1 ? (ctx.en ? 'Next →' : 'הבא ←') : (ctx.en ? 'Done ✓' : 'סיום ✓')}</button></div>`;
  card.querySelector('[data-tour="x"]').onclick = endTour;
  card.querySelector('[data-tour="prev"]')?.addEventListener('click', () => move(-1));
  card.querySelector('[data-tour="next"]').onclick = () => (i < n - 1 ? move(1) : endTour());
  place();
}
function move(d) { if (!T) return; const j = T.i + d; if (j < 0 || j >= T.steps.length) return; show(j); }
function place() {
  if (!T) return; const hole = document.querySelector('.tour-hole'), card = document.querySelector('.tour-card'); if (!hole || !card) return;
  const el = T.el && document.contains(T.el) ? T.el : null; const vw = innerWidth, vh = innerHeight;
  if (el) { const r = el.getBoundingClientRect(), p = 6; Object.assign(hole.style, { display: 'block', left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + p * 2 + 'px', height: r.height + p * 2 + 'px' });
    const cw = Math.min(360, vw - 24); card.style.width = cw + 'px';
    const below = r.bottom + 14 + card.offsetHeight < vh; card.style.top = (below ? r.bottom + 14 : Math.max(12, r.top - 14 - card.offsetHeight)) + 'px';
    card.style.left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12) + 'px';
  } else { hole.style.display = 'none'; const cw = Math.min(380, vw - 24); card.style.width = cw + 'px'; card.style.left = (vw - cw) / 2 + 'px'; card.style.top = Math.max(20, vh / 2 - card.offsetHeight / 2) + 'px'; }
}
