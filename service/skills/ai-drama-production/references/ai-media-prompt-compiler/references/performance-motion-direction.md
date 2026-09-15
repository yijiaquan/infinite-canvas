# Performance and Motion Direction

Use this reference for every high-risk H3 Shot containing a visible character, dialogue, prop interaction, reaction, entrance, exit, or emotional turn. It converts a correct story beat into playable screen behavior without changing the approved plot.

## Compact Director's Read

Before writing provider syntax, make this six-line internal read in the current Shot semantic brief or working notes. It is not a new file, approval, state, or prompt section:

1. **Audience turn** — what the audience must newly notice, understand, fear, or expect by the Shot.
2. **Objective / obstacle / tactic** — what the active character tries to achieve now, what resists it, and the physical tactic used.
3. **Visible contradiction** — one observable behavior that carries subtext (for example, steadying a trembling hand before answering), or `not_applicable`.
4. **Non-transferable detail** — one story-bound prop, ritual, sound, spatial fact, or relationship signal that makes this Shot specific rather than generic.
5. **Stock-solution refusal** — name the lazy substitute to avoid (for example, “generic slow push-in over a held pose”) and the concrete replacement.
6. **End proof** — the visible state that proves the turn happened and supplies a clean edit condition.

Compile the read into the normal action, camera, light, sound, and end-state layers. Do not copy labels such as “subtext” or “power shift” verbatim into an H3 prompt.

## Relationship and reveal lens（按需）

Only for confrontation, discovery, choice, identity reveal or relationship-turn Shots, add the following internal decisions to the existing brief:

- **POV / information control** — whose experience organizes the beat; what the audience sees now, what remains hidden, and what physical trigger reveals it.
- **Power change** — who occupies or yields space at the start and end, translated into camera height, frame share, distance, eyeline, who moves first, or who is blocked from view.
- **Reception proof** — when the revealed fact changes a choice, relationship or threat level, show who receives it and the visible consequence in this Shot or the next one; do not leave the change as an invisible inner realization.

Compile both into observable staging, camera or sound evidence. Do not add them to ordinary utility, atmosphere or simple-action Shots, and never paste labels such as `POV` or `power shift` into provider prose.

## Fidelity allocation

Choose one primary production priority for each difficult Shot: `identity`, `motion`, `geography`, `dialogue`, or `geometry`; optionally choose one secondary priority. Spend the remaining complexity budget deliberately:

- `identity` — use a simple action and uncluttered staging when a new Look or close performance must read.
- `motion` — reduce scene density and references when a full-body action, interaction, or camera path is the point.
- `geography` — protect landmarks, screen direction, entrances, and prop ownership; avoid needless action changes.
- `dialogue` — protect intelligible timing, acting task, listener response, and sound route; do not overload with unrelated spectacle.
- `geometry` — favor a single contact/change, clear staging, and a supported route over a complex one-take.

If all five are demanded at once, split at a real editorial boundary into more Shots. This is a directing trade-off, not permission to weaken identity, rights, or continuity requirements.

## Generability and anti-slop pass

Before model formatting, replace empty quality language with the physical choice that earns it: camera placement, light source, material behavior, sound cue, action path or ending state. Remove provider parameters, comma-tag piles and repeated generic negations unless a task-specific constraint is genuinely required. Keep useful era, genre or medium language only when it points to observable design.

When a Beat depends on an exact interception, a long two-hand choreography, several people making simultaneous large moves, invisible psychology, or unverified contact geometry, preserve its dramatic function and result while choosing a more reliable execution: show preparation and one clear contact, place the reaction in the next Shot, simplify non-focus performers, use a supported camera relationship, or split the Shot. Do not remove the event, replace it with an unrelated pose, or reveal later information early.

## Core contract

A performance Shot must contain a visible progression, not merely a pose plus speech. Build the progression as:

```text
trigger -> physical preparation -> committed action -> interruption or response
-> character reaction/choice -> changed end state
```

For a simple Shot, merge adjacent phases, but retain a cause, bodily execution, reaction, and changed result. Do not stretch one hand gesture, eye glance, or static line delivery across the whole model duration. Shorten the Shot when the approved beat contains too little movement; split it when several major actions cannot remain readable.

### Action mid-state

For a visible action, prefer a director-board Panel that catches the action already underway but not yet completed. Replace result-only wording with physical mechanics:

- not `stands up`, but `torso pitches forward, one palm braces on the console, hips have just cleared the chair, chair sliding backward, knees still extending`;
- not `turns his head`, but `shoulders remain forward while the head accelerates right and the eyes acquire the threat before the face completes the turn`;
- not `steps back`, but `weight has shifted to the rear leg, the retreating foot is moving while the lead foot still marks the previous position, torso recoiling`.

Use `start_state` or `end_state` only when establishing, confirming a result, or deliberately holding tension is the Shot's purpose. Each director-board Panel is one readable timepoint for its Shot, and an action Panel should usually be a mid-state.

### Identity versus performance

Identity references preserve face, age, hair, body proportions, Look and fixed accessories. They do not prescribe pose, gaze, facial tension or emotion. For the current Shot, direct eye focus, eyelid tension, brows, lips, jaw, breath, neck/shoulder tension and whole-body mechanics independently. When a recurring lead needs a stable nuanced acting language, use the optional performance board; it may guide expression and body language but cannot redesign identity.

Expression intensity is a relative `0–100%` scale inside one character's performance range, not a provider parameter. Translate it into visible muscle, breath and posture. Emotional progression may rise, spike, suppress, recover and rise again; never force monotonic steps.

## Scope firewall and ending profile

Before compiling, write four compact boundaries in the current H3 Shot brief:

- **Already happened** — completed action, dialogue, reveal, or physical state that this Shot must not replay.
- **This Shot only** — one coherent action and changed endpoint this generation earns.
- **Reserved for later** — a known future action, answer, location, or payoff that remains out of this prompt.
- **Do not show yet** — information that may motivate performance but must not enter the picture or sound.

Then choose one ending profile. `resolve` settles a completed action; `edit_point` lands visual and audio on a clean cut; `extension_anchor` preserves a clearly described state that the next Shot's Panel must inherit; `hero_hold` settles a readable subject; and `reveal_punch` lets the final result land. Do not add idle drift merely because a clip ends, and do not assume the raw tail will be fed into the next H3 request.

## Performance channels

For each temporal beat, direct the applicable visible channels:

1. **Task and intention** — what the character is trying to accomplish now and what triggers the action.
2. **Whole-body mechanics** — feet or seated base, weight shift, torso rotation, shoulder/neck tension, arm path, hand contact, head turn, gaze, breath, and recovery. Use only the chain needed by the action.
3. **Spatial change** — entrance/exit, step, lean, turn, cross, approach, retreat, foreground/background transition, or a deliberate stationary anchor.
4. **Prop/contact state** — who owns, touches, releases, opens, closes, passes, catches, or changes an object, including exact contact and count.
5. **Reaction and attention handoff** — what the actor notices, how the listener/environment responds, and where audience attention moves.
6. **Camera response** — one motivated camera behavior that follows, reveals, compresses, or contrasts the action; do not use “slow push-in” as the default for every Shot.
7. **Environment response** — cloth, hair, paper, dust, light, crowd, furniture, vehicle, or room tone reacting to the action when applicable.

Use at least two visibly changing channels in each active beat and at least three across a character-performance Shot. Identity preservation and movement are compatible: repeat immutable identity once, then spend most prompt detail on positive action, reaction, and state change.

Facial performance and body performance should share the same trigger. Do not write only `looks terrified`; pair the face with weight shift, shoulder/neck tension, hand support or withdrawal, breath and gaze. Horror and suspense should prefer restrained recognition, suppression and delayed loss of control over repeating wide eyes and open mouths.

## Camera and blocking contract

Write one compact contract in the current Shot semantic brief before provider compilation. It is a directing aid, not a new approval or metadata system:

1. **Viewpoint** — shot scale, camera height/angle, and lens feel or FOV when it materially affects space.
2. **Blocking** — where the focus character, responder, key prop, entrance/exit, and geography anchor begin and end.
3. **One primary behavior** — locked frame or one move with a start relation, meaningful amplitude, speed, subject relationship, and endpoint.
4. **Reason** — the action, attention handoff, reveal, or spatial contrast that motivates this camera choice.
5. **Fragile anchor** — the contact point, eyeline, doorway, vehicle edge, screen direction, or reveal that the camera must keep legible.

Use a locked frame deliberately for lip-sync, exact hand contact, product/identity evidence, or a held reveal. A static frame is still a camera decision. Do not stack orbit, crane, handheld, focus-pull, and push-in in one short beat. If a second move is essential, place it in the next Shot.

## Multi-character action allocation

For two or more visible people, decide who carries the single major beat before adding style language:

1. **Focus character** — one decisive movement, contact, turn, entrance, exit, or spoken-action task with a clear endpoint.
2. **Responding character** — at most one small, timed reaction that makes the focus action readable.
3. **Background characters** — continuous micro-motion only: breathing, blink, hair/cloth drift, a restrained gaze shift, or a held pose that does not compete for prop/contact physics.

Do not give multiple people independent walking, turning, prop handoffs, large gestures, and dialogue in the same short beat. If a two-person interaction is the story event, specify the contact point, ownership change, and endpoint, then simplify everyone else or split into more Shots.

## Dialogue performance

Never compile visible dialogue as `stands/sits, looks at the other character, says the line`. Bind each Line to:

- a pre-line trigger or unfinished physical task;
- an action performed while speaking that supports the meaning;
- a listener or environmental reaction before the next Line;
- a post-line choice or changed object/spatial state.

Use deliberate stillness only when it creates tension against visible counter-motion: breath, eye focus, listener movement, prop motion, environment motion, or camera reveal. Label the stillness purpose and its release condition. Static mouth movement with no counter-motion is a failed performance.

## Sound phase and handoff

Give every Shot a compact sound phase in the current Shot semantic brief; this is planning information for the Audio Skill and provider compiler, not a new Cue, stem, or owner response:

1. **Entry state** — what is already audible at the Shot: dialogue tail, room tone, vehicle, wind, music phase, or intentional silence.
2. **In-Shot priority** — one listening focus: exact Line, action/contact sound, ambience change, or deliberate silence. Do not make every layer equally loud or narratively important.
3. **Exit state** — the sound event or settled ambience that makes the Shot usable.
4. **Handoff** — whether the next Shot inherits, cuts, fades, or intentionally contrasts that state. For an `extension_anchor`, name the live sound vector as well as pose and camera direction.

Keep dialogue, ambience, Foley/SFX, and non-diegetic music distinct. Native generated audio is only a candidate: it never replaces Voice, Line, lip-sync, A/V-sync, mix, or delivery QA.

Keep the provider-neutral sound plan compact: `Dialogue / Ambience / SFX / Music / Reference / Post`, filling only layers that matter. Give every sound a visible or editorial job; a Line must not compete with decorative music, and `MUS=none` never removes room tone or action sound. `Reference` states the audio asset's narrow control role; `Post` carries source-audio policy, editable-stem and delivery needs to the Audio Skill rather than pretending those are provider controls.

## Eight-panel director-board conversion

- Map every approved Beat used by the variable-duration H3 Clip to exactly one of the actual director-board Panels, its continuous action body, or an explicit off-screen carrier. Do not reduce the sequence to generic prose.
- Preserve every Panel's composition, blocking, action direction, attention target, camera working side and state handoff. A text summary that discards those directing choices is incomplete.
- For local H3 performance, connect the complete adaptive-layout adaptive-panel director board as `<Picture 1>`, then bind the complete identity boards of visible characters, the current complete scene board, and complete boards for actual continuity-critical props as later narrow-authority references. Do not upload all Panel crops, routine single-view derivatives or raw-tail inputs. FL2VA remains a separately selected endpoint test route.
- For double-person, entrance/exit, prop-transfer, pursuit or reverse-angle work, write the screen-space contract: viewer-screen left/right, named axis, working side, positions, facing/eyeline, hands/props, fixed anchors and explicit permitted cross-axis transition. If it cannot fit one reliable Shot, split at a real editorial boundary.
- Only after actual QA proves the next Clip's board cannot inherit state may a clean tail be used through the OpenAI image route to repair the affected Panel; if the board still cannot control one high-risk state, add one clean state image with a narrow Shot scope. Do not compensate with a longer prose paragraph.

## Prompt balance

Write positive motion before failure prevention. Keep one compact preserve block for identity, wardrobe, geography, count, and rights-sensitive facts. Move repeated prohibitions into task-specific constraints or QA; do not repeat “keep/still/never/do not change” in every interval unless the state is the action's subject.

Prefer:

```text
She shifts weight onto her front foot, turns her torso, catches the sliding box
with both hands, recoils after their hands touch, then looks up as he steadies
the card. The camera tracks the box, lands on the hand contact, and rises with
their shared glance.
```

Reject:

```text
She stands on the left, keeps her identity, holds the box, looks at him, says
the line, and remains still while the camera slowly pushes in.
```

## Internal lint and QA

Before provider compilation, reject or revise a performance Shot when any applies:

- one micro-gesture or static dialogue pose occupies most of the requested duration;
- every beat uses the same framing and slow push without a story-motivated reason;
- `subject_motion` describes only hands, lips, gaze, or “small natural movement” while the approved beat needs bodily or spatial action;
- dialogue lacks before/during/after behavior or listener response;
- temporal beats list actions but no observable reaction, choice, contact change, spatial change, or prop-state change;
- an already-completed beat is replayed, a reserved reveal leaks early, or the prompt tries to complete several future turns in one generation;
- the declared ending profile conflicts with the next use: a continuation has no live handoff state, a hero/reveal hold keeps drifting, or an edit point ends mid-action/mid-audio;
- several visible characters receive competing major actions without a named focus, contact ownership, and endpoint;
- the complete director board is cited but a Panel's blocking, action direction, composition or camera side disappears from the prompt;
- preservation language outweighs positive performance direction and suppresses the required change;
- identity or same-View references visibly freeze the pose, expression, framing or subject position that the Shot is supposed to change;
- the Panel shows only a completed result when the Shot needs a readable action mid-state;
- adjacent Shots repeat Camera, Body and Information with fewer than two meaningful changes and no deliberate fixed-coverage reason;
- the end state is merely “holds/stays/looks” rather than a newly achieved story condition.

After generation, review the clip at normal speed and in one-second samples. Reject `performance_flat` when the intended action exists technically but the body, reaction, attention, camera, and state progression remain visibly inert. Treat that as a prompt/input/mode defect, not a successful clip with a stylistic note.

## Take triage and repair

Use the single complete repair classification in the Prompt Skill entrypoint. This reference only diagnoses which performance layer needs to change. Do not automatically reroll, change engines, or alter multiple variables to chase a candidate. A truly unknown submission is reconciled before a new execution; a repeated fault requires revisiting the Director's Read, reference authority, or approved Shot design rather than adding more adjectives.

## Failure atlas

Diagnose the returned take before editing prompt prose. Note the observable symptom, its most likely failed layer, and one primary repair variable in the current take review:

| Observable symptom | First diagnosis | One primary repair variable |
| --- | --- | --- |
| Character stands, speaks, or gestures without a turn | Missing trigger/body/reaction chain | `performance_arc` |
| Camera feels generic, jumps, or hides the event | Competing moves or no camera endpoint | `camera_contract` |
| Face, wardrobe, count, or character ownership drifts | Identity reference or preserve authority is weak/conflicted | `reference_authority` |
| Landmark, axis, prop owner, or entrance position shifts | Geography handoff is incomplete | `continuity_anchor` |
| Hand, door, vehicle, or exchange breaks | Geometry load exceeds the route | `action_scope_or_shot` |
| Dialogue is stiff, wrong, or out of sync | Line task, speaker binding, or audio route conflicts | `line_or_sound_route` |
| Sound is empty, masks dialogue, restarts, or cuts badly | Entry/priority/exit phase is unspecified | `sound_phase` |
| Next Shot restarts the previous action | Production-keyframe state handoff or asset continuity is underspecified | `keyframe_state_handoff` |
| Node/schema/history/output evidence fails | Shared route or execution state failed | `technical_route` — do not mutate the creative prompt first |

An unknown submission is not a failure-atlas row: inspect its queue/history and output once before retrying. A repaired version changes only the selected primary variable unless the approved Shot itself is revised.
