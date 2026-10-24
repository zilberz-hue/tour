// =====================================================================
//  Tizon Tour – מנוע חיפוש מאוחד: פונה לכל הספקים במקביל ומאחד תוצאות
//  כל ספק מופעל רק אם יש לו מפתח במשתני הסביבה של Netlify:
//    DUFFEL_TOKEN          – טיסות חיות מ-300+ חברות (duffel.com)
//    SERPAPI_KEY           – Google Flights + Google Hotels (serpapi.com)
//    TRAVELPAYOUTS_TOKEN   – Aviasales, מאות חברות וסוכנויות (travelpayouts.com)
//    GOOGLE_PLACES_KEY     – מסעדות ואטרקציות (Google Places API)
// =====================================================================
const env = k => process.env[k];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const withTimeout = (p, ms = 28000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const iata = s => String(s || '').trim().toUpperCase().slice(0, 3);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const minToIso = m => `PT${Math.floor(m / 60)}H${m % 60}M`;
const gTime = s => s ? s.replace(' ', 'T') + ':00' : ''; // "2026-11-18 01:00" -> ISO-ish

// ---------------- flights providers ----------------
// info: מה כלול בכרטיס. true = כלול, false = לא כלול (בתשלום), null = לא ידוע
const layoversFrom = segs => segs.slice(0, -1).map((g, i) => {
  const n = segs[i + 1]; const a = new Date(g.arriving_at), d = new Date(n.departing_at);
  const minutes = Math.round((d - a) / 60000);
  return { at: g.destination?.iata_code || g.destination, city: g.destination?.city_name || '', minutes, overnight: a.getDate() !== d.getDate() && a.getHours() >= 20, airportChange: (g.destination?.iata_code || g.destination) !== (n.origin?.iata_code || n.origin) };
});
async function duffel(q) {
  const slices = [{ origin: q.from, destination: q.to, departure_date: q.depart }];
  if (q.ret) slices.push({ origin: q.to, destination: q.from, departure_date: q.ret });
  const r = await fetch('https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=20000', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('DUFFEL_TOKEN')}`, 'Duffel-Version': 'v2', 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ data: { slices, passengers: Array.from({ length: q.adults }, () => ({ type: 'adult' })), cabin_class: q.cabin, max_connections: 2 } })
  });
  const j = await r.json(); if (!r.ok) throw new Error(j.errors?.[0]?.message || `HTTP ${r.status}`);
  return (j.data?.offers || []).map(o => ({
    source: 'Duffel', owner: o.owner?.name || '', total: +o.total_amount, currency: o.total_currency, bookable: true,
    bags: (o.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages || []).filter(b => b.quantity).map(b => `${b.quantity}× ${b.type === 'checked' ? 'מזוודה' : 'תיק יד'}`).join(', '),
    info: (() => { const bg = o.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages || []; const q = t => bg.filter(b => b.type === t).reduce((a, b) => a + (b.quantity || 0), 0);
      return { personal: true, carryOn: q('carry_on') > 0, checked: q('checked'), refundable: o.conditions?.refund_before_departure ? !!o.conditions.refund_before_departure.allowed : null, changeable: o.conditions?.change_before_departure ? !!o.conditions.change_before_departure.allowed : null, fareBrand: o.slices?.[0]?.fare_brand_name || '' }; })(),
    slices: (o.slices || []).map(s => ({ duration: s.duration, departing_at: s.segments?.[0]?.departing_at, arriving_at: s.segments?.at(-1)?.arriving_at, layovers: layoversFrom(s.segments || []), segments: (s.segments || []).map(g => ({ origin: g.origin?.iata_code, destination: g.destination?.iata_code, carrier: g.marketing_carrier?.name, flight: (g.marketing_carrier?.iata_code || '') + (g.marketing_carrier_flight_number || '') })) })),
    link: ''
  }));
}
async function googleFlights(q) {
  const p = new URLSearchParams({ engine: 'google_flights', api_key: env('SERPAPI_KEY'), departure_id: q.from, arrival_id: q.to, outbound_date: q.depart, type: q.ret ? '1' : '2', adults: String(q.adults), travel_class: String({ economy: 1, premium_economy: 2, business: 3, first: 4 }[q.cabin] || 1), currency: 'USD', hl: 'en' }); // אנגלית לקריאה מדויקת של תנאי הכבודה; התצוגה באפליקציה בעברית
  if (q.ret) p.set('return_date', q.ret);
  const r = await fetch('https://serpapi.com/search.json?' + p); const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  const gLink = `https://www.google.com/travel/flights?hl=iw&q=${encodeURIComponent(`Flights from ${q.from} to ${q.to} on ${q.depart}${q.ret ? ' through ' + q.ret : ''}`)}`;
  return [...(j.best_flights || []), ...(j.other_flights || [])].filter(o => o.price).map(o => {
    const legs = o.flights || [];
    const ext = [...(o.extensions || []), ...legs.flatMap(l => l.extensions || [])].join(' | ');
    const carryOn = /carry-?on bag not included|no (overhead|carry-?on)/i.test(ext) ? false : /carry-?on bag included|1 carry-?on/i.test(ext) ? true : null;
    const chk = /(\d+) (free )?checked bags? included/i.exec(ext);
    const checked = chk ? +chk[1] : /checked bag(gage)?s? for a fee|checked bag(gage)? not included/i.test(ext) ? 0 : null;
    return {
      source: 'Google Flights', owner: [...new Set(legs.map(l => l.airline))].join(' + '), total: +o.price, currency: 'USD', bookable: false,
      bags: checked ? `${checked}× מזוודה` : '', note: q.ret ? 'מחיר הלוך-חזור · מוצג ההלוך (את החזור בוחרים באתר)' : '',
      info: { personal: true, carryOn, checked, refundable: null, changeable: null, fareBrand: /basic economy|economy light|economy basic/i.test(ext) ? 'Basic Economy' : '' },
      slices: [{ duration: minToIso(o.total_duration || 0), departing_at: gTime(legs[0]?.departure_airport?.time), arriving_at: gTime(legs.at(-1)?.arrival_airport?.time),
        layovers: (o.layovers || []).map((l, i) => ({ at: l.id, city: l.name || '', minutes: l.duration || 0, overnight: !!l.overnight, airportChange: !!(legs[i] && legs[i + 1] && legs[i].arrival_airport?.id !== legs[i + 1].departure_airport?.id) })),
        segments: legs.map(l => ({ origin: l.departure_airport?.id, destination: l.arrival_airport?.id, carrier: l.airline, flight: l.flight_number || '' })) }],
      link: gLink
    };
  });
}
async function aviasales(q) {
  const p = new URLSearchParams({ origin: q.from, destination: q.to, departure_at: q.depart, one_way: q.ret ? 'false' : 'true', currency: 'usd', limit: '30', sorting: 'price', token: env('TRAVELPAYOUTS_TOKEN') });
  if (q.ret) p.set('return_at', q.ret);
  const r = await fetch('https://api.travelpayouts.com/aviasales/v3/prices_for_dates?' + p, { headers: { 'Accept-Encoding': 'gzip, deflate' } });
  const j = await r.json(); if (!r.ok || j.success === false) throw new Error(j.error || `HTTP ${r.status}`);
  return (j.data || []).map(t => ({
    source: 'Aviasales', owner: t.airline || '', total: +t.price, currency: 'USD', bookable: false, cached: true, bags: '',
    info: { personal: true, carryOn: null, checked: null, refundable: null, changeable: null, fareBrand: '' },
    note: 'מחיר שנמצא בחיפושים אחרונים – לאמת באתר',
    slices: [{ duration: minToIso(t.duration_to || t.duration || 0), departing_at: t.departure_at, arriving_at: '', segments: [{ origin: t.origin_airport || q.from, destination: t.destination_airport || q.to, carrier: t.airline }], stops: t.transfers }],
    link: t.link ? 'https://www.aviasales.com' + t.link : ''
  }));
}

// ---------------- hotels ----------------
async function googleHotels(q) {
  const p = new URLSearchParams({ engine: 'google_hotels', api_key: env('SERPAPI_KEY'), q: q.where, check_in_date: q.checkin, check_out_date: q.checkout, adults: String(q.adults || 2), currency: 'USD', gl: 'us', hl: 'iw' });
  const r = await fetch('https://serpapi.com/search.json?' + p); const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return (j.properties || []).filter(h => h.rate_per_night?.extracted_lowest).map(h => ({
    source: 'Google Hotels', name: h.name, perNight: h.rate_per_night.extracted_lowest, total: h.total_rate?.extracted_lowest || null, currency: 'USD',
    rating: h.overall_rating || null, reviews: h.reviews || 0, stars: h.extracted_hotel_class || null, img: h.images?.[0]?.thumbnail || '',
    lat: h.gps_coordinates?.latitude, lon: h.gps_coordinates?.longitude,
    link: h.link || `https://www.google.com/travel/search?hl=iw&q=${encodeURIComponent(h.name + ' ' + q.where)}`,
    sources: (h.prices || []).map(x => `${x.source}: ${x.rate_per_night?.lowest || ''}`).slice(0, 4).join(' · ')
  }));
}

// ---------------- places (food / things) ----------------
async function googlePlaces(q, kind) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env('GOOGLE_PLACES_KEY'), 'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.googleMapsUri,places.location,places.currentOpeningHours.openNow,places.primaryTypeDisplayName,places.reviews' },
    body: JSON.stringify({ textQuery: `${kind === 'food' ? 'best restaurants' : 'top attractions'} in ${q.where}`, languageCode: 'he', maxResultCount: 20 })
  });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
  const PL = { PRICE_LEVEL_INEXPENSIVE: '$', PRICE_LEVEL_MODERATE: '$$', PRICE_LEVEL_EXPENSIVE: '$$$', PRICE_LEVEL_VERY_EXPENSIVE: '$$$$' };
  return (j.places || []).map(p => ({ source: 'Google', name: p.displayName?.text, type: p.primaryTypeDisplayName?.text || '', rating: p.rating || null, reviews: p.userRatingCount || 0, price: PL[p.priceLevel] || '', address: p.formattedAddress, openNow: p.currentOpeningHours?.openNow, topReview: ((p.reviews || []).filter(v => v.rating >= 4 && v.text?.text).sort((a, b) => b.rating - a.rating)[0]?.text?.text || '').slice(0, 180), lat: p.location?.latitude, lon: p.location?.longitude, link: p.googleMapsUri }));
}

// ---------------- reviews (best first, in Hebrew) ----------------
async function placeReviews(q) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env('GOOGLE_PLACES_KEY'), 'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.editorialSummary,places.reviews' },
    body: JSON.stringify({ textQuery: `${q.name} ${q.where}`.trim(), languageCode: 'he', maxResultCount: 1 })
  });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
  const p = j.places?.[0]; if (!p) return [];
  const reviews = (p.reviews || []).map(v => ({ rating: v.rating, text: v.text?.text || v.originalText?.text || '', original: v.originalText?.text || '', lang: v.text?.languageCode || '', author: v.authorAttribution?.displayName || '', when: v.relativePublishTimeDescription || '' }))
    .filter(v => v.text).sort((a, b) => b.rating - a.rating || b.text.length - a.text.length);
  return [{ source: 'Google', name: p.displayName?.text, rating: p.rating || null, count: p.userRatingCount || 0, summary: p.editorialSummary?.text || '', link: p.googleMapsUri, reviews }];
}

// ---------------- orchestrator ----------------
const PROVIDERS = {
  flights: [['Duffel', 'DUFFEL_TOKEN', duffel], ['Google Flights', 'SERPAPI_KEY', googleFlights], ['Aviasales', 'TRAVELPAYOUTS_TOKEN', aviasales]],
  hotels: [['Google Hotels', 'SERPAPI_KEY', googleHotels]],
  food: [['Google Places', 'GOOGLE_PLACES_KEY', q => googlePlaces(q, 'food')]],
  things: [['Google Places', 'GOOGLE_PLACES_KEY', q => googlePlaces(q, 'things')]],
  reviews: [['Google Places', 'GOOGLE_PLACES_KEY', placeReviews]]
};

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
  const kind = b.kind; const all = PROVIDERS[kind];
  // only = שם ספק אחד (לבדיקה חיה ספק-אחר-ספק עם חיווי לכל מנוע)
  const list = all && b.only ? all.filter(([n]) => n === b.only) : all;
  if (!list || !list.length) return json({ error: 'סוג חיפוש לא נתמך בחיפוש חי' }, 400);
  let q;
  if (kind === 'flights') {
    q = { from: iata(b.from), to: iata(b.to), depart: b.depart, ret: isDate(b.ret) ? b.ret : '', adults: Math.min(9, Math.max(1, +b.adults || 1)), cabin: ['economy', 'premium_economy', 'business', 'first'].includes(b.cabin) ? b.cabin : 'economy' };
    if (!/^[A-Z]{3}$/.test(q.from) || !/^[A-Z]{3}$/.test(q.to) || !isDate(q.depart)) return json({ error: 'פרטי טיסה לא תקינים' }, 400);
  } else if (kind === 'hotels') {
    q = { where: String(b.where || '').slice(0, 120), checkin: b.checkin, checkout: b.checkout, adults: Math.min(10, Math.max(1, +b.adults || 2)) };
    if (!q.where || !isDate(q.checkin) || !isDate(q.checkout)) return json({ error: 'פרטי מלון לא תקינים' }, 400);
  } else if (kind === 'reviews') {
    q = { name: String(b.name || '').slice(0, 120), where: String(b.where || '').slice(0, 120) }; if (!q.name) return json({ error: 'חסר שם מקום' }, 400);
  } else {
    q = { where: String(b.where || '').slice(0, 120) }; if (!q.where) return json({ error: 'חסר מיקום' }, 400);
  }
  const active = list.filter(([, key]) => env(key));
  const settled = await Promise.allSettled(active.map(([, , fn]) => withTimeout(fn(q))));
  const providers = list.map(([name, key]) => {
    const i = active.findIndex(a => a[0] === name);
    if (i < 0) return { name, status: 'off', note: `חסר ${key}` };
    const s = settled[i];
    return s.status === 'fulfilled' ? { name, status: 'ok', count: s.value.length } : { name, status: 'error', note: String(s.reason?.message || s.reason).slice(0, 120) };
  });
  const results = settled.flatMap(s => s.status === 'fulfilled' ? s.value : []);
  return json({ kind, providers, results });
};
