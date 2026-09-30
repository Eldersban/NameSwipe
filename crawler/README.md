# CRAWL — a Dungeon Crawler Carl fan game

A first-person dungeon-crawler RPG that runs in any desktop browser. Everything
(3D engine, pixel art, music, sound) is generated in code, so the whole game is
one HTML file with no downloads.

## Play

Open `build/crawl.html` in Chrome, Edge, or Firefox. Click to capture the mouse.

## Controls

| Key | Action |
| --- | --- |
| W A S D / Shift | Move / sprint |
| Mouse / Click | Look / attack |
| Right-click or F | Kick (knockback + stun) |
| R | Princess Donut's Magic Missile Barrage |
| 1–4 or wheel | Fists, club, crossbow, Hob-Lobbers |
| E or Space | Doors, chests, Mordecai, stairwell |
| Q | Drink a healing potion |
| Tab / C | Character sheet (spend stat points) |
| M | Map |
| Esc / P | Pause |

## The game

- Five procedurally generated floors, each with its own look, monsters, and a
  floor boss guarding the stairwell.
- Every floor has a collapse timer. Kill the boss, reach the stairs, descend.
- Start each floor in a Safe Room: heal, shop with Mordecai, open loot boxes.
- Level up and spend points on STR, CON, DEX, and CHA.
- 19 achievements with System AI commentary and loot box prizes.
- Princess Donut follows you and casts Magic Missile on her own.
- Progress saves at the start of each floor.

## Development

Source lives in `index.html` and `js/`. Rebuild the single-file game with:

```bash
python3 build.py
```

`build.py` writes `build/crawl.html` (standalone) and `build/crawl-artifact.html`
(no document skeleton, for hosting as a claude.ai artifact).

This is a non-commercial fan project. Dungeon Crawler Carl and its characters
belong to Matt Dinniman.
