// =====================================================================
//  Tizon Tour – בדיקת שלמות לפני כל העלאה:   node tools/check.mjs
//  1) כל טקסט עברי בממשק מתורגם ב-i18n-en.js
//  2) לכל יכולת ב-FEATURES (help.js) יש עברית+אנגלית, והאלמנט שלה קיים בקוד
//  3) מספר הגרסה עקבי: APP_VERSION = CHANGELOG אחרון = CACHE ב-sw.js
//  4) יש לפחות יכולת אחת במדריך לגרסה הנוכחית (כדי ש"מה חדש" יתעדכן)
// =====================================================================
import fs from 'fs';
const R = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const app = R('app.js'), html = R('index.html'), sw = R('sw.js');
const EN = (await import(new URL('../i18n-en.js', import.meta.url))).default;
const { FEATURES } = await import(new URL('../help.js', import.meta.url));
let errors = 0; const err = m => { errors++; console.log('❌ ' + m); }; const ok = m => console.log('✅ ' + m);
const HEB = /[֐-׿]/;
// --- 1) תרגומים חסרים ---
const clean = src => src.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n')
  .replace(/const AI_RULES = `[\s\S]*?`;/g, '').replace(/const prompt = `בנה מסלול[\s\S]*?`;/g, '')
  .replace(/\/\/[^\n'"`]*[֐-׿][^\n'"`]*$/gm, '')
  .replace(/L\('[^']*'/g, "L(''").replace(/\ben \? (['`])[^'`]*\1 : (['`])[^'`]*\2/g, "''");
const src = clean(app) + '\n' + clean(html) + '\n' + clean(R('netlify/functions/search-all.mjs')) + '\n' + clean(R('netlify/functions/advisor.mjs'));
const segs = new Set();
for (let p of src.split(/\$\{|\}|[<>]|`|'|"|\n|\|\|/)) {
  if (!HEB.test(p)) continue;
  p = p.trim().replace(/^[\s,;:·•–\-+()[\]=?/]+|[\s,;:·•\-+([\]=/]+$/g, '').trim();
  if (HEB.test(p) && p.length >= 2 && !/(=>|\.test\(|א-ת|matchAll|\\s|const |function |\w\|[\u0590-\u05FF]|[\u0590-\u05FF]\|\w|\)\[\^)/.test(p)) segs.add(p);
}
const missing = [...segs].filter(s => !(s in EN));
missing.length ? err(`${missing.length} טקסטים בלי תרגום באנגלית (להוסיף ל-i18n-en.js):\n   ` + missing.slice(0, 40).map(s => JSON.stringify(s)).join('\n   ')) : ok(`כל ${segs.size} הטקסטים מתורגמים`);
// --- 2) מדריך ---
const ids = new Set(); for (const f of FEATURES) {
  if (ids.has(f.id)) err(`id כפול במדריך: ${f.id}`); ids.add(f.id);
  if (!f.he?.[0] || !f.he?.[1] || !f.en?.[0] || !f.en?.[1]) err(`ליכולת ${f.id} חסר טקסט בעברית או באנגלית`);
  if (!/^\d+\.\d+\.\d+$/.test(f.v || '')) err(`ליכולת ${f.id} אין גרסה תקינה`);
  const tok = (f.sel || '').match(/#([\w-]+)|\[([\w-]+)|\.([\w-]+)/g) || [];
  for (const t of tok) { const k = t.replace(/^[#.[]/, ''); if (!app.includes(k) && !html.includes(k)) err(`האלמנט "${t}" של היכולת ${f.id} לא נמצא בקוד`); }
}
ok(`${FEATURES.length} יכולות במדריך נבדקו`);
// --- 3) גרסה ---
const ver = (app.match(/const APP_VERSION = '([\d.]+)'/) || [])[1];
const cl = (app.match(/const CHANGELOG = \[\s*\['([\d.]+)'/) || [])[1];
const cache = (sw.match(/tizon-tour-([\d.]+)/) || [])[1];
ver === cl && ver === cache ? ok(`גרסה ${ver} עקבית (קוד, יומן, מטמון)`) : err(`גרסה לא עקבית: APP_VERSION=${ver} CHANGELOG=${cl} sw.js=${cache}`);
const mdv = /\| \*\*([\d.]+)\*\* \|/.exec(R('CHANGELOG.md'))?.[1]; mdv === ver ? ok('CHANGELOG.md מעודכן') : err(`CHANGELOG.md בגרסה ${mdv}, הקוד בגרסה ${ver}`);
// --- 4) מה חדש ---
const cur = FEATURES.filter(f => f.v === ver).length;
cur ? ok(`${cur} יכולות במדריך שייכות לגרסה ${ver} (יופיעו ב"מה חדש")`) : console.log(`⚠️  אין במדריך יכולת לגרסה ${ver} – אם השינוי גלוי למשתמש, הוסיפו/עדכנו שורה ב-help.js`);
console.log(errors ? `\n${errors} בעיות – לתקן לפני העלאה.` : '\nהכל תקין ✓'); process.exit(errors ? 1 : 0);
