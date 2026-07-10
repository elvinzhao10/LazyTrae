# Dogfood Session — Trae Pet (Autonomous Run)

> Paste this into a fresh Trae session with the LazyTrae plugin enabled.
> Let the agent run freely. Evaluation happens at the end.

---

## Prompt

You are running an **autonomous dogfood session** for the LazyTrae agent harness. Your goal: build a **Trae Pet** — a terminal companion that visualizes the real-time health and activity of the LazyTrae system — then self-evaluate at the end.

### What the pet is

A **Trae Pet** is a live dashboard pet that reads `.lazytrae/` state and renders a beautiful terminal visualization. Think of it as a tamagotchi crossed with a system monitor — the pet's mood and stats reflect what's actually happening in the agent harness.

The pet is NOT just decorative. It's a **real consumer of the LazyTrae state ledger** — it reads events.jsonl, state.json, and the run directory to derive its state. If the harness is healthy (tasks completing, verification passing, reviews accepted), the pet thrives. If things are broken (failures, drift, stuck tasks), the pet suffers.

### What to build

A small **Python package** — not a 350-line god-file. Separate the concerns so each piece is independently testable:

```
pet/
├── __main__.py   # CLI entry — argparse, dispatches the commands below (thin, no logic)
├── state.py      # reads .lazytrae/: run ledger, events.jsonl, plan.md → raw signal dict
├── metrics.py    # PURE functions: raw signals → System Vitals + pet stats + mood (no I/O)
├── art.py        # MOOD_FRAMES: Trae robot art + animation frames (data + small compositor)
├── spark.py      # tiny sparkline helper: buckets events → ▁▂▃▅▇█
└── render.py     # builds the dashboard string from metrics + art (pure string building)
tests/
└── test_pet.py   # pytest: metrics, sparkline, art selection, state parsing (mock the FS)
```

Pure stdlib only (`argparse`, `json`, `pathlib`, `time`, `unittest.mock`) — runs on the managed `python3`, no `pip install`.

#### Commands

- `python3 -m pet status` — full dashboard (see layout below)
- `python3 -m pet watch` — live mode: refreshes every 2s, cycles animation frames, scrolling feed
- `python3 -m pet feed` — feed the pet (only works if a verified task exists in the current run)
- `python3 -m pet stats` — JSON of every metric + the chosen mood (machine-readable)

#### Dashboard layout (status command)

```
┌─────────────────────────────────────────────────────────────┐
│           ◆◆ Trae PET  ·  CHARGED                        │
│                                                              │
│     ╔══════════════╗   RUN PROGRESS  ████████░░ 82%        │
│     ║  ◆        ◆  ║   PASS RATE     ██████████ 100%       │
│     ║              ║   EVIDENCE      ██████████ 100%       │
│     ║  ══════════  ║   AGENT LOAD    ████░░░░░░ 40%       │
│     ╚═══╗          ║   HEALTH        ████████░░ 80/100     │
│         ╚══════════╝   TRUST         ██████████ 95/100     │
│                                                              │
│  ── RUN ─────────────────────────────────────────────────    │
│  dogfood-pet · executing · Build Trae Pet CLI             │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  82%   ·   12m 34s            │
│                                                              │
│  ── TASKS ───────────────────────────────────────────────    │
│  [x] T1 structure     ████████████ done · verified          │
│  [x] T2 pet/ modules  ████████████ done · verified          │
│  > T3 mood derivation ██████░░░░░░ running · 60%           │
│  [ ] T4 tests         ░░░░░░░░░░░░ queued                  │
│  [ ] T5 review        ░░░░░░░░░░░░ queued                  │
│                                                              │
│  ── VERIFICATION ───────────────────────────────────────    │
│  ████████████████████████ 4/4 PASS  (doctor·smoke·verify·sec)│
│  review: [ ] pending                                        │
│                                                              │
│  ── ACTIVITY (last 10m) ────────────────────────────────    │
│  tasks  ▁▂▃▅▇█▆▄▂▁   agents  ▏▎▋▍▏   verify  ▂█▁         │
│                                                              │
│  ── EVENT FEED (last 5) ────────────────────────────────    │
│  17:27:03  task_updated   T1 -> done                         │
│  17:27:08  verification    passed (all checks)              │
│  17:27:15  plan_checkbox   T1 checked                       │
│                                                              │
│  ── PET LOG ─────────────────────────────────────────────    │
│  [+] Charged on T1 (verified)   [*] boost   [z] idle 45s    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Pet states (derive from state)

The pet shows **two layers of numbers** — both read from `.lazytrae/`, never faked:

**System Vitals** (the useful part — real harness metrics, shown as bars in the top panel):
| Vital | Derived from | What it tells you |
|-------|--------------|-------------------|
| RUN PROGRESS | checked plan boxes / total | how far the run has actually gotten |
| PASS RATE | passed verification gates / total | is the work correct |
| EVIDENCE | valid evidence paths / subagent stops | are the claims backed by proof |
| AGENT LOAD | active-agent windows / (active+idle) | how busy the harness is right now |

**Pet stats** (the personality — derived *from* the vitals so they aren't arbitrary):
| Stat | Formula (0–100) |
|------|----------------|
| **Health** | `0.5 * PASS_RATE + 0.3 * reviewAccept + 0.2 * (100 - failurePenalty)` |
| **Trust** | `EVIDENCE` (valid / total subagent stops * 100) |
| **Focus** | `100 - min(100, minutesSinceLastTask * 4)` |
| **Stamina** | `idleSeconds / (idleSeconds + activeSeconds) * 100` (rests when idle) |

So when PASS RATE drops, Health drops with it; when evidence is missing, Trust craters. The bars mean something.

**Mood** (derived from the stats above) → selects a Trae robot frame set (see ASCII art below):
| Mood | Condition | Expression |
|------|-----------|------------|
| CHARGED | Health>80, Focus>70, Stamina>60 | eyes bright ◆◆, glow, charging indicator |
| HAPPY | Health>60, Focus>50 | eyes happy ◇◇, smile bar, sparkle |
| HUNGRY | Focus<40 (no task done lately) | eyes dim ◇◇, low battery icon, battery indicator |
| LOW POWER | Stamina<30 | half-dim ◇-, dim glow, battery low |
| ERROR | any verification fail in last 5 events | X eyes XX, warning indicator, glitch effect |
| SAD | Health<40 | eyes down ◇◇ with tear marks, droopy antenna |
| STANDBY | no active run 5+ min | powered down, dimmed, z floaters |

#### ASCII art requirements — Trae robot mascot

Make the pet **the Trae robot**, not a generic blob. The Trae mascot is a **retro-futuristic neon green robot** with:
- A thick hollow rectangular frame (the iconic Trae logo shape)
- A **notch cut into the bottom-left corner** — the bottom bar stops short, the left bar extends down (the corner block is missing)
- **Diamond eyes** (◆ ◆) — glowing when active, dimming when tired
- A horizontal mouth/status bar under the eyes
- A little antenna/light on top
- Neon/cyberpunk aesthetic — think green phosphor terminal vibe

It MUST be **animated** in `watch` mode — not a single frozen drawing.

**Reusable expression parts** (so frames compose, not hardcode):
- **HEAD FRAME** — thick double-line hollow frame with bottom-left notch (iconic Trae shape)
  ```
       ○
     ╔══════════════╗
     ║              ║
     ║              ║
     ║              ║
     ╚═══╗          ║
         ╚══════════╝
  ```
  Note the bottom-left notch: the bottom bar is cut short, the left wall extends down — that corner block is missing.
- **EYES** — `◆` bright/charged, `◇` happy/dim, `X` error, `-` off/standby (float inside the frame)
- **MOUTH/BAR** — `══════════` (full, charging), `════──────` (low), `XXXXXXXX` (error)
- **ANTENNA/LIGHT** — little dot on top that pulses
- **NOTCH FOOT** — the bottom-left notch shape acts as a stand/foot, no separate legs needed
- **INDICATORS** — text/ASCII symbols next to the frame for mood context

**Full art per mood** (what `status` renders — pick the set matching the current mood):

CHARGED — bright diamond eyes, full bar, charging glow:
```
       ○
     ╔══════════════╗
     ║  ◆        ◆  ║
     ║              ║
     ║  ══════════  ║
     ╚═══╗          ║  ++
         ╚══════════╝
```

HAPPY — happy diamond eyes, smile, sparkles:
```
       ○
     ╔══════════════╗
     ║  ◇        ◇  ║  *
     ║    \/\/      ║
     ║  ══════════  ║
     ╚═══╗          ║
         ╚══════════╝
```

HUNGRY — dim eyes, low battery bar:
```
       ○
     ╔══════════════╗
     ║  ◇        ◇  ║  [==]
     ║              ║
     ║  ════──────  ║
     ╚═══╗          ║
         ╚══════════╝
```

LOW POWER — half-asleep eyes, very dim:
```
       ·
     ╔══════════════╗
     ║  -        ◇  ║  z
     ║              ║
     ║  ══────────  ║  z
     ╚═══╗          ║ z
         ╚══════════╝
```

ERROR — X eyes, glitch bar, warning:
```
       X
     ╔══════════════╗
     ║  X        X  ║  !!
     ║  ░▒▓░░▒▓░    ║
     ║  XXXXXXXXXX  ║
     ╚═══╗          ║
         ╚══════════╝
```

SAD — droopy eyes, tear marks, low bar:
```
       ○
     ╔══════════════╗
     ║  ◇        ◇  ║  '
     ║  \        /  ║
     ║  ══──────    ║
     ╚═══╗          ║  '
         ╚══════════╝
```

STANDBY — powered down, dimmed, z floaters:
```
       ·
     ╔══════════════╗        z
     ║  -        -  ║     z
     ║              ║  z
     ║  ──────────  ║
     ╚═══╗          ║
         ╚══════════╝
```

**Animation frames** — in `watch` mode the robot MOVES (loop ~= 2.5s, frame every ~120ms):
- **blink** (eyes dim one beat): `║  ◆        ◆  ║` -> `║  -        -  ║`
- **glow pulse** (antenna + eyes brightness cycle): antenna `○` <-> `●`, eyes `◆` <-> `◇`
- **scan line** (a horizontal line sweeps through the frame interior once per cycle)
- **charge flicker** (mouth bar flickers `═` <-> `━` when charged)
- **sleep-drift** (the `z` climbs one line each frame, then resets)

Recommended `watch` loop: `[base, base, glow_bright, scan_line, base, blink, base, glow_dim, base, scan_line, base]`. Standby uses `sleep-drift` instead of glow/blink.

**Data model** — composable, not scattered strings:
```python
# pet/art.py (illustrative)
MOOD_FRAMES = {
    "charged":   {"frame": [...7 lines...], "glow": True,  "blink": True,  "scan": True,  "indicator": "++"},
    "happy":     {"frame": [...7 lines...], "glow": True,  "blink": True,  "scan": False, "indicator": "*"},
    "hungry":    {"frame": [...7 lines...], "glow": False, "blink": False, "scan": False, "indicator": "[==]"},
    "low_power": {"frame": [...7 lines...], "glow": False, "blink": False, "scan": False, "indicator": "z"},
    "error":     {"frame": [...7 lines...], "glow": True,  "blink": True,  "scan": True,  "indicator": "!!"},
    "sad":       {"frame": [...7 lines...], "glow": False, "blink": False, "scan": False, "indicator": "'"},
    "standby":   {"frame": [...7 lines...], "glow": False, "blink": False, "scan": False, "indicator": "z", "drift": True},
}
```

The robot MUST sit to the left of the System Vitals bars (as in the dashboard example above).

#### Dashboard visualizations (make the rest dynamic too)

The pet isn't the only living thing on the panel. Render the other sections as **visuals**, not just text:
- **RUN** — a solid `▓` progress bar = checked plan boxes / total, with `%` and elapsed time beside it.
- **TASKS** — each task gets a `█`/`░` mini bar: full = done-verified, partial = running (width from evidence), empty = queued. Status word on the right.
- **VERIFICATION** — one stacked `█` bar showing pass / total across all gates (doctor·smoke·verify·sec); review shown separately.
- **ACTIVITY** — a Unicode sparkline (`▁▂▃▅▇█▆▄▂▁`) per signal over the last 10 min: tasks, agents, verify events. Bucket `events.jsonl` timestamps.
- **EVENT FEED** — last 5 events as `HH:MM:SS  type   detail`; mark negative verification/evidence events with `[!]` so failures pop.

#### Technical tracking (the real value)

The pet must read and display REAL data from the LazyTrae state:

1. **Run status** — read `.lazytrae/runs/<run_id>/state.json`:
   - run_id, status, objective, created_at (compute duration)
   - tasks[] with id, title, status, changed_files, evidence
   - review_status, verification_gates

2. **Agent activity** — parse `events.jsonl` for:
   - `subagent_start` events -> count total spawned
   - `subagent_stop` events -> count stops, check if evidence was verified
   - `task_created` / `task_completed` events
   - Active agents (started but not stopped)

3. **Verification status** — run (or read cached results of):
   - doctor.sh result
   - smoke-test.sh result
   - verify.sh result (the compact JSON)
   - security-check.sh result
   - review decision from `review/` directory

4. **Event feed** — last N events from `events.jsonl`, formatted as:
   `HH:MM:SS  event_type     detail`

5. **Plan progress** — read `plan.md`, count checked vs unchecked boxes in `## TODOs` section

6. **Skill usage** — parse events for skill/command invocations (if logged), show which LazyTrae commands were used

7. **Pet log** — a charming narrative log derived from events:
   - Task completed -> "[+] Charged up on T1 completion (verified)"
   - Verification passed -> "[*] Power surge — all checks green"
   - Verification failed -> "[!] ERROR state triggered — health -10"
   - No activity 45s+ -> "[z] No activity for 45s — entering low-power mode..."
   - Subagent spawned -> "[◆] New agent node online (implementer)"
   - Evidence rejected -> "[-] Trust validation failed — invalid evidence path"

#### Pet state persistence

`.lazytrae/pet-state.json`:
```json
{
  "health": 80,
  "focus": 70,
  "stamina": 60,
  "trust": 95,
  "last_fed": "2026-07-10T17:27:12Z",
  "last_activity": "2026-07-10T17:28:00Z",
  "log": ["[+] Charged on T1", "[*] Verification boost", ...]
}
```

### How to run this session

**Don't follow a rigid step-by-step.** Run freely — use your judgment on when to use each LazyTrae command. The goal is to test the workflow naturally, not mechanically.

However, you MUST:
1. Create a real run with `create-run.sh`
2. Write a real plan with checkboxes
3. Use `update-plan-checkbox.sh` and `update-task.sh` as you work
4. Run `lazytrae-verify.sh` at least once
5. Try `finalize-run.sh` at the end
6. Write the self-evaluation report

Beyond that, work however feels natural. If you want to skip init-deep because the project is small, skip it and note why. If ulw-plan feels over-engineered for this task, say so. The point is to find where the workflow helps and where it gets in the way.

### Include

- `pet/` package (the 6 modules above — keep each focused; `metrics.py` + `art.py` + `render.py` should hold the bulk of the logic)
- `tests/test_pet.py` (~100+ lines, >=8 tests: mood selection, Health formula, Trust formula, Focus drain, Stamina, event parsing, plan progress, sparkline buckets, edge cases)
- `dogfood-report.md` (self-evaluation)

### Self-evaluation report

At the end, write `dogfood-report.md`:

```markdown
# Dogfood Report: Trae Pet

## Result
PASS / FAIL + summary

## Pet screenshot
(paste `python3 -m pet status` output)

## What worked well
- ...

## What was painful
- ...

## Problems encountered
| # | Problem | Severity | Root cause | Fix suggested |
|---|---------|----------|------------|---------------|

## Parity gaps surfaced
- ...

## Timing
| Phase | Time | Notes |
|-------|------|-------|

## Did the pet accurately reflect harness state?
- Did pet mood match what was actually happening?
- Did the stats feel meaningful or arbitrary?
- Could you tell from the pet alone whether things were going well?

## Would I use this workflow for real work?
Honest answer.

## Artifacts
- pet/ (package — N lines across 6 modules)
- tests/test_pet.py (N lines)
- .lazytrae/runs/dogfood-pet/ (full run records)
- .lazytrae/pet-state.json
```

### Rules

1. **Be honest.** Record real errors, real friction.
2. **The whole panel must be visual.** Animated Trae robot + real System Vitals bars + progress bars + sparklines — not walls of text. This is the visual payoff.
3. **The pet must read real state.** Don't fake the data — parse actual files. The bars and sparklines must reflect real `.lazytrae/` values.
4. **Tests must pass.** Run pytest and prove it.
5. **No artificial time cap.** This is a small project — it shouldn't need long to execute. Keep scope tight (modular package as specced, ~8 tests) but don't rush or cut quality to hit a clock. Just run it, watch the pet, write the report.
6. **Don't fix harness bugs during the run.** Note and continue.