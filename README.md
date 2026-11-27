# best-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/hhsan666/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/hhsan666/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Skerrywind — Island Air Courier** is an original flight game for desktop browsers. You fly the
Saltrunner SR-2, a two-seat courier aircraft, over the Skerrywind Isles: a seeded archipelago with
the snow-capped Cairnhold range, the Silverrun river canyon, farmland, three towns, a lighthouse and
two airfields. Everything is drawn by a small hand-written WebGL2 renderer and every sound is
synthesised with Web Audio; the game loads no library, font or file from the network.

- **Flight model**: six degrees of freedom, lift up to a sharp stall, induced drag and ground
  effect, control authority that scales with airspeed and propeller wash, wheel springs, brakes and
  nose-wheel steering, fuel burn, and damage that degrades lift, thrust and control.
- **Missions**: *First Light* (take off, seven harbour rings, land), *Silverrun Gates* (a timed
  canyon run), *Mail to Ostmere* (a fuel-tight crossing into a headwind), *Squall Final* (a gusty
  crosswind landing), *Lantern Run* (dusk rings and a night landing), and *Free Flight*.
- **Sortie card**: each mission's steps as a checklist, a running score (rings threaded near their
  centre score more), the par time, and the fuel the rest of the route needs at your ground speed
  set against what is left in the tank at the present throttle. Your best run is saved: each ring
  then calls out your split against it, and briefings list the medal scores to aim for.
- **Landings are graded** on sink rate, centreline, touchdown point and bank, with a working PAPI
  beside each runway, and the results card plots the touchdown and rollout on the runway; crashes
  say what happened ("The gear collapsed: touchdown at 960 ft/min").
- **Cockpit**: airspeed, altitude and heading tapes, a flight-path marker, a moving map that
  draws the route still to fly (the next rings, then the field), and a backlit panel of six
  gauges (airspeed, attitude, altimeter, heading with course needle, vertical speed, RPM and
  fuel). Chase, wing-chase, cockpit and orbit cameras.

Controls: W/S pitch, A/D roll, Q/E rudder, R/F or mouse wheel throttle, G/T flaps, B or Space
brakes, C camera, L landing light, Esc pause. Click the view to fly with the mouse.

## Run it

```sh
node serve.ts          # then open http://localhost:8080 in desktop Chrome
# hand-in output (what the bounty's grader runs):
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are captured from the game itself with
`node tools/capture-shots.mjs` (headless Chromium, staged scenes of real missions).

Source layout: `game/src/world` (archipelago generator, forests, towns, sky presets),
`game/src/flight` (flight dynamics, landing gear, powerplant, damage), `game/src/missions`
(catalogue, ring courses, director, landing grader), `game/src/render` (WebGL renderers),
`game/src/hud` (HUD, instrument panel, moving map), `game/src/audio`, `game/src/input`,
`game/src/ui`. Licensed MIT.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
