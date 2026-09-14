#!/usr/bin/env node
/**
 * Bygger skattetabell.json från Skatteverkets textfil.
 *
 *   node verktyg/bygg-skattetabell.mjs allmanna-tabeller-manad.txt 34 1
 *
 * Filen hämtas från Skatteverkets tekniska beskrivning för skattetabeller,
 * "Månadslön txt". Byt fil en gång per år.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tolkaTabellfil, tabellskatt } from '../skattetabell.js';

const [fil, tabellArg, kolumnArg] = process.argv.slice(2);
if (!fil) {
  console.error('Ange filen: node verktyg/bygg-skattetabell.mjs <fil.txt> [tabell] [kolumn]');
  process.exit(1);
}

const tabellnummer = Number(tabellArg) || 34;
const kolumn = Number(kolumnArg) || 1;

const tabell = tolkaTabellfil(readFileSync(fil, 'latin1'), tabellnummer, kolumn);
writeFileSync('skattetabell.json', JSON.stringify(tabell));

const storlek = (JSON.stringify(tabell).length / 1024).toFixed(1);
console.log(`Tabell ${tabellnummer}, kolumn ${kolumn}: ${tabell.belopp.length} belopps-steg och ${tabell.procent.length} procentsteg, ${storlek} kB.`);

// Kontroll mot kända punkter, om du anger dem som BRUTTO:SKATT
const facit = process.env.FACIT?.split(',').map(p => p.split(':').map(Number)) || [];
let fel = 0;
for (const [brutto, skatt] of facit) {
  const raknat = tabellskatt(brutto, tabell);
  const ok = raknat === skatt;
  if (!ok) fel++;
  console.log(`  ${brutto} kr → ${raknat} kr (förväntat ${skatt}) ${ok ? 'stämmer' : 'AVVIKER'}`);
}
if (fel) process.exit(1);
