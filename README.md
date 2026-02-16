# 20h Studenten-Tracker (Unraid Docker App)

Eine einfache Web-App mit visueller Oberfläche, um pro Woche Arbeitszeiten einzutragen und den **6-Wochen-Durchschnitt** zu prüfen (Limit: 20h/Woche im Durchschnitt).

## Features

- Wochenweise Eintragung (Montag + Stunden + Notiz)
- Automatisches Update bei bereits vorhandener Woche
- Live-Auswertung des 6-Wochen-Schnitts
- Statusanzeige: innerhalb oder über 20h
- JSON-Datei als persistente Datenspeicherung (`data/weeks.json`)

## Lokal starten

```bash
node server.js
```

Dann öffnen: `http://localhost:8080`

## Docker

```bash
docker build -t student-hours-tracker:latest .
docker run -d \
  --name student-hours-tracker \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  student-hours-tracker:latest
```

## Unraid: So lädst du die App in Docker

### Variante A (empfohlen): direkt über Unraid UI mit eigenem Image

1. **Projekt auf Unraid ablegen**
   - z. B. unter: `/mnt/user/appdata/student-hours-tracker`
   - stelle sicher, dass dort diese Dateien liegen (`Dockerfile`, `server.js`, `web/`, `data/` ...).

2. **Image bauen** (im Unraid Terminal):
   ```bash
   docker build -t student-hours-tracker:latest /mnt/user/appdata/student-hours-tracker
   ```

3. **Container in Unraid anlegen**
   - Unraid Web UI → **Docker** → **Add Container**
   - **Name**: `student-hours-tracker`
   - **Repository**: `student-hours-tracker:latest`
   - **Network Type**: `bridge`

4. **Port hinzufügen**
   - Host Port: `8080`
   - Container Port: `8080`
   - Type: `TCP`

5. **Pfad/Volume hinzufügen**
   - Host Path: `/mnt/user/appdata/student-hours-tracker/data`
   - Container Path: `/app/data`
   - Dadurch bleiben deine Einträge nach Neustarts erhalten.

6. **Container starten** und aufrufen
   - URL: `http://<UNRAID-IP>:8080`

### Variante B: mit docker-compose (falls Compose Manager Plugin genutzt wird)

Im Projektordner:

```bash
docker compose up -d --build
```

Danach öffnen: `http://<UNRAID-IP>:8080`

## Update auf neue Version

Wenn du später Änderungen aus Git ziehst:

```bash
cd /mnt/user/appdata/student-hours-tracker
git pull
docker build -t student-hours-tracker:latest .
docker rm -f student-hours-tracker
# Danach in Unraid Docker UI wieder starten oder neu anlegen
```

## API

- `GET /api/weeks` – listet alle Wochen
- `POST /api/weeks` – legt an oder aktualisiert (selber Montag)
- `DELETE /api/weeks/:id` – löscht einen Eintrag
- `GET /api/stats` – liefert den Durchschnitt der letzten 6 Wochen
