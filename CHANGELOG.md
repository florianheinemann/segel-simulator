# Changelog

## 0.2.1 – 2026-11-15

- Verklicker-Lupe besser lesbar: weiterer Ausschnitt mit Mast und Segelkopf,
  größerer Verklicker, Marke „vorn“ am Rand zeigt die Richtung zum Bug

## 0.2.0 – 2026-11-15

Wende und Halse mit Kommandos.

- Kommando-Tafel („Kommandos“) mit allen Kommandos; man muss das richtige zur
  richtigen Zeit wählen
- Wende: „Klar zur Wende!“ – „Ist klar!“ – „Ree!“ – „Über die Fock!“
- Halse: „Klar zur Halse!“ – „Fier auf die Schoten!“ – „Hol dicht die
  Großschot!“ – „Rund achtern!“ – „Fier auf die Großschot!“ – „Über die Fock!“
- Warnung, wenn ein Manöver aus der aktuellen Lage nicht gefahren werden kann
- Die Crew arbeitet nur auf Kommando: Die Fock bleibt belegt und steht nach der
  Wende back, bis „Über die Fock!“ kommt; nach der Halse steht sie als
  Schmetterling
- Auswertung nach dem Manöver: Dauer, Fahrtverlust, Fehler in der Reihenfolge,
  Patenthalse, verhungerte Wende
- Hinweiszeile nennt während des Manövers den nächsten Schritt (abschaltbar)
- Knopf „Blick voraus“ sitzt jetzt neben der Draufsicht

## 0.1.4 – 2026-11-15

- Knöpfe links und rechts vom Rad-Schieber: je Tipp 1° Ruder nach Bb bzw. Stb

## 0.1.3 – 2026-11-15

- Der Blick bleibt stehen, wo man ihn hingezogen hat; neuer Knopf „Blick voraus“
  schwenkt zurück

## 0.1.2 – 2026-11-15

- Behoben: Nach dem Drehen des iPhones (Start im Hochformat) blieb die obere
  Bildhälfte schwarz und das Bild war verzerrt

## 0.1.1 – 2026-11-15

Homescreen-App für das iPhone.

- Automatische Aktualisierung: Beim Start und bei jeder Rückkehr in die App wird
  geprüft, ob ein neuerer Build online ist, und dann neu geladen
- Service Worker neu: `index.html` immer frisch aus dem Netz, alte Caches werden
  gelöscht, alle Dateien werden schon beim ersten Besuch für offline gespeichert
- Startbilder für gängige iPhones (hoch und quer), Ladebild in der App
- Icons in 180, 192 und 512 px, Manifest ergänzt
- Bildschirm bleibt beim Segeln an (wo der Browser es unterstützt)
- Build-Kennung im Menü

## 0.1.0 – 2026-11-15

Erste Version.

- 3D-Sicht vom Steuerstand mit Krängung, Segeln, See, Küste und Landmarken
- Lupen für Verklicker und Windfäden (Fock / Groß)
- Physik: scheinbarer Wind, Trimm, Krängung, Abdrift, Luvgierigkeit, Strom, Böen, Patenthalse
- Rad als Schieber, Schoten zum Fieren und Dichtholen
- Instrumente: Kompass, FdW, scheinbarer Wind, Krängung, KüG/FüG
- Drei Stufen (Steuern, Trimmen, Revier), Lernhilfen abschaltbar
- Installierbar auf dem Home-Bildschirm, offline nutzbar nach dem ersten Laden
