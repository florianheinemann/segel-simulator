# Changelog

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
