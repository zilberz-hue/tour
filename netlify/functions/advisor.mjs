// =====================================================================
//  Tizon Tour – יועץ AI. מעביר שיחה + כלים ל-Claude (Anthropic Messages API).
//  משתני סביבה ב-Netlify:
//    ANTHROPIC_API_KEY  – חובה (console.anthropic.com)
//    AI_MODEL           – אופציונלי, ברירת מחדל claude-sonnet-5-5
//  לולאת הכלים רצה בצד הלקוח (הכלים משנים את הטיול במכשיר).
// =====================================================================
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'חסר ANTHROPIC_API_KEY במשתני הסביבה של Netlify' }, 500);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const messages = Array.isArray(b.messages) ? b.messages.slice(-24) : [];
  if (!messages.length) return json({ error: 'no messages' }, 400);
  const body = { model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 1500, system: String(b.system || '').slice(0, 60000), messages };
  if (Array.isArray(b.tools) && b.tools.length) body.tools = b.tools.slice(0, 8);
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return json(j, r.status);
};
