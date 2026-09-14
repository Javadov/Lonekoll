/**
 * Preliminärskatt genom uppslagning i Skatteverkets allmänna månadstabell.
 *
 * Tabellen byggs från `allmanna-tabeller-manad.txt` med verktyg/bygg-skattetabell.mjs
 * och ser ut så här:
 *
 *   { tabell: 34, kolumn: 1, ar: 2026,
 *     belopp:  [[till, skatt], ...],     // kronbelopp per inkomstintervall
 *     procent: [[till, procent], ...] }  // för inkomster över tabellens sista belopp
 *
 * Intervallen är sorterade och sammanhängande, så uppslagningen är en binärsökning
 * på den övre gränsen. Sista procentsteget har `till: null` och gäller uppåt.
 */

/** Skatteavdrag för en månadsinkomst. Returnerar null om tabellen inte täcker beloppet. */
export function tabellskatt(brutto, tabell) {
  if (!tabell || !tabell.belopp?.length) return null;
  const inkomst = Math.round(brutto);
  if (inkomst < 1) return 0;

  const rad = sok(tabell.belopp, inkomst);
  if (rad) return rad[1];

  const pRad = sok(tabell.procent || [], inkomst);
  if (pRad) return Math.round(inkomst * pRad[1] / 100);

  return null;
}

/** Binärsökning på övre gräns. En gräns som är null betyder "och uppåt". */
function sok(steg, inkomst) {
  let lag = 0, hog = steg.length - 1;
  while (lag <= hog) {
    const mitt = (lag + hog) >> 1;
    const till = steg[mitt][0];
    if (till === null || inkomst <= till) {
      if (mitt === 0 || (steg[mitt - 1][0] !== null && inkomst > steg[mitt - 1][0])) return steg[mitt];
      hog = mitt - 1;
    } else {
      lag = mitt + 1;
    }
  }
  return null;
}

/**
 * Tolkar textfilen från Skatteverket. Fast kolumnbredd, 49 tecken per rad:
 * 1-2 konstant, 3 radtyp (B eller %), 4-5 tabellnummer,
 * 6-12 inkomst från, 13-19 inkomst till, 20-49 kolumn 1-6 om fem tecken var.
 */
export function tolkaTabellfil(text, tabellnummer, kolumn = 1) {
  const belopp = [], procent = [];
  const bortIndex = 19 + (kolumn - 1) * 5;

  for (const rad of text.split(/\r?\n/)) {
    if (rad.length < 49) continue;
    if (Number(rad.slice(3, 5)) !== tabellnummer) continue;

    const typ = rad[2];
    const tillText = rad.slice(12, 19).trim();
    const till = tillText === '' ? null : Number(tillText);
    const varde = Number(rad.slice(bortIndex, bortIndex + 5).trim());
    if (Number.isNaN(varde)) continue;

    (typ === '%' ? procent : belopp).push([till, varde]);
  }

  if (!belopp.length) {
    throw new Error(`Hittade inga rader för tabell ${tabellnummer} i filen.`);
  }
  return { tabell: tabellnummer, kolumn, belopp, procent };
}
