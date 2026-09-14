# Skiftlön

PWA som räknar ut lönen utifrån skiftrotation, extratid och frånvaro. All data ligger i enheten, inget skickas någonstans.

## Kom igång

```bash
npx serve .
```

Öppna `http://localhost:3000`. Service worker och ES-moduler kräver en server — `file://` fungerar inte.

Publicera på https för att kunna installera appen: dra mappen till `app.netlify.com/drop`, eller lägg den i ett GitHub-repo och slå på Pages. Inget byggsteg behövs.

## Filer

| Fil | Innehåll |
|---|---|
| `avtal.js` | Tidsregler och löneberäkning. Fristående och testbar utan DOM. |
| `app.js` | Gränssnitt, lagring, stämpling. |
| `index.html` | Fyra vyer: kalender, lön, schema, inställningar. |
| `sw.js` | Offline-cache. |

## Beräkningen

Satserna är återräknade från lönespecar för juni, juli och augusti 2026 tills bruttolönen stämde på öret.

| Post | Formel | Vid 30 184 kr |
|---|---|---|
| Grundpeng övertid | månadslön / 175 | 172,48 kr/h |
| Övertidsersättning | månadslön / 420 | 71,87 kr/h |
| Frånvaroavdrag | månadslön / 175 | 172,48 kr/h |
| OB kväll och natt | fast belopp fr o m 1/4 2026 | 51,46 kr/h |
| OB helg | fast belopp | 80,15 kr/h |
| OB storhelg | fast belopp | 160,10 kr/h |
| Inställelseersättning | per tillfälle | 208 vardag / 266 helg |
| Fackavgift | 1,62 % av brutto, 255–701 kr | |

Timmarna avrundas till två decimaler innan de multipliceras, precis som lönesystemet gör. Därför blir två föräldralediga dagar 16,53 timmar och inte 16,54.

### Tidsgränser

Storhelg går före helg som går före kväll och natt.

- Kväll och natt: 18.00–06.00
- Helg: lördag 06.00 → måndag 06.00, samt 18.00 dagen före helgdag → 06.00 dagen efter
- Storhelg: nyårsafton 06.00 → 2 jan 06.00 · skärtorsdag 18.00 → tisdag efter påsk 06.00 · 1 maj 06.00 → 2 maj 06.00 · 6 juni 06.00 → 7 juni 06.00 · pingstafton 06.00 → måndag 06.00 · midsommarafton 06.00 → söndag 06.00 · julafton 06.00 → 27 dec 06.00

Påskdagen räknas ut med den anonyma gregorianska algoritmen.

### Frånvaro

Semester ger inget avdrag, månadslönen betalas ut som vanligt. Föräldraledig och vab drar passets timmar gånger månadslön/175.

## Stämpling

Kalendern har ett stämpelkort. På en schemalagd dag är stämplingen en bekräftelse utan löneeffekt. På en ledig dag blir tiden mellan in och ut ett extrapass, alltså övertid. Är en arbetsplats sparad kontrolleras avståndet innan stämplingen godkänns.

`?stampla=in` och `?stampla=ut` i adressen stämplar direkt vid start. Används med en ankomstautomation i Genvägar på iPhone.

## Kvar att göra

- Semestertillägg 0,8 % och engångsskatt
- Sjuklön med karensavdrag
- Skatt via Skatteverkets tabellfil i stället för interpolation mellan punkter
- Två övertidssatser om bilaga 2 i arbetstidsavtalet skiljer på enkel och kvalificerad övertid
