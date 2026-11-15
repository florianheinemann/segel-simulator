# Segel-Simulator

Ein kleiner 3D-Trainer für die Segelintuition aus Sicht des Rudergängers einer
Fahrtenyacht (Sloop, ein mittiges Ruder, Radsteuerung). Läuft komplett im
Browser, ist auf das iPhone im Querformat ausgelegt und lässt sich zum
Home-Bildschirm hinzufügen.

**Lernziele**

1. Verklicker und Windfäden lesen und richtig darauf reagieren.
2. Wende und Halse Schritt für Schritt in der Rolle des Skippers fahren.

## Was die App zeigt

| Element | Bedeutung |
| --- | --- |
| 3D-Sicht | Blick vom Steuerstand nach vorn; der Rudergänger sitzt in Luv. Über die See ziehen = umsehen; der Blick bleibt stehen, „Blick voraus“ schwenkt zurück. |
| Lupe „Verklicker“ | Blick vom Steuerstand hoch zum Masttopp. Der Pfeil zeigt in den **scheinbaren** Wind, die roten Marken stehen fest. Der Bug liegt im Bild unten – so, wie man es beim Hochschauen sieht; die Marke „vorn“ zeigt die Richtung. |
| Lupe „Fäden“ | Windfäden an der Fock (Bb rot, Stb grün); Antippen wechselt zu den Achterliekfäden am Groß. |
| Instrumente | Kompasskurs, Fahrt durchs Wasser (FdW), scheinbarer Wind, Krängung, GPS (KüG/FüG). |
| Rad | Schieber, der stehen bleibt, wo man ihn loslässt – so sieht man, wie viel Ruder man gegen die Luvgierigkeit hält. Die Knöpfe daneben legen je 1° nach Bb/Stb. |
| Pause / Zeitlupe | ⏸ hält die Simulation an, „1×“ schaltet auf halbe und viertel Geschwindigkeit – praktisch zum Üben der Manöver. |
| Schoten | „fieren“ / „dicht“ für Groß und Fock, gedrückt halten (ab Stufe 2). |
| Draufsicht | Lernhilfe: Boot von oben mit scheinbarem (blau) und wahrem Wind (gestrichelt), Segelstellung, Ruder, Strom. Abschaltbar. |
| Hinweiszeile | Lernhilfe: Kurs zum Wind, Bug und ein Trimm-Tipp. Abschaltbar. |

## Wende und Halse

„Kommandos“ öffnet die Tafel mit allen Kommandos. Sie ist immer dieselbe – man
muss das richtige Kommando zur richtigen Zeit geben. Die Crew antwortet und
arbeitet nur auf Kommando. Passt die Lage nicht (falscher Kurs, zu wenig
Fahrt), gibt es beim Anwählen eine Warnung mit dem Grund.

| Wende (vom Am-Wind-Kurs, mit Fahrt) | Halse (vom Raumschotskurs) |
| --- | --- |
| „Klar zur Wende!“ – Crew: „Ist klar!“ | „Klar zur Halse!“ – Crew: „Ist klar!“ |
| „Ree!“ und anluven, durch den Wind drehen | abfallen bis fast vor den Wind, „Fier auf die Schoten!“ |
| Bug ist durch den Wind: „Über die Fock!“ | „Hol dicht die Großschot!“ – Crew: „Großschot ist dicht!“ |
| auf neuen Am-Wind-Kurs abfallen, Ruder stützen | „Rund achtern!“ und mit dem Heck durch den Wind |
| | Baum ist über: „Fier auf die Großschot!“, dann „Über die Fock!“ |

Mit der Option „Schoten im Manöver selbst bedienen“ (Menü, ab Stufe 2) sagt die
Crew nur an: Großschot dichtholen und fieren macht man selbst, und nach „Über
die Fock!“ ist die Schot los und muss dichtgeholt werden.

Was schiefgehen kann: Ohne „Über die Fock!“ steht die Fock back und bremst. Mit
zu wenig Fahrt verhungert die Wende im Wind. Kommt der Baum bei gefierter
Großschot über, ist es eine Patenthalse. Nach dem Manöver zeigt eine kurze
Auswertung Dauer, Fahrtverlust und Fehler. Mit eingeschalteten Trimm-Hinweisen
nennt die Hinweiszeile jeweils den nächsten Schritt.

## Kursmodus

„Kurs abfahren“ im Menü legt vier Tonnen im Viereck aus, ausgerichtet am Wind:

1. **Luvtonne**, 450 m genau in Luv – aufkreuzen mit Wenden.
2. **Tonne 2**, 350 m querab – Halbwind, Kurs halten.
3. **Leetonne**, 450 m genau in Lee – raumschots mit Halse.
4. **Ziel** am Startpunkt – Halbwind zurück.

Eine Tonne gilt als erreicht, wenn man näher als 40 m herankommt. Oben links
stehen Peilung, Entfernung und Zeit, im Bild sitzt eine Marke über der nächsten
Tonne, in der Draufsicht ein oranger Punkt. Weil die Tonnen fest im Grund
stehen, sieht man an ihnen Abdrift und Strom: Der Bug zeigt nicht dorthin,
wohin das Boot wirklich läuft (Kompass gegen KüG). Am Ziel gibt es eine
Auswertung mit Zeit, Strecke und Manövern.

## Stufen

| Stufe | Du machst | Dazu kommt |
| --- | --- | --- |
| 1 · Steuern | Steuern und Kommandos geben, die Crew trimmt | Verklicker, Fäden, Kurse zum Wind, Manöver |
| 2 · Trimmen | Schoten selbst bedienen | Volle Luvgierigkeit |
| 3 · Revier | Wie 2 | Böen (dunkle Flecken auf dem Wasser) und 1 kn Strom |

Wind (Standard 4 Bft), Windrichtung, Strom und Böen sind im Menü (☰) frei
einstellbar. Die Küste mit ihren Landmarken (Leuchtturm, Kirche, Windräder,
Funkmast) liegt rund 7 km entfernt. Wer ihr auf etwa die Hälfte nahekommt, wird
in die Reviermitte zurückgesetzt.

## Auf dem iPhone installieren

1. Die Seite in Safari öffnen.
2. „Teilen“ → „Zum Home-Bildschirm“.
3. Vom Home-Bildschirm starten und das iPhone quer halten.

Die App läuft dann im Vollbild und nach dem ersten Laden auch offline.

**Aktualisierung:** Die App prüft beim Start und jedes Mal, wenn sie aus dem
Hintergrund zurückkommt, ob online ein neuerer Build liegt (`version.json`), und
lädt sich dann selbst neu. Ohne Verbindung läuft die zuletzt geladene Version
weiter. Welche Version läuft, steht im Menü (☰) neben dem Titel.

Wer Icon oder Startbild ändert, muss die App vom Home-Bildschirm löschen und neu
hinzufügen – iOS übernimmt beides nur beim Hinzufügen.

## Modell (vereinfacht)

- Scheinbarer Wind aus wahrem Wind, Strom und Bootsbewegung.
- Je Segel ein Anstellwinkel aus Windeinfall und Schotstellung; daraus Vortrieb
  und Querkraft (Auftrieb/Widerstand), Killen und Strömungsabriss.
- Krängung aus der Querkraft, Abdrift nach Lee, Rumpfwiderstand mit
  Rumpfgeschwindigkeit.
- Reffen in zwei Stufen (Menü): weniger Segelfläche und tieferer Druckpunkt.
- Luvgierigkeit aus Krängung und Segelbalance (Groß luvgierig, Fock leegierig).
- Patenthalse, wenn der Wind bei gefiertem Groß von Lee einfällt.
- Wellen sind nur Optik.

Die Physik liegt in `src/sim.ts` (ohne Rendering, mit Tests in
`src/sim.test.ts`), die Manöverlogik in `src/maneuver.ts` (Tests in
`src/maneuver.test.ts`), der Kursmodus in `src/course.ts`, die 3D-Szene in `src/scene.ts`, die Bedienung in
`src/main.ts`, Offline-Cache und Aktualisierung in `src/pwa.ts` und
`public/sw.js`. Icons und Startbilder erzeugt `node scripts/gen-assets.cjs` aus
`public/icon.svg` (braucht Playwright).

## Entwicklung

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

Technik: TypeScript, Vite, three.js. Kein Backend. Deployment per GitHub Actions
auf GitHub Pages (`.github/workflows/deploy.yml`); dafür muss in den
Repository-Einstellungen unter *Pages* als Quelle „GitHub Actions“ gewählt sein.

## Versionierung

SemVer, Änderungen stehen in [CHANGELOG.md](CHANGELOG.md). Die Version wird im
Menü angezeigt.

## Fahrplan

Die ursprünglich geplanten Punkte sind umgesetzt. Ideen für später: weitere
Kurse, Mann-über-Bord-Manöver, Anlegen unter Segeln, andere Boote mit
Ausweichregeln.
