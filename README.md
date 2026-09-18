# GANPATI: VIGHNA — A Game by AQX

A cinematic 3D Indian festival adventure built with **Three.js** and **Web Audio**. Mobile-first, deployable to Vercel, runnable from `npm run dev` or any static host.

This is a complete playable vertical slice (not a prototype): intro cinematic → festival exploration → time-freeze event → Ganesh reveal → temple puzzle → Mooshak switching → parkour → Vighna Break → Kaal-Vighna boss → riverfront ending → AQX end card.

---

## Quick start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173/)
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview the production build (http://localhost:4173/)
npm run preview
```

Open `http://localhost:5173/` (dev) or `http://localhost:4173/` (preview) in your browser. On desktop, use Chrome with DevTools mobile emulation, or just use a real phone on your local network (Vite's `--host` flag is enabled).

---

## Deploy to Vercel

The project is **Vercel-ready**. No backend, no Python, no Blender — pure static frontend.

### Option A — via Vercel dashboard

1. Push this repository to GitHub.
2. Go to <https://vercel.com/new> and import the repo.
3. Vercel auto-detects Vite. Use these settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   - **Install command**: `npm install`
4. Click **Deploy**. The Vercel URL will open the game directly.

### Option B — via Vercel CLI

```bash
npm install -g vercel
vercel            # link the project (one-time)
vercel --prod     # deploy to production
```

A `vercel.json` is included with the correct framework, output directory, and SPA rewrites so deep links and refreshes work.

---

## Project structure

```
ganesh_vighna/
├── index.html              # Game entry point (root URL loads this)
├── package.json            # npm deps + scripts
├── vite.config.js          # Vite config (relative base, public dir)
├── vercel.json              # Vercel deployment config
├── .gitignore               # Ignores node_modules, dist, etc.
├── README.md
├── public/
│   └── assets/             # All game assets (copied verbatim to dist/)
│       ├── ganesh/         # ganesh_hero.glb + LOD1 + LOD2 + fallback
│       ├── mooshak/        # mooshak.glb
│       ├── modak/          # modak.glb
│       └── villain/        # kaal_vighna.glb
├── src/
│   ├── main.js             # Entry point (boots Game on DOMContentLoaded)
│   ├── core/
│   │   ├── Game.js         # Game class, state machine, render loop
│   │   ├── AssetManager.js # Async GLB loader + caching + fallbacks
│   │   ├── AudioManager.js # Web Audio synthesized rain/bells/SFX
│   │   ├── PerformanceManager.js # 3 quality tiers + auto-detect
│   │   └── SaveSystem.js   # localStorage settings + progression
│   ├── camera/
│   │   └── CameraManager.js # 8 camera modes + cinematic keyframes
│   ├── player/
│   │   ├── HeroCharacter.js     # Ganesh GLB abstraction (11 anim clips + ability)
│   │   ├── MooshakCharacter.js  # Procedural mouse vāhana
│   │   └── CharacterController.js # Touch + keyboard movement
│   ├── world/
│   │   └── FestivalCity.js # Connected district: street, mandap, temple, rooftops, riverfront
│   ├── gameplay/
│   │   ├── VighnaSystem.js # Time-freeze + Vighna Break cinematic
│   │   ├── PuzzleSystem.js # Temple diya puzzle (4-step sequence)
│   │   ├── BossSystem.js   # Kaal-Vighna boss (3 mechanisms)
│   │   ├── QuestSystem.js  # 13-chapter flow
│   │   └── MemorySystem.js # World-remembers callbacks
│   ├── effects/
│   │   ├── RainSystem.js      # GPU-friendly rain + splash particles
│   │   ├── ParticleSystem.js  # 7 presets (petals, divine, vighna, etc.)
│   │   ├── VFXManager.js      # Energy rings, god-rays, screen flashes
│   │   ├── WaterSystem.js     # Animated shader river + floating diyas
│   │   └── PostProcess.js     # Bloom + color grading + vignette + grain
│   ├── ui/
│   │   ├── HUD.js             # In-game HUD
│   │   ├── TouchControls.js   # Virtual joystick
│   │   ├── Menu.js            # Main menu / settings / credits
│   │   └── OrientationPrompt.js
│   ├── scenes/
│   │   ├── BootScene.js       # Boot logo + loading bar
│   │   ├── IntroScene.js      # Cinematic intro
│   │   ├── FestivalScene.js   # Main playable scene
│   │   └── EndingScene.js     # Riverfront ending + AQX end card
│   └── utils/
│       └── Helpers.js         # Math, easing, mobile detection
└── style.css               # Premium cinematic game UI
```

---

## Controls

### Mobile (touch — primary)
- **Virtual joystick** (left half of screen): move the character
- **Swipe up**: jump
- **Swipe down**: dash forward
- **Swipe left / right**: dodge
- **Tap**: interact (with diya / bell / mechanism / shortcut)
- **★ Ability button** (bottom-right): trigger Divine Ability (breaks nearby Vighna)
- **⇋ Switch button** (bottom-right): swap between Ganesh and Mooshak
- **Pause button** (top-right)

### Desktop (keyboard — fallback)
- **W A S D / Arrow keys**: move
- **Space**: jump
- **Shift**: run

### Orientation
- **Landscape** is primary. Portrait shows a "Rotate your device" prompt.

---

## Quality settings

In **Settings**, you can choose:

| Tier | Pixel ratio | Shadows | Particles | NPC cap | Notes |
|------|------------|---------|-----------|---------|-------|
| **Performance** | 1.0 | off | 200 | 12 | Low-end phones |
| **Balanced** (default) | 1.5 | on (1024) | 500 | 20 | Most devices |
| **Ultra** | 2.0 | on (2048) | 1000 | 30 | Desktop / high-end |

Auto-detection picks Balanced or Performance based on `navigator.hardwareConcurrency`. If FPS drops below 25 on mobile, it auto-downgrades from Balanced to Performance.

---

## Game flow (vertical slice)

```
BOOT → LOADING → MENU → INTRO (cinematic)
  → FESTIVAL exploration (control Ganesh)
  → TIME-FREEZE event
  → GANESH REVEAL
  → Player control begins
  → Reach the MANDAP
  → TEMPLE puzzle (light diyas in correct order using wall-clue)
  → MOOSHAK tunnel + character switching
  → ROOFTOP parkour
  → First VIGHNA BREAK
  → Approach BOSS ARENA
  → KAAL-VIGHNA boss (activate 3 mechanisms)
  → Major Vighna Break (boss dissolves)
  → RIVERFRONT walk
  → ENDING cinematic
  → AQX END CARD
```

Total playable time: ~5–10 minutes.

---

## Asset information

All 3D models are GLB files generated procedurally by Blender Python scripts. No third-party 3D assets are shipped.

All audio is synthesized at runtime via the Web Audio API. No commercial recordings are used.

**Ganesh hero**: `public/assets/ganesh/ganesh_hero.glb` (1.6 MB, 72k tris, 35 bones, 11 animation clips). Two LOD variants are included for distance-based swapping. A `ganesha_fallback.glb` is loaded if the new hero GLB fails.

The `HeroCharacter.js` abstraction means you can drop in a hand-sculpted GLB later without touching any gameplay code — just replace the file at `public/assets/ganesh/ganesh_hero.glb`.

---

## Error handling

- GLB load failures fall back to `ganesha_fallback.glb` for the hero. Other GLBs fail silently (the game continues without that prop).
- Audio init failures disable audio gracefully (the game continues without sound).
- The loading screen has a timeout — if assets take too long, a helpful message appears instead of an infinite spinner.
- Optional assets (LOD1/LOD2) failing does not break the game — the hero just uses LOD0 always.
- Resize and orientation changes are handled live.

---

## Troubleshooting

### "Directory listing" appears at root URL
This shouldn't happen — `index.html` is at the project root. Make sure you're running `npm run dev` or `npm run preview` from the project directory, not a parent folder.

### Blank page / infinite spinner
- Check the browser console (F12). The most common cause is a failed CDN import or a 404 GLB.
- This project uses npm `three` (not CDN), so CDN outages can't break it.
- If a GLB fails, the AssetManager logs a warning and continues.

### Build fails with "Cannot find module 'three'"
Run `npm install` first. The `three` package is a dependency in `package.json`.

### Vercel deployment shows 404 on refresh
The included `vercel.json` has SPA rewrites that route everything to `/index.html`. If you still see 404s, make sure the Vercel project's **Output Directory** is set to `dist`.

### Mobile controls don't work
- Make sure you're in landscape orientation.
- The virtual joystick only activates when you touch the **left half** of the screen.
- Tap (not hold) for interactions.

### Game is too dark
Open **Settings → Quality → Ultra** for maximum brightness/quality. Or open **Settings** and toggle the debug overlay to see live FPS / triangle count.

---

## Performance notes

- **Bloom + color grading** runs as a post-processing pass via `EffectComposer`. On Performance tier, bloom is still enabled but with lower resolution.
- **Rain** uses a single `BufferGeometry` with recycled vertices — no per-frame allocations.
- **Particle systems** cap their max counts based on quality tier.
- **NPC count** is capped per tier (12 / 20 / 30).
- **Water shader** uses vertex displacement + cheap shimmer (no SSR cost).
- **Three.js r169** is bundled as a separate chunk (`three-BGmdsQQp.js`, ~564 KB) so it's cached separately from game code.

---

## License

© AQX. All code and assets are original works created for this game.

Built with reverence for Lord Ganesha and the Ganesh Chaturthi tradition.

> ॐ गं गणपतये नमः
