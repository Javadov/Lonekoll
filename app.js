import { beraknaManad, delaUppPass, obKategori } from './avtal.js';
import { AVTAL } from './avtalssatser.js';

const NYCKEL = 'skiftlon.v2';
const KAT = { dag: 'Dagtid', kvallNatt: 'Kväll och natt', helg: 'Helg', storhelg: 'Storhelg' };
const VECKODAG = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
const STATUS = {
  arbete: { namn: 'Arbetade', kort: '' },
  semester: { namn: 'Semester', kort: 'Sem' },
  foraldraledig: { namn: 'Föräldraledig', kort: 'FL' },
  vab: { namn: 'Vab', kort: 'Vab' },
};
const PALETT = [
  { id: 'orange', stark: '#e8622c', mjuk: '#fae3d8' },
  { id: 'gul', stark: '#e0a41c', mjuk: '#fbeecf' },
  { id: 'gron', stark: '#4aa35a', mjuk: '#dcefdf' },
  { id: 'blaa', stark: '#4356c8', mjuk: '#dfe2f7' },
  { id: 'marin', stark: '#1b2a6b', mjuk: '#d9dceb' },
  { id: 'graa', stark: '#6b7d86', mjuk: '#e1e6e9' },
  { id: 'roed', stark: '#d9384a', mjuk: '#fadde0' },
  { id: 'lila', stark: '#8158cc', mjuk: '#e8e0f7' },
];
const farg = id => PALETT.find(p => p.id === id) || PALETT[5];

const standard = () => ({
  namn: '',            // matas in vid onboarding
  sats: {
    ...AVTAL,
    manadslon: 0,        // matas in vid första starten
    skattPunkter: [],    // punkter från egna lönespecar
    fackPa: true,
    obPaOvertid: true,
    doljLon: false,
    plats: null, radie: 250,
  },
  skift: [
    { kod: 'f', namn: 'Föremiddag', start: '06:00', slut: '14:16', farg: 'orange' },
    { kod: 'e', namn: 'Eftermiddag', start: '14:00', slut: '22:16', farg: 'gul' },
    { kod: 'ef', namn: 'Eftermiddag fredag', start: '14:00', slut: '20:16', farg: 'gul' },
    { kod: 'n', namn: 'Natt', start: '22:00', slut: '06:16', farg: 'blaa' },
    { kod: 'nf', namn: 'Natt fredag', start: '20:00', slut: '06:16', farg: 'marin' },
    { kod: 'F', namn: 'Långdag', start: '06:00', slut: '18:16', farg: 'graa' },
    { kod: 'N', namn: 'Långnatt', start: '18:00', slut: '06:16', farg: 'marin' }, 
  ],
  // Standardrotationen nedan är bara en startpunkt — ändra eller ta bort den
  // och bygg en egen i appen om schemat inte stämmer.
  rotationer: [{
    id: 'standard-skift', namn: 'Skift', langd: 35, start: '2026-01-19', slut: '',
    monster: [
      'f', 'f', 'f', 'f', 'f', '', '',
      '', '', '', 'n', 'nf', 'N', 'N',
      '', '', 'e', 'e', 'ef', '', '',
      'n', 'n', 'n', '', '', 'F', 'F',
      'e', 'e', '', '', '', '', '',
    ],
  }],
  dagar: {},        // "2026-09-14": { kod, status, extra, franvaroTim }
});

let data = standard();
let visadManad = new Date();
visadManad = new Date(visadManad.getFullYear(), visadManad.getMonth(), 1);
let aktivtDatum = null, aktivtSkift = null, aktivRotation = null, pensel = '';

/**
 * Lagring. I webbläsaren används localStorage. Körs appen i en miljö som
 * tillhandahåller window.storage används den i stället.
 */
const lager = (typeof window !== 'undefined' && window.storage) ? {
  async las(n) { const r = await window.storage.get(n); return r && r.value; },
  async skriv(n, v) { await window.storage.set(n, v); },
} : {
  async las(n) { return localStorage.getItem(n); },
  async skriv(n, v) { localStorage.setItem(n, v); },
};

async function ladda() {
  try {
    const rå = await lager.las(NYCKEL);
    const grund = standard();
    if (!rå) return grund;
    const sparat = JSON.parse(rå);
    return { ...grund, ...sparat, sats: { ...grund.sats, ...(sparat.sats || {}) } };
  } catch { return standard(); }
}
function spara() {
  lager.skriv(NYCKEL, JSON.stringify(data)).catch(fel => {
    console.error('Kunde inte spara', fel);
    melding('Kunde inte spara. Kontrollera att webbläsaren tillåter lagring.');
  });
}

/* ---------- hjälpare ---------- */
const $ = s => document.querySelector(s);
let skattetabell = null;
let avslojad = false;
const dolt = () => data.sats.doljLon && !avslojad;
const mask = t => String(t).replace(/[0-9]/g, '•');
const kr = n => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const krRund = n => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(n));
const pengar = n => dolt() ? mask(kr(n)) : kr(n);
const pengarRund = n => dolt() ? mask(krRund(n)) : krRund(n);
const tim = n => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const franIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const skiftFor = kod => data.skift.find(s => s.kod === kod) || null;
const nyttId = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function klocka(datum, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(datum.getFullYear(), datum.getMonth(), datum.getDate(), h, m);
}
function passTider(datum, start, slut) {
  const s = klocka(datum, start);
  let e = klocka(datum, slut);
  // Samma klockslag är ett nollpass, inte ett dygn. Bara en tidigare sluttid går över midnatt.
  if (e < s) e = new Date(e.getTime() + 86400000);
  return { start: s, slut: e };
}
const passLangd = (sk, datum = new Date(2026, 0, 7)) => {
  const p = passTider(datum, sk.start, sk.slut);
  return (p.slut - p.start) / 3600000;
};

/** Vilket skift gäller ett visst datum: egen ändring först, annars rotationen. */
function kodForDatum(datum) {
  const nyckel = iso(datum);
  if (data.dagar[nyckel] && 'kod' in data.dagar[nyckel]) {
    return { kod: data.dagar[nyckel].kod, egen: true };
  }
  let träff = null;
  for (const r of data.rotationer) {
    if (!r.start || !r.monster?.length) continue;
    const start = franIso(r.start);
    if (datum < start) continue;
    if (r.slut && datum > franIso(r.slut)) continue;
    if (!träff || franIso(r.start) >= franIso(träff.start)) träff = r;
  }
  if (!träff) return { kod: '', egen: false };
  const diff = Math.round((datum - franIso(träff.start)) / 86400000);
  return { kod: träff.monster[((diff % träff.langd) + träff.langd) % träff.langd] || '', egen: false };
}

function manadensDagar() {
  const y = visadManad.getFullYear(), m = visadManad.getMonth();
  const ut = [];
  for (let i = 1; i <= new Date(y, m + 1, 0).getDate(); i++) {
    const datum = new Date(y, m, i);
    const d = data.dagar[iso(datum)] || {};
    const { kod, egen } = kodForDatum(datum);
    const status = d.status || 'arbete';
    const sk = skiftFor(kod);
    const heltPass = sk ? passTider(datum, sk.start, sk.slut) : null;
    const schema = status === 'arbete' ? heltPass : null;
    const extra = (d.extra || [])
      .map(p => ({ ...passTider(datum, p.start, p.slut), installelse: !!p.installelse }))
      .filter(p => p.slut > p.start);

    let franvaroTim = d.franvaroTim || 0;
    if ((status === 'foraldraledig' || status === 'vab') && heltPass) {
      franvaroTim += (heltPass.slut - heltPass.start) / 3600000;
    }
    ut.push({
      datum, kod, egen, status, sk, schema, extra,
      pass: [...(schema ? [schema] : []), ...extra],
      franvaroTim, semester: status === 'semester',
    });
  }
  return ut;
}

/* ---------- stämpling ---------- */
const R_JORD = 6371000;
function avstand(a, b) {
  const rad = g => g * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_JORD * Math.asin(Math.sqrt(h));
}

const position = () => new Promise((ok, fel) =>
  navigator.geolocation.getCurrentPosition(
    p => ok({ lat: p.coords.latitude, lng: p.coords.longitude, noggrannhet: p.coords.accuracy }),
    fel, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }));

const hhmm = dt => `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

/** Stämplar in eller ut. Kontrollerar platsen om en arbetsplats är sparad. */
async function stampla(riktning) {
  const nu = new Date();
  const nyckel = iso(nu);
  const plats = data.sats.plats;

  if (plats) {
    try {
      const har = await position();
      const m = Math.round(avstand(plats, har));
      if (m > data.sats.radie) {
        const fortsatt = confirm(`Du verkar vara ${m} m från arbetsplatsen, utanför radien på ${data.sats.radie} m. Stämpla ändå?`);
        if (!fortsatt) return;
      }
    } catch {
      if (!confirm('Kunde inte läsa din position. Stämpla ändå?')) return;
    }
  }

  const d = data.dagar[nyckel] || {};
  const stamp = { ...(d.stamp || {}) };
  const { kod } = kodForDatum(nu);
  const schemalagt = !!skiftFor(kod);

  if (riktning === 'in') {
    stamp.in = hhmm(nu);
    delete stamp.ut;
  } else {
    stamp.ut = hhmm(nu);
    // På en ledig dag blir in- och uttiden extratid, alltså övertid.
    if (!schemalagt && stamp.in) {
      const minuter = Math.round((klocka(nu, stamp.ut) - klocka(nu, stamp.in)) / 60000);
      if (minuter <= 0) {
        data.dagar[nyckel] = { ...d, stamp: {} };
        spara(); visaManad();
        return melding('In och ut på samma minut. Ingen tid registrerad, stämpla in igen när du börjar.');
      }
      if (minuter < 15 && !confirm(`Passet blir bara ${minuter} minuter. Registrera det ändå?`)) {
        data.dagar[nyckel] = { ...d, stamp: {} };
        spara(); visaManad();
        return melding('Stämplingen ångrad.');
      }
      const extra = [...(d.extra || []), { start: stamp.in, slut: stamp.ut, installelse: false }];
      data.dagar[nyckel] = { ...d, extra, stamp: { klar: true } };
      spara(); visaManad();
      return melding(`Extrapass ${stamp.in}–${stamp.ut} registrerat.`);
    }
  }
  data.dagar[nyckel] = { ...d, stamp };
  spara(); visaManad();
  melding(riktning === 'in'
    ? (schemalagt ? `Incheckad ${stamp.in} på ${kod}-passet.` : `Incheckad ${stamp.in}. Stämpla ut när du går hem.`)
    : `Utcheckad ${stamp.ut}.`);
}

function melding(text) {
  const ruta = $('#melding');
  ruta.textContent = text;
  ruta.hidden = false;
  clearTimeout(melding.t);
  melding.t = setTimeout(() => { ruta.hidden = true; }, 6000);
}

function visaStampel() {
  const nu = new Date();
  const d = data.dagar[iso(nu)] || {};
  const stamp = d.stamp || {};
  const { kod } = kodForDatum(nu);
  const sk = skiftFor(kod);

  $('#stampelDag').textContent = nu.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#stampelPass').textContent = sk ? `${sk.namn} ${sk.start}–${sk.slut}` : 'Ledig dag';
  $('#stampelStatus').textContent = stamp.klar ? 'Extrapasset är registrerat'
    : stamp.ut ? `Ut ${stamp.ut}` : stamp.in ? `In ${stamp.in}` : '';
  const ute = stamp.in && !stamp.ut && !stamp.klar;
  $('#stamplaKnapp').textContent = ute ? 'Stämpla ut' : 'Stämpla in';
  $('#stamplaKnapp').dataset.riktning = ute ? 'ut' : 'in';
}

/* ---------- kalender ---------- */
function visaManad() {
  const dagar = manadensDagar();
  const res = beraknaManad(dagar, { ...data.sats, skattetabell });
  const ob = res.timmar.ob;

  $('#manadsnamn').textContent = visadManad.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
  $('#veckodagar').innerHTML = VECKODAG.map(v => `<span>${v}</span>`).join('');

  const celler = [];
  for (let i = 0; i < (dagar[0].datum.getDay() + 6) % 7; i++) celler.push('<div class="cell tom"></div>');

  for (const dag of dagar) {
    const s = { dag: 0, kvallNatt: 0, helg: 0, storhelg: 0 };
    let summa = 0;
    for (const p of dag.pass) {
      const del = delaUppPass(p.start, p.slut);
      for (const k in del) { s[k] += del[k]; summa += del[k]; }
    }
    const stripe = summa
      ? `<span class="cstripe">${Object.keys(KAT).map(k =>
          `<i style="width:${(s[k] / summa) * 100}%;background:var(--${k === 'kvallNatt' ? 'kvall' : k})"></i>`).join('')}</span>`
      : '<span class="cstripe"></span>';
    const extraTim = dag.extra.reduce((a, p) => a + (p.slut - p.start) / 3600000, 0);
    const ledig = dag.status !== 'arbete';
    const bg = ledig ? 'var(--falt)' : (dag.sk ? farg(dag.sk.farg).mjuk : 'var(--falt)');
    celler.push(`<button class="cell" style="background:${bg}" data-datum="${iso(dag.datum)}">
      <span class="cdag num">${dag.datum.getDate()}</span>
      <span class="ckod${ledig ? ' liten' : ''}">${ledig ? STATUS[dag.status].kort : esc(dag.kod)}</span>
      ${extraTim > 0 ? `<span class="cextra num">+${tim(extraTim)}</span>` : ''}
      ${dag.egen ? '<span class="cprick"></span>' : ''}
      ${(data.dagar[iso(dag.datum)]?.stamp) ? '<span class="cbock">✓</span>' : ''}
      ${stripe}
    </button>`);
  }
  $('#rutnat').innerHTML = celler.join('');

  $('#legend').innerHTML = Object.entries(KAT)
    .map(([k, namn]) => `<div><i style="background:var(--${k === 'kvallNatt' ? 'kvall' : k})"></i>${namn} <b class="num">${tim(ob[k])} h</b></div>`)
    .join('') +
    `<div><i style="background:var(--overtid)"></i>Övertid <b class="num">${tim(res.timmar.overtid)} h</b></div>`;

  $('#nettoBelopp').textContent = pengarRund(res.netto) + ' kr';
  $('#bruttoRad').textContent = `Brutto ${pengarRund(res.brutto)} · skatt ${pengarRund(res.skatt)} · fack ${pengarRund(res.fack)}`;
  const sem = res.timmar.semesterdagar, franv = res.timmar.franvaroTim;
  $('#franvarorad').textContent = [
    sem ? `${sem} semesterdagar` : '',
    franv ? `${tim(franv)} h frånvaro med avdrag` : '',
  ].filter(Boolean).join(' · ');

  visaStampel();
  visaHalsning();
  const saknarLon = !data.sats.manadslon;
  const saknarSkatt = !skattetabell && !data.sats.skattPunkter.length;
  $('#tips').hidden = !(saknarLon || saknarSkatt);
  $('#tips').textContent = saknarLon
    ? 'Lägg in din månadslön under Inställningar och Profil, så börjar beräkningen fungera.'
    : 'Ingen skatt är beräknad. Lägg in bruttolön och skatt från en lönespec under Profil.';
  document.querySelectorAll('.oga').forEach(b => {
    b.hidden = !data.sats.doljLon;
    b.textContent = avslojad ? 'Dölj' : 'Visa';
  });
  visaLon(res);
}

const skattkalla = () => skattetabell
  ? `Tabell ${skattetabell.tabell}, kolumn ${skattetabell.kolumn}`
  : data.sats.skattPunkter.length ? 'Uppskattad mellan dina punkter' : 'Lägg in punkter under Profil';

function visaLon(res) {
  $('#lonespec').innerHTML =
    res.rader.map(r => `<tr>
      <td>${r.namn}${r.antal != null ? `<br><small class="num" style="color:var(--dampad)">${tim(r.antal)} × ${kr(Math.abs(r.pris))}</small>` : ''}</td>
      <td class="h num">${pengar(r.belopp)}</td></tr>`).join('') +
    `<tr class="summa"><td>Bruttolön</td><td class="h num">${pengar(res.brutto)}</td></tr>
     <tr><td>Preliminärskatt<br><small style="color:var(--dampad)">${skattkalla()}</small></td><td class="h num">−${pengarRund(res.skatt)}</td></tr>
     ${data.sats.fackPa ? `<tr><td>Fackföreningsavgift<br><small class="num" style="color:var(--dampad)">${data.sats.fackProcent} % av brutto, ${krRund(data.sats.fackMin)}–${krRund(data.sats.fackMax)} kr</small></td><td class="h num">−${pengarRund(res.fack)}</td></tr>` : ''}
     <tr class="summa stor"><td>Din lön</td><td class="h num">${pengarRund(res.netto)} kr</td></tr>`;
  $('#timsatser').textContent = `Grundpeng ${pengar(res.timBas)} kr/h · övertidstillägg ${pengar(res.timOtTillagg)} kr/h`;
}

/* ---------- dagdialog ---------- */
function oppnaDag(datumIso) {
  aktivtDatum = datumIso;
  const datum = franIso(datumIso);
  const d = data.dagar[datumIso] || {};
  const { kod, egen } = kodForDatum(datum);

  $('#dagTitel').textContent = datum.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  const kat = obKategori(new Date(datum.getFullYear(), datum.getMonth(), datum.getDate(), 12));
  $('#dagSchema').textContent =
    (kat === 'storhelg' ? 'Storhelg' : kat === 'helg' ? 'Helg' : 'Vardag') +
    (egen ? ' · ändrad mot rotationen' : ' · enligt rotationen');

  $('#kodval').innerHTML = data.skift.map(s => {
    const f = farg(s.farg);
    return `<button type="button" class="kodknapp${kod === s.kod ? ' vald' : ''}" style="background:${f.mjuk}" data-kod="${esc(s.kod)}">
      <b>${esc(s.kod)}</b><small>${s.start}–${s.slut}</small></button>`;
  }).join('') +
    `<button type="button" class="kodknapp${!kod ? ' vald' : ''}" data-kod=""><b>–</b><small>Ledig</small></button>`;

  $('#statusval').innerHTML = Object.entries(STATUS).map(([k, v]) =>
    `<button type="button" class="statusknapp s-${k}${(d.status || 'arbete') === k ? ' vald' : ''}" data-status="${k}">${v.namn}</button>`).join('');

  $('#aterstall').hidden = !egen;
  $('#franvaro').value = d.franvaroTim || '';
  ritaExtra(d.extra || []);
  $('#dagDialog').showModal();
}

function ritaExtra(extra) {
  $('#extrarader').innerHTML = extra.length ? extra.map((p, i) => `
    <div class="passrad" data-i="${i}">
      <div><label for="s${i}">Från</label><input id="s${i}" type="time" value="${p.start}" data-falt="start"></div>
      <div><label for="e${i}">Till</label><input id="e${i}" type="time" value="${p.slut}" data-falt="slut"></div>
      <button type="button" class="taBort" aria-label="Ta bort raden">✕</button>
    </div>
    <div class="kryss"><input type="checkbox" id="i${i}" ${p.installelse ? 'checked' : ''}>
      <label for="i${i}">Inkallad på ledig tid</label></div>`).join('')
    : '<p class="hjalp" style="margin:0 0 4px">Ingen extratid registrerad.</p>';
}

function lasExtra() {
  return [...document.querySelectorAll('#extrarader .passrad')].map(rad => ({
    start: rad.querySelector('[data-falt=start]').value,
    slut: rad.querySelector('[data-falt=slut]').value,
    installelse: document.querySelector('#i' + rad.dataset.i)?.checked || false,
  })).filter(p => p.start && p.slut);
}

/* ---------- skiftbiblioteket ---------- */
function visaSkift() {
  $('#skiftlista').innerHTML = data.skift.map(s => {
    const f = farg(s.farg);
    return `<button class="listkort" data-skift="${esc(s.kod)}">
      <span class="etikett" style="background:${f.stark}">${esc(s.namn)}</span>
      <span class="listtext"><b>${esc(s.kod)}</b><small>${s.start}–${s.slut} · ${tim(passLangd(s))} h</small></span>
      <span class="chevron">›</span></button>`;
  }).join('') || '<p class="hjalp">Inga skift ännu.</p>';
}

function oppnaSkift(kod) {
  const s = kod === null ? { kod: '', namn: '', start: '06:00', slut: '14:16', farg: 'gron' } : skiftFor(kod);
  aktivtSkift = kod;
  $('#skiftTitel').textContent = kod === null ? 'Nytt skift' : 'Ändra skift';
  $('#sNamn').value = s.namn; $('#sKod').value = s.kod;
  $('#sStart').value = s.start; $('#sSlut').value = s.slut;
  $('#fargval').innerHTML = PALETT.map(p =>
    `<button type="button" class="fargknapp${p.id === s.farg ? ' vald' : ''}" style="background:${p.stark}" data-farg="${p.id}" aria-label="${p.id}"></button>`).join('');
  $('#taBortSkift').hidden = kod === null;
  $('#skiftDialog').showModal();
}

/* ---------- rotationer ---------- */
function visaRotationer() {
  $('#rotationslista').innerHTML = data.rotationer.map(r => {
    const rutor = r.monster.map(k => {
      const sk = skiftFor(k);
      return `<i style="background:${sk ? farg(sk.farg).stark : '#c9ccd1'}"></i>`;
    }).join('');
    const period = r.slut ? `${r.start} till ${r.slut}` : `från ${r.start}, tills vidare`;
    return `<button class="listkort lodrat" data-rotation="${r.id}">
      <span class="listrad"><b>${esc(r.namn)}</b><span class="chevron">›</span></span>
      <span class="pill">${r.langd} dygn · ${period}</span>
      <span class="minimonster">${rutor}</span></button>`;
  }).join('') || '<p class="hjalp">Ingen rotation ännu. Lägg till en så fylls kalendern automatiskt.</p>';
}

function oppnaRotation(id) {
  aktivRotation = id;
  const r = id === null
    ? { id: nyttId(), namn: 'Skift', langd: 35, start: iso(new Date()), slut: '', monster: Array(35).fill('') }
    : data.rotationer.find(x => x.id === id);
  $('#rTitel').textContent = id === null ? 'Ny rotation' : 'Ändra rotation';
  $('#rNamn').value = r.namn;
  $('#rLangd').value = r.langd;
  $('#rStart').value = r.start;
  $('#rSlut').value = r.slut || '';
  $('#rTillsvidare').checked = !r.slut;
  $('#rSlut').disabled = !r.slut;
  $('#taBortRotation').hidden = id === null;
  pensel = data.skift[0]?.kod || '';
  ritaPensel();
  ritaMonster(Array.from({ length: r.langd }, (_, i) => r.monster[i] || ''));
  $('#rotationDialog').showModal();
}

function ritaPensel() {
  $('#penselval').innerHTML = data.skift.map(s =>
    `<button type="button" class="penselknapp${pensel === s.kod ? ' vald' : ''}" style="background:${farg(s.farg).stark}" data-pensel="${esc(s.kod)}">${esc(s.namn)}</button>`).join('') +
    `<button type="button" class="penselknapp ledig${pensel === '' ? ' vald' : ''}" data-pensel="">Ledig</button>`;
}

function ritaMonster(monster) {
  $('#monster').innerHTML = monster.map((k, i) => {
    const sk = skiftFor(k);
    return `<button type="button" class="mcell" data-i="${i}" data-kod="${esc(k)}" style="background:${sk ? farg(sk.farg).mjuk : 'var(--yta)'}">
      <span class="mdag">${i + 1}</span><span class="mkod">${sk ? esc(sk.kod) : ''}</span></button>`;
  }).join('');
}

const lasMonster = () => [...document.querySelectorAll('#monster .mcell')].map(c => c.dataset.kod || '');

/* ---------- inställningar ---------- */
function visaInstallningar() {
  $('#profilNamn').value = data.namn || '';
  const s = data.sats;
  for (const [id, v] of Object.entries({
    manadslon: s.manadslon, obVardag: s.obVardag, obHelg: s.obHelg, obStorhelg: s.obStorhelg,
    otBasDiv: s.otBasDiv, otTillaggDiv: s.otTillaggDiv,
    installVardag: s.installVardag, installHelg: s.installHelg,
    fackProcent: s.fackProcent,
  })) $('#' + id).value = v;
  $('#obPaOvertid').checked = s.obPaOvertid;
  $('#fackPa').checked = s.fackPa !== false;
  $('#doljLon').checked = !!s.doljLon;
  $('#fackFalt').hidden = s.fackPa === false;
  $('#fackSpann').textContent = `Lägst ${krRund(s.fackMin)} kr och högst ${krRund(s.fackMax)} kr per månad.`;
}

function sparaInstallningar() {
  const n = id => Number(String($('#' + id).value).replace(/\s/g, '').replace(',', '.')) || 0;
  data.namn = $('#profilNamn').value.trim();
  data.sats = {
    ...data.sats,
    manadslon: n('manadslon'), obVardag: n('obVardag'), obHelg: n('obHelg'), obStorhelg: n('obStorhelg'),
    otBasDiv: n('otBasDiv') || 175, otTillaggDiv: n('otTillaggDiv') || 420,
    installVardag: n('installVardag'), installHelg: n('installHelg'),
    fackPa: $('#fackPa').checked, fackProcent: n('fackProcent'),
    obPaOvertid: $('#obPaOvertid').checked,
    doljLon: $('#doljLon').checked,
  };
  spara(); visaManad(); visaInstallningar();
}

/* ---------- händelser ---------- */
document.addEventListener('click', e => {
  const flik = e.target.closest('nav button');
  if (flik) {
    document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-current', String(b === flik)));
    document.querySelectorAll('.vy').forEach(v => v.hidden = v.id !== flik.dataset.vy);
    if (flik.dataset.vy === 'vySchema') { visaSkift(); visaRotationer(); }
    if (flik.dataset.vy === 'vyInstallningar') { visaInstallningar(); visaPlats(); }
    return;
  }
  const seg = e.target.closest('.segment button');
  if (seg) {
    document.querySelectorAll('.segment button').forEach(b => b.setAttribute('aria-current', String(b === seg)));
    const vy = seg.closest('.vy');
    vy.querySelectorAll('[id^="panel"]').forEach(p => { p.hidden = p.id !== 'panel' + seg.dataset.panel; });
    return;
  }

  const cell = e.target.closest('.cell:not(.tom)');
  if (cell) return oppnaDag(cell.dataset.datum);

  const skiftkort = e.target.closest('[data-skift]');
  if (skiftkort) return oppnaSkift(skiftkort.dataset.skift);

  const rotkort = e.target.closest('[data-rotation]');
  if (rotkort) return oppnaRotation(rotkort.dataset.rotation);

  const kodknapp = e.target.closest('.kodknapp');
  if (kodknapp) {
    document.querySelectorAll('.kodknapp').forEach(k => k.classList.toggle('vald', k === kodknapp));
    return;
  }
  const statusknapp = e.target.closest('.statusknapp');
  if (statusknapp) {
    document.querySelectorAll('.statusknapp').forEach(k => k.classList.toggle('vald', k === statusknapp));
    return;
  }
  const fargknapp = e.target.closest('.fargknapp');
  if (fargknapp) {
    document.querySelectorAll('.fargknapp').forEach(k => k.classList.toggle('vald', k === fargknapp));
    return;
  }
  const penselknapp = e.target.closest('.penselknapp');
  if (penselknapp) {
    pensel = penselknapp.dataset.pensel;
    ritaPensel();
    return;
  }
  const mcell = e.target.closest('.mcell');
  if (mcell) {
    const sk = skiftFor(pensel);
    mcell.dataset.kod = pensel;
    mcell.style.background = sk ? farg(sk.farg).mjuk : 'var(--yta)';
    mcell.querySelector('.mkod').textContent = sk ? sk.kod : '';
    return;
  }
  if (e.target.closest('.taBort')) {
    const extra = lasExtra();
    extra.splice(Number(e.target.closest('.passrad').dataset.i), 1);
    return ritaExtra(extra);
  }
});

$('#foregaende').onclick = () => { visadManad.setMonth(visadManad.getMonth() - 1); visaManad(); };
$('#nasta').onclick = () => { visadManad.setMonth(visadManad.getMonth() + 1); visaManad(); };

/* dagen */
$('#laggExtra').onclick = () => ritaExtra([...lasExtra(), { start: '22:16', slut: '02:00', installelse: false }]);
$('#sparaDag').onclick = () => {
  data.dagar[aktivtDatum] = {
    kod: $('#kodval .vald')?.dataset.kod ?? '',
    status: $('#statusval .vald')?.dataset.status || 'arbete',
    extra: lasExtra(),
    franvaroTim: Number(String($('#franvaro').value).replace(',', '.')) || 0,
  };
  spara(); $('#dagDialog').close(); visaManad();
};
$('#aterstall').onclick = () => {
  delete data.dagar[aktivtDatum];
  spara(); $('#dagDialog').close(); visaManad();
};
$('#stangDag').onclick = () => $('#dagDialog').close();

/* skift */
$('#nyttSkift').onclick = () => oppnaSkift(null);
$('#sparaSkift').onclick = () => {
  const ny = {
    kod: $('#sKod').value.trim(), namn: $('#sNamn').value.trim() || $('#sKod').value.trim(),
    start: $('#sStart').value, slut: $('#sSlut').value,
    farg: $('#fargval .vald')?.dataset.farg || 'gron',
  };
  if (!ny.kod) return alert('Skiftet behöver en kod, till exempel f eller N.');
  const i = data.skift.findIndex(s => s.kod === aktivtSkift);
  if (i >= 0) data.skift[i] = ny; else data.skift.push(ny);
  spara(); $('#skiftDialog').close(); visaSkift(); visaRotationer(); visaManad();
};
$('#taBortSkift').onclick = () => {
  if (!confirm('Ta bort skiftet? Dagar som använder det blir lediga.')) return;
  data.skift = data.skift.filter(s => s.kod !== aktivtSkift);
  spara(); $('#skiftDialog').close(); visaSkift(); visaRotationer(); visaManad();
};
$('#stangSkift').onclick = () => $('#skiftDialog').close();

/* rotation */
$('#nyRotation').onclick = () => oppnaRotation(null);
$('#rLangd').onchange = () => {
  const langd = Math.max(1, Math.min(120, Number($('#rLangd').value) || 35));
  $('#rLangd').value = langd;
  const nuvarande = lasMonster();
  ritaMonster(Array.from({ length: langd }, (_, i) => nuvarande[i] || ''));
};
$('#rTillsvidare').onchange = () => {
  $('#rSlut').disabled = $('#rTillsvidare').checked;
  if ($('#rTillsvidare').checked) $('#rSlut').value = '';
};
$('#sparaRotation').onclick = () => {
  const langd = Number($('#rLangd').value) || 35;
  const ny = {
    id: aktivRotation || nyttId(),
    namn: $('#rNamn').value.trim() || 'Rotation',
    langd,
    start: $('#rStart').value,
    slut: $('#rTillsvidare').checked ? '' : $('#rSlut').value,
    monster: lasMonster().slice(0, langd),
  };
  if (!ny.start) return alert('Välj vilket datum rotationen börjar.');
  const i = data.rotationer.findIndex(r => r.id === aktivRotation);
  if (i >= 0) data.rotationer[i] = ny; else data.rotationer.push(ny);
  spara(); $('#rotationDialog').close(); visaRotationer(); visaManad();
};
$('#taBortRotation').onclick = () => {
  if (!confirm('Ta bort rotationen?')) return;
  data.rotationer = data.rotationer.filter(r => r.id !== aktivRotation);
  spara(); $('#rotationDialog').close(); visaRotationer(); visaManad();
};
$('#stangRotation').onclick = () => $('#rotationDialog').close();

$('#exportera').onclick = () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `skiftlon-${iso(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('#importera').onchange = async e => {
  const fil = e.target.files[0];
  if (!fil) return;
  try {
    const inlast = JSON.parse(await fil.text());
    if (!inlast.sats || !inlast.skift) throw new Error('fel format');
    if (!confirm('Detta ersätter allt som ligger i appen nu. Fortsätt?')) return;
    data = { ...standard(), ...inlast };
    spara(); visaManad(); visaSkift(); visaRotationer(); visaInstallningar(); visaPlats();
    melding('Säkerhetskopian är inläst.');
  } catch {
    alert('Filen gick inte att läsa. Välj en fil som exporterats från appen.');
  }
  e.target.value = '';
};

$('#fackPa').onchange = () => { $('#fackFalt').hidden = !$('#fackPa').checked; };
$('#doljLon').onchange = () => { data.sats.doljLon = $('#doljLon').checked; avslojad = false; spara(); visaManad(); };

document.addEventListener('click', e => {
  if (!e.target.closest('.oga')) return;
  avslojad = !avslojad;
  visaManad();
});

$('#stamplaKnapp').onclick = e => stampla(e.currentTarget.dataset.riktning);

$('#sparaPlats').onclick = async () => {
  $('#platsStatus').textContent = 'Läser position…';
  try {
    const p = await position();
    data.sats.plats = { lat: p.lat, lng: p.lng };
    data.sats.radie = Number($('#radie').value) || 250;
    spara(); visaPlats();
    melding(`Arbetsplatsen sparad, noggrannhet ±${Math.round(p.noggrannhet)} m.`);
  } catch {
    $('#platsStatus').textContent = 'Kunde inte läsa positionen. Kontrollera att platstjänster är påslagna.';
  }
};

$('#glomPlats').onclick = () => { data.sats.plats = null; spara(); visaPlats(); };

function visaPlats() {
  const p = data.sats.plats;
  $('#radie').value = data.sats.radie;
  $('#platsStatus').textContent = p
    ? `Sparad: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
    : 'Ingen arbetsplats sparad. Stämplingen sker då utan platskontroll.';
  $('#glomPlats').hidden = !p;
}

$('#sparaInstallningar').onclick = sparaInstallningar;

async function laddaSkattetabell() {
  try {
    const svar = await fetch('./skattetabell.json');
    if (!svar.ok) return null;
    const t = await svar.json();
    return t.belopp?.length ? t : null;
  } catch { return null; }
}

(async () => {
  data = await ladda();
  skattetabell = await laddaSkattetabell();
  visaManad();
  const bad = new URLSearchParams(location.search).get('stampla');
  if (bad === 'in' || bad === 'ut') {
    history.replaceState(null, '', location.pathname);
    stampla(bad);
  }
})();

/* ---------- onboarding ---------- */
function visaHalsning() {
  const el = $('#halsning');
  if (data.namn) {
    const timme = new Date().getHours();
    const halsning = timme < 5 ? 'God natt' : timme < 10 ? 'God morgon' : timme < 17 ? 'Hej' : timme < 22 ? 'God kväll' : 'God natt';
    $('#halsningText').textContent = `${halsning}, ${data.namn} 👋`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function visaOnboarding() {
  const dlg = $('#onboardingDialog');
  dlg.showModal();
  // Förhindra stängning med Escape under onboarding
  dlg.addEventListener('cancel', e => {
    if (!data.namn && !data.sats.manadslon) e.preventDefault();
  });
}

$('#onboardSpara').onclick = () => {
  const namn = $('#onboardNamn').value.trim();
  const lon = Number(String($('#onboardLon').value).replace(/\s/g, '').replace(',', '.')) || 0;
  if (!namn) { $('#onboardNamn').focus(); return; }
  if (!lon) { $('#onboardLon').focus(); return; }
  data.namn = namn;
  data.sats.manadslon = lon;
  spara();
  $('#onboardingDialog').close();
  // Uppdatera fältet i inställningarna också
  const lonFalt = $('#manadslon');
  if (lonFalt) lonFalt.value = lon;
  visaManad();
};

(async () => {
  data = await ladda();
  visaManad();

  // Första gången: visa onboarding
  if (!data.namn && !data.sats.manadslon) {
    visaOnboarding();
  }

  const bad = new URLSearchParams(location.search).get('stampla');
  if (bad === 'in' || bad === 'ut') {
    history.replaceState(null, '', location.pathname);
    stampla(bad);
  }
})();
