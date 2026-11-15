# Segel-Simulator

Ein kleiner 3D-Trainer für die Segelintuition aus Sicht des Rudergängers einer
Fahrtenyacht (Sloop, ein mittiges Ruder, Radsteuerung). Läuft komplett im
Browser, ist auf das iPhone im Querformat ausgelegt und lässt sich zum
Home-Bildschirm hinzufügen.

**Lernziele**

1. Verklicker und Windfäden lesen und richtig darauf reagieren.
2. Wende und Halse Schritt für Schritt in der Rolle des Skippers fahren
   (Kommandos folgen in v0.2).

## Was die App zeigt

| Element | Bedeutung |
| --- | --- |
| 3D-Sicht | Blick vom Steuerstand nach vorn; der Rudergänger sitzt in Luv. Über die See ziehen = umsehen. |
| Lupe „Verklicker“ | Blick vom Steuerstand hoch zum Masttopp. Der Pfeil zeigt in den **scheinbaren** Wind, die roten Marken stehen fest. Der Bug liegt im Bild unten – so, wie man es beim Hochschauen sieht. |
| Lupe „Fäden“ | Windfäden an der Fock (Bb rot, Stb grün); Antippen wechselt zu den Achterliekfäden am Groß. |
| Instrumente | Kompasskurs, Fahrt durchs Wasser (FdW), scheinbarer Wind, Krängung, GPS (KüG/FüG). |
| Rad | Schieber, der stehen bleibt, wo man ihn loslässt – so sieht man, wie viel Ruder man gegen die Luvgierigkeit hält. |
| Schoten | „fieren“ / „dicht“ für Groß und Fock, gedrückt halten (ab Stufe 2). |
| Draufsicht | Lernhilfe: Boot von oben mit scheinbarem (blau) und wahrem Wind (gestrichelt), Segelstellung, Ruder, Strom. Abschaltbar. |
| Hinweiszeile | Lernhilfe: Kurs zum Wind, Bug und ein Trimm-Tipp. Abschaltbar. |

## Stufen

| Stufe | Du machst | Dazu kommt |
| --- | --- | --- |
| 1 · Steuern | Nur steuern, die Crew trimmt | Verklicker, Fäden, Kurse zum Wind |
| 2 · Trimmen | Schoten selbst bedienen | Volle Luvgierigkeit |
| 3 · Revier | Wie 2 | Böen (dunkle Flecken auf dem Wasser) und 1 kn Strom |

Wind (Standard 4 Bft), Windrichtung, Strom und Böen sind im Menü (☰) frei
einstellbar. Die Küste mit ihren Landmarken (Leuchtturm, Kirche, Windräder,
Funkmast) liegt rund 7 km entfernt. Wer ihr auf etwa die Hälfte nahekommt, wird
in die Reviermitte zurückgesetzt.

## Modell (vereinfacht)

- Scheinbarer Wind aus wahrem Wind, Strom und Bootsbewegung.
- Je Segel ein Anstellwinkel aus Windeinfall und Schotstellung; daraus Vortrieb
  und Querkraft (Auftrieb/Widerstand), Killen und Strömungsabriss.
- Krängung aus der Querkraft, Abdrift nach Lee, Rumpfwiderstand mit
  Rumpfgeschwindigkeit.
- Luvgierigkeit aus Krängung und Segelbalance (Groß luvgierig, Fock leegierig).
- Patenthalse, wenn der Wind bei gefiertem Groß von Lee einfällt.
- Wellen sind nur Optik.

Die Physik liegt in `src/sim.ts` (ohne Rendering, mit Tests in
`src/sim.test.ts`), die 3D-Szene in `src/scene.ts`, die Bedienung in
`src/main.ts`.

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

- **v0.2** – Wende und Halse mit Kommandos nach SKS-Lehrbuch („Klar zur
  Wende!“ – „Ist klar!“ – „Ree!“ …), Warnung bei falscher Ausgangslage,
  Auswertung nach dem Manöver, Crew-Arbeit an den Schoten.
- **v0.3** – Kursmodus mit Tonnen zum Üben von Wenden, Halsen und Kurshalten.
- Später: Pause/Zeitlupe als Schaltfläche, Reffen.
