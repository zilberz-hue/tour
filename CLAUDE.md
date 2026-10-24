# Tizon Tour – כללי עבודה (לכל שינוי)

אפליקציית תכנון טיולים: Vanilla JS (ES modules) + Firebase + Netlify. ממשק בעברית (RTL) עם מצב אנגלית מלא.
המשתמש (צחי) מעדיף שכל התקשורת איתו תהיה **בעברית**.

## בכל שינוי שהמשתמש רואה – חובה, באותו commit:
1. **מדריך (`help.js` → `FEATURES`)**: יכולת חדשה = שורה חדשה; יכולת שהשתנתה = עדכון הטקסט.
   כל שורה: `id`, `v` (הגרסה החדשה), `area`, `route`, `sel` (אלמנט להדגשה), `tour` (0/1), `he: [כותרת, הסבר]`, `en: [title, text]`.
   מזה נבנים אוטומטית: הסיור המודרך, "מה חדש" (לפי `v`), מרכז העזרה (`#/help`) והידע של הסוכן החכם.
2. **תרגום (`i18n-en.js`)**: כל טקסט עברי חדש בממשק → שורה במילון. טקסט דו-לשוני מפורש: `L('עברית', 'English')` / `en ? '…' : '…'`.
3. **גרסה**: `APP_VERSION` + `APP_BUILD` + שורה בראש `CHANGELOG` (app.js), `CACHE` ב-`sw.js` = `tizon-tour-<גרסה>`, שורה ב-`CHANGELOG.md`.
4. **בדיקה**: `node tools/check.mjs` חייב לעבור (תרגומים, מדריך, גרסה) לפני push.

## פריסה
- push ל-`main` ← Netlify בונה ומפרסם אוטומטית (tizon-tour.netlify.app).
- מפתח ה-Web של Firebase ציבורי; מוחרג מסורק הסודות ב-`netlify.toml`.

## מבנה
- `app.js` – כל הממשק. `i18n.js` – מנוע שפות (תרגום אוטומטי של המסך במצב אנגלית). `help.js` – מדריך וסיורים.
- `netlify/functions/search-all.mjs` – חיפוש חי בכל הספקים; `advisor.mjs` – הסוכן החכם (Claude).
- Firestore: `trips/{id}`, `users/{uid}` (פרופיל). חוקים ב-`firestore.rules`.
