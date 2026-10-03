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
```

## Struttura
- `src/harp.ts`: accordatura Richter, tonalità, intavolatura (`4`, `-4`, `-3'`).
- `src/audio/`: YIN per l'altezza, `NoteTracker` per note stabili e attacchi, motore audio (microfono, voce del nemico, metronomo).
- `src/battle/logic.ts`: regole della battaglia senza grafica (testate in `tests/`).
- `src/content/enemies.ts`: nemici e frasi dell'area 1, scritti in intavolatura.
- `src/scenes/`: schermate Phaser (titolo, mappa, battaglia, risultato).
