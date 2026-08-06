# MONSOON

A live crisis simulation for science journalists, built as a conference workshop activity.

Participants play the deputy digital editor of a fictional global science publication. At 02:47 their phone rings: a preprint alleges that a private geoengineering venture caused the worst South Asian monsoon failure in forty years. It has not been peer reviewed. Within four hours it is a head-of-state problem.

Ten decisions, each on a countdown, delivered as a phone thread — wire alerts, newsroom messages, social posts, ministerial statements. At the end each participant gets a scored debrief and an archetype, which the facilitator uses to run the room.

---

## Files

| File | What it is |
|---|---|
| `index.html` | The simulation. Self-contained — no build, no dependencies, no network calls. |
| `facilitator.html` | The run-of-show guide: timings, discussion questions, assessment rubric, the ground truth. |

Both are single files that open directly in a browser (`open index.html`) and are also published as hosted pages. Nothing is transmitted anywhere; the pages hold no data and set no cookies.

---

## The design decisions worth keeping

**A fixed spine, not a branching tree.** Everyone gets the same ten injects in the same order; only the responses diverge. This is what makes a group debrief possible — two people who chose differently at Decision 7 were standing in exactly the same place when they chose. Full branching would produce a hundred private experiences and nothing to compare. This mirrors how tabletop crisis exercises are actually structured, and how First Draft ran its newsroom simulations.

**No visible score during play.** Participants see a four-segment rail that pulses direction, never a number. A visible score turns the exercise into optimisation, and optimising is the opposite of the judgement being taught. Numbers appear only in the debrief.

**Four axes, no winning route.** `RIGOUR · TEMPO · TRUST · NERVE`. Rigour and tempo genuinely pull against each other, and no path maxes all four. A strong result is a coherent set of trades, not a right answer.

**Archetypes over rankings.** The debrief assigns an archetype by the *shape* of the profile (strongest axis against weakest), not the total — THE WIRE, THE VAULT, THE FORTRESS, and so on. These exist to group a room physically and start an argument, which a leaderboard would not.

There are eleven, and all eleven are reachable — verified by directed search rather than assumed. Because scoring is additive and rounds are independent, greedily maximising a linear objective per round gives an exact optimum, so it is cheap to prove which profile shapes can actually be played. Three shapes that an earlier draft defined turned out to be impossible: every one was led by trust, and in this scenario every trust-building action also demands courage or evidence discipline. They were removed rather than papered over by distorting scores to fit the labels.

**The central trap.** At Decision 8 the moral story and the factual story come apart: the company really did something reckless and unauthorised, and really did not cause the monsoon failure. Both are true, and almost every available format — headline, alert, broadcast clip, correction — can only carry one. Everything before Decision 8 is setup for it.

**Timeouts are scored as decisions.** If the clock runs out, the story publishes without the participant, usually in a press office's words. This is the most realistic mechanic in the build.

---

## Editing the scenario

All content lives in two structures near the top of the `<script>` block in `index.html`. There is no build step — edit and reload.

`CAST` — everyone who can send a message, with display name, role, initials and colour.

`ROUNDS` — the ten decision points. Each round:

```js
{
  id: 4,
  act: "ACT II — THE AMPLIFICATION",
  clock: "09:12",          // shown in the status bar
  secs: 55,                // countdown for this decision
  injects: [ /* what arrives before the decision */ ],
  prompt: "THE AMPLIFIER", // short label on the sheet
  q: "The question posed to the player.",
  options: [ /* exactly four, keyed A–D */ ],
  timeoutOpt: { /* what happens if the clock expires */ }
}
```

Each option carries:

```js
{
  k: "A",
  label: "The choice as the player sees it.",
  detail: "The rationale a real editor would give for it.",
  s: { rigor:+3, tempo:+2, trust:+2, nerve:+3 },   // score deltas
  flags: ["correctedminister"],                     // recorded on the run
  out: [ /* messages shown after choosing */ ],
  note: "What this modelled — shown in the debrief log. This is the teaching material."
}
```

Message types available in `injects` and `out`:

| `t` | Renders as |
|---|---|
| `msg` | A person, with typing indicator. Needs `who` (a `CAST` key) and `lines[]`. Optional `att` for an attachment block (accepts inline HTML). |
| `wire` | A priority wire card. `prio` is `FLASH` / `BULLETIN` / `URGENT` / `ADVISORY`, plus `hed` and `sub`. |
| `post` | A social post: `who`, `handle`, `v` (verified), `c` (avatar colour), `i` (initials), `text`, `eng[[label,value]]`. |
| `article` | Published copy, set in serif — the material shift when the player's words become a story. Needs `kicker`, `h`, `p`. |
| `you` | The player's outgoing message. Needs `text`. |
| `sys` | A dim desk note. `text` accepts inline HTML. |

`ARCHETYPES` is keyed `"<strongest>|<weakest>"` using axis names, plus `balanced` and `passenger` fallbacks. If you add an axis you will need to fill in the new pairs — `check.js` in the notes below verifies coverage.

### Validating an edit

The scenario data is plain JS, so a typo silently breaks a round. Two checks used while building:

- **Data integrity** — every round has four uniquely-keyed options and a timeout, every `who` resolves against `CAST`, every option has a teaching note and four numeric score deltas, every archetype pair is covered.
- **Playthrough** — drive it in a headless browser across several decision profiles, asserting no runtime errors and that all four options stay reachable at small viewports.

The second one caught the significant bug in this build: `#sheetHost` was `flex:0 1 auto`, so the ever-growing message thread shrank the decision sheet proportionally and by round 4 the options list had collapsed to 24px. It is now `flex:0 0 auto` — the thread is the only flexible item. Worth re-checking if you touch the device layout.

---

## Adapting it to another subject

The engine is subject-agnostic — it renders messages and scores choices. To retarget it (a public-health recall, a research-fraud allegation, a data breach at a journal), replace `CAST` and `ROUNDS` and rename the axes in `AXES`. The structural pieces worth preserving:

1. A claim that is **partly** true, so the correction genuinely costs something.
2. An early decision the participant will want back by the end — here, the Round 1 alert.
3. Something the participant's own institution did before the story started — here, the fourteen-month-old profile.
4. A divergence point where being factually right makes them look morally wrong.
5. A final round where the correction lands on people rather than on peers.

---

## Background

Scenario and workshop design draw on documented practice rather than invention:

- **First Draft's newsroom crisis simulation** (CUNY, February 2020) — ~70 journalists in mock newsrooms with a game portal of email, chat and social feeds, escalating injects, and a debrief that noted one group had effectively sabotaged the information environment. The fixed-inject structure and the "plant" variant come from here. — [Scientific American](https://www.scientificamerican.com/article/when-a-journalist-becomes-a-disinformation-agent/)
- **Inoculation game design** — *Bad News*, *Harmony Square*, *Go Viral!* (Cambridge / DROG), which establish that a weakened dose of a manipulation technique in a safe environment builds resistance to it. — [inoculation.science](https://inoculation.science/inoculation-games/)
- **Tabletop exercise structure** — objectives, scenario brief, escalating injects, decision under ambiguity, hotwash debrief; and the standing rule that the session is framed for learning rather than scoring. — [CISA Exercise Planner Handbook](https://www.cisa.gov/sites/default/files/publications/2%20-%20CTEP%20Exercise%20Planner%20Handbook%20(2020)%20FINAL_508_1.pdf)
- **Preprint reporting and the hype pipeline** — journalists' reliance on unreviewed research during COVID-19, and the role of university press offices in inflating findings. The Round 1 and Round 5 mechanics are built directly on this. — [PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0277769), [Science Media Centre](https://www.sciencemediacentre.org/the-preprint-dilemma-good-for-science-bad-for-the-public-a-discussion-paper-for-the-scientific-community/)
- **Correction reach asymmetry** — corrections reliably reach a small fraction of an original story's audience, which is the whole substance of Decision 9. — [Do Journalists Update Retracted Science News?](https://www.tandfonline.com/doi/full/10.1080/17512786.2025.2540460)

---

## A note on the fiction

Everything in the simulation is invented: The Meridian, Kestrel Climate, Gullhaven University, The Beacon, and every named individual including the minister. Institutions are referred to generically. No real person is quoted or depicted, and no real organisation is named. This is deliberate — the scenario needs geopolitical scale to work, and it gets that scale without putting words in a real mouth.

The science is plausible rather than exact. Solar radiation management, monsoon attribution difficulty, and the Indian Ocean Dipole are all real; the numbers attached to them here are constructed to make the scenario resolvable, not to model an actual intervention. A room of science journalists will interrogate this, which is fine — that argument is a good use of the debrief.

---

## Status

V1, built to be argued with. Round text, scoring weights and the scenario spine are all meant to be edited before this meets a real room — the facilitator guide says so explicitly, and the person running the workshop will have far better instincts about their own audience than this build does.
