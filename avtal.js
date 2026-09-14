// avtal.js — tidsregler och löneberäkning enligt kollektivavtalet (§4 OB, §5 övertid)
// All tid hanteras som lokala datum. Minutupplösning.

import { tabellskatt } from './skattetabell.js';

export const MIN = 60000;

export function d(y, m, day, h = 0, min = 0) {
  return new Date(y, m - 1, day, h, min, 0, 0);
}

/** Påskdagen (söndag) för ett år. Anonym gregoriansk algoritm. */
export function paskdagen(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const dd = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return d(y, month, day);
}

const addDays = (date, n) => {
  const x = new Date(date.getTime());
  x.setDate(x.getDate() + n);
  return x;
};
const at = (date, h, min = 0) => d(date.getFullYear(), date.getMonth() + 1, date.getDate(), h, min);

/** Lördagen inom ett datumintervall (används för midsommar- och alla helgons dag). */
function lordagMellan(y, month, fromDay, toDay) {
  for (let day = fromDay; day <= toDay; day++) {
    const x = d(y, month, day);
    if (x.getDay() === 6) return x;
  }
  return null;
}

/** Helgdagar enligt semesterlagen (söndagar hanteras separat av helgregeln). */
export function helgdagar(y) {
  const p = paskdagen(y);
  return [
    d(y, 1, 1), d(y, 1, 6),
    addDays(p, -2), p, addDays(p, 1),
    d(y, 5, 1),
    addDays(p, 39), addDays(p, 49),
    d(y, 6, 6),
    lordagMellan(y, 6, 20, 26),
    lordagMellan(y, 11, 1, 6) || lordagMellan(y, 10, 31, 31),
    d(y, 12, 25), d(y, 12, 26),
  ].filter(Boolean);
}

/** Storhelgsfönster [start, slut) för ett år, enligt avtalets uppräkning. */
export function storhelgsfonster(y) {
  const p = paskdagen(y);
  const midsommardagen = lordagMellan(y, 6, 20, 26);
  const midsommarafton = addDays(midsommardagen, -1);
  const pingstdagen = addDays(p, 49);
  const pingstafton = addDays(p, 48);
  return [
    { namn: 'Nyår', start: d(y - 1, 12, 31, 6), slut: d(y, 1, 2, 6) },
    { namn: 'Påsk', start: at(addDays(p, -3), 18), slut: at(addDays(p, 2), 6) },
    { namn: 'Första maj', start: d(y, 5, 1, 6), slut: d(y, 5, 2, 6) },
    { namn: 'Nationaldagen', start: d(y, 6, 6, 6), slut: d(y, 6, 7, 6) },
    { namn: 'Pingst', start: at(pingstafton, 6), slut: at(addDays(pingstdagen, 1), 6) },
    { namn: 'Midsommar', start: at(midsommarafton, 6), slut: at(addDays(midsommardagen, 1), 6) },
    { namn: 'Jul', start: d(y, 12, 24, 6), slut: d(y, 12, 27, 6) },
    { namn: 'Nyår', start: d(y, 12, 31, 6), slut: d(y + 1, 1, 2, 6) },
  ];
}

/** Helgtidsfönster: lör 06:00 → mån 06:00, samt 18:00 dag före helgdag → 06:00 dagen efter. */
export function helgfonster(y) {
  const out = [];
  for (let mo = 1; mo <= 12; mo++) {
    const dim = new Date(y, mo, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      const x = d(y, mo, day);
      if (x.getDay() === 6) out.push({ start: at(x, 6), slut: at(addDays(x, 2), 6) });
    }
  }
  for (const hd of helgdagar(y)) {
    if (hd.getDay() === 0 || hd.getDay() === 6) continue;
    out.push({ start: at(addDays(hd, -1), 18), slut: at(addDays(hd, 1), 6) });
  }
  return out;
}

const cache = new Map();
function regler(y) {
  if (!cache.has(y)) {
    cache.set(y, {
      storhelg: [...storhelgsfonster(y - 1), ...storhelgsfonster(y)],
      helg: [...helgfonster(y - 1), ...helgfonster(y)],
    });
  }
  return cache.get(y);
}

const inom = (t, f) => t >= f.start.getTime() && t < f.slut.getTime();

/**
 * OB-kategori för en given tidpunkt. Storhelg går före helg som går före kväll/natt
 * ("om inte högre belopp anges nedan").
 */
export function obKategori(date) {
  const t = date.getTime();
  const r = regler(date.getFullYear());
  if (r.storhelg.some(f => inom(t, f))) return 'storhelg';
  if (r.helg.some(f => inom(t, f))) return 'helg';
  const h = date.getHours();
  if (h >= 18 || h < 6) return 'kvallNatt';
  return 'dag';
}

/** Delar upp ett arbetspass i OB-kategorier. Returnerar timmar per kategori. */
export function delaUppPass(start, slut) {
  const ut = { dag: 0, kvallNatt: 0, helg: 0, storhelg: 0 };
  let t = start.getTime();
  const end = slut.getTime();
  while (t < end) {
    const nu = new Date(t);
    const kat = obKategori(nu);
    // hoppa fram till nästa hel-timme/06:00/18:00-gräns för färre iterationer
    const nastaTimme = new Date(t);
    nastaTimme.setMinutes(0, 0, 0);
    let steg = nastaTimme.getTime() + 3600000 - t;
    if (steg <= 0) steg = 60000;
    const bit = Math.min(steg, end - t);
    ut[kat] += bit / 3600000;
    t += bit;
  }
  return ut;
}

const overlapp = (a1, a2, b1, b2) =>
  Math.max(0, Math.min(a2.getTime(), b2.getTime()) - Math.max(a1.getTime(), b1.getTime()));

/**
 * Räknar ut en månads lön.
 *
 * dagar: [{ datum:Date, schema:{start,slut}|null, pass:[{start,slut,installelse}], franvaroTim }]
 * sats:  { manadslon, obVardag, obHelg, obStorhelg, otBasDiv, otTillaggDiv,
 *          installVardag, installHelg, fackavgift, obPaOvertid, skattPunkter }
 */
export function beraknaManad(dagar, sats) {
  const timBas = sats.manadslon / sats.otBasDiv;
  const timOtTillagg = sats.manadslon / sats.otTillaggDiv;

  const t = {
    ordinarie: 0, overtid: 0,
    ob: { dag: 0, kvallNatt: 0, helg: 0, storhelg: 0 },
    installVardag: 0, installHelg: 0, franvaroTim: 0, semesterdagar: 0,
  };

  for (const dag of dagar) {
    t.franvaroTim += dag.franvaroTim || 0;
    if (dag.semester) t.semesterdagar += 1;
    for (const pass of dag.pass || []) {
      if (!(pass.slut > pass.start)) continue;
      const langd = (pass.slut - pass.start) / 3600000;
      let ord = 0;
      if (dag.schema) ord = overlapp(pass.start, pass.slut, dag.schema.start, dag.schema.slut) / 3600000;
      const ot = langd - ord;
      t.ordinarie += ord;
      t.overtid += ot;

      const split = delaUppPass(pass.start, pass.slut);
      const andel = sats.obPaOvertid ? 1 : (langd > 0 ? ord / langd : 0);
      for (const k of Object.keys(split)) t.ob[k] += split[k] * andel;

      if (pass.installelse) {
        const kat = obKategori(pass.start);
        if (kat === 'helg' || kat === 'storhelg') t.installHelg += 1;
        else t.installVardag += 1;
      }
    }
  }

  const r2 = n => Math.round(n * 100) / 100;
  const rader = [
    { namn: 'Månadslön', antal: null, pris: null, belopp: sats.manadslon },
    { namn: 'Grundpeng övertid', antal: r2(t.overtid), pris: timBas, belopp: r2(t.overtid) * timBas },
    { namn: 'Övertidsersättning', antal: r2(t.overtid), pris: timOtTillagg, belopp: r2(t.overtid) * timOtTillagg },
    { namn: 'OB-tillägg vardag', antal: r2(t.ob.kvallNatt), pris: sats.obVardag, belopp: r2(t.ob.kvallNatt) * sats.obVardag },
    { namn: 'OB-tillägg helg', antal: r2(t.ob.helg), pris: sats.obHelg, belopp: r2(t.ob.helg) * sats.obHelg },
    { namn: 'OB-tillägg storhelg', antal: r2(t.ob.storhelg), pris: sats.obStorhelg, belopp: r2(t.ob.storhelg) * sats.obStorhelg },
    { namn: 'Inställelseersättning vardag', antal: t.installVardag, pris: sats.installVardag, belopp: t.installVardag * sats.installVardag },
    { namn: 'Inställelseersättning helg', antal: t.installHelg, pris: sats.installHelg, belopp: t.installHelg * sats.installHelg },
    { namn: 'Frånvaroavdrag', antal: r2(t.franvaroTim), pris: -timBas, belopp: -r2(t.franvaroTim) * timBas },
  ].filter(r => r.belopp !== 0);

  const brutto = rader.reduce((s, r) => s + r.belopp, 0);
  const skatt = raknaSkatt(brutto, sats);
  const fack = raknaFack(brutto, sats);
  const netto = brutto - skatt - fack;

  return { timmar: t, rader, brutto, skatt, fack, netto, timBas, timOtTillagg };
}

/** Fackavgift: en procent av bruttolönen, med golv och tak. Avrundas till hel krona. */
function raknaFack(brutto, sats) {
  if (sats.fackPa === false || brutto <= 0) return 0;
  const belopp = brutto * (sats.fackProcent ?? 0) / 100;
  const golv = sats.fackMin ?? 0;
  const tak = sats.fackMax ?? Infinity;
  return Math.round(Math.min(Math.max(belopp, golv), tak));
}

/**
 * Preliminärskatt. Skatteverkets tabell används när den är inläst, annars
 * interpoleras det linjärt mellan punkter du matat in från egna lönespecar.
 */
export function raknaSkatt(brutto, sats) {
  const frånTabell = tabellskatt(brutto, sats.skattetabell);
  if (frånTabell !== null) return frånTabell;
  return interpolera(brutto, sats.skattPunkter);
}

/** Linjär interpolation mellan kända punkter. Reserv när tabellen saknas. */
export function interpolera(brutto, punkter) {
  if (!punkter || punkter.length === 0) return 0;
  const p = [...punkter].sort((a, b) => a[0] - b[0]);
  if (brutto <= p[0][0]) return Math.round(brutto * (p[0][1] / p[0][0]));
  const sista = p[p.length - 1];
  if (brutto >= sista[0]) {
    if (p.length < 2) return Math.round(brutto * (sista[1] / sista[0]));
    const fore = p[p.length - 2];
    const k = (sista[1] - fore[1]) / (sista[0] - fore[0]);
    return Math.round(sista[1] + (brutto - sista[0]) * k);
  }
  for (let i = 0; i < p.length - 1; i++) {
    if (brutto >= p[i][0] && brutto <= p[i + 1][0]) {
      const k = (p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]);
      return Math.round(p[i][1] + (brutto - p[i][0]) * k);
    }
  }
  return 0;
}
