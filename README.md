# Duello d'Ance

Gioco di battaglie musicali che insegna l'armonica diatonica ascoltando il microfono.
Design: `../design/game-design.md`.

## Giocare subito
Apri `duello-dance.html` (un unico file) con Chrome o Edge sul computer e consenti il microfono.
Senza armonica si gioca con la tastiera: tasti 1-0 = fori 1-10 soffiati, Q-P = fori 1-10 aspirati.

## Sviluppo
Serve Node.js 22 o più recente.

```
npm install
npm run dev        # server locale con ricarica automatica
npm test           # test della logica (armonica, ascolto, battaglia)
npm run typecheck
npm run build      # crea dist/index.html, un file unico apribile con doppio clic
npm run sync -- ..  # ricopia percorso didattico, grafica e audio dalla cartella del progetto
```

`npm test` prova anche il rilevatore sulle registrazioni vere di `tests/campioni` del progetto
(variabile `CAMPIONI` per un'altra cartella; il test si salta se non le trova).

## Struttura
- `src/harp.ts`: accordatura Richter, tonalità, intavolatura (`4`, `-4`, `-3'`).
- `src/audio/`: YIN per l'altezza, `NoteTracker` per note stabili e attacchi, motore audio (microfono, voce del nemico, metronomo).
- `src/battle/logic.ts`: regole della battaglia senza grafica (testate in `tests/`).
- `src/content/area1.ts`: nemici e frasi dell'area 1, letti da `percorso.json` (copiato da `content/` del progetto).
- `src/style/` e `src/assets/`: audio, tema e grafica copiati da `style/` del progetto. Non modificarli qui.
- `src/scenes/`: schermate Phaser (titolo, mappa, battaglia, risultato).
