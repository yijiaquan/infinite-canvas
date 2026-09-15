# Prose and screenplay conversion

## Write production-oriented prose

Use prose to prove the episode works as a story before optimizing it for generation. Preserve:

- causal transitions and character reasons;
- spatial and temporal orientation;
- the viewpoint and knowledge available at each moment;
- emotional changes expressed through decisions, perception, behavior, or dialogue;
- exact locked facts, rules, Lines, reveals, and ending state.

Avoid substituting abstract mood for events. A sentence such as “她感到命运崩塌” needs an observable consequence: what she notices, does, refuses, says, hides, drops, or changes.

## Convert by dramatic function

Do not convert paragraph by paragraph. First group prose into production Scenes whose location/time and dramatic purpose are stable. Map every Scene to one or more Beat IDs.

For each Scene, specify:

1. where and when it occurs;
2. who enters and in what Look/State;
3. what each active character wants now;
4. the visible action, blocking, contact, gaze, and consequential choice;
5. exact dialogue or narration that cannot be replaced by action;
6. ambience, SFX, and music policy;
7. duration target and the action/result that must fit inside it;
8. entry state, exit state, dramatic function, and cut condition.

## Dialogue rules

- Let dialogue pressure, misdirect, reveal, conceal, negotiate, threaten, bond, or change a relationship.
- Remove lines that only describe the visible image or repeat information both characters already know.
- Preserve distinct vocabulary, sentence length, evasion pattern, status, and emotional control for recurring characters.
- Keep every locked Line exact and versioned. A wording change is a story/audio dependency change, not a prompt refinement.
- Use narration when essential context cannot be shown economically, but do not use it to repair missing causality.

### Dialogue-action units

Writing a pose beside a Line is not performance. For every audible Line or narration unit, bind a stable Line/Narration ID to:

1. **Trigger**: the new pressure, question, observation, obstruction, or action that makes the character speak now.
2. **Current task**: what the character is physically trying to complete while speaking.
3. **Before action**: a visible action that establishes intention before the first word.
4. **During performance**: either `ACTION=<observable action>` or `STILLNESS=<dramatic reason>; MICRO=<breath, gaze, weight, hand tension, interrupted movement, or other observable behavior>`.
5. **Response**: what the listener, object, environment, or off-screen source does because of the Line/action.
6. **After result**: what changes in position, object state, access, evidence, risk, knowledge, or relationship after the Line.

Use actions with story consequence: searching while withholding information, locking a door while refusing entry, wiping evidence while lying, packing while ending a relationship, treating an injury while bargaining, or moving to block another character's access. Reject decorative pacing, repeated pointing, generic nodding, “看着对方说”, and unrelated prop handling.

Stillness is valid when it is the action: refusing to yield space, hiding a tremor, listening for danger, controlling anger, waiting for a lie to collapse, or preventing a fragile object from moving. It must use the explicit `STILLNESS=...; MICRO=...` form so production can distinguish intentional tension from missing staging.

For voiceover or off-screen speech, bind the Line to a visible counterpoint and a receiver/environment response. Do not show a neutral talking head merely because the audio is present.

## Visual and sound translation

Translate internal prose into one or more of:

- action or refusal;
- facial/physical performance;
- interaction with a person, location, or prop;
- a changed spatial relation or object state;
- dialogue, off-screen sound, ambience, or deliberate silence;
- concise narration with a defined visual counterpoint.

Do not write camera shots in the story package merely to make weak action feel specific. The screenplay defines dramatic staging; the Director Board later owns shot size, lens intent, composition, camera path, eyeline arrows, and cut design.

## Duration and producibility

Estimate duration from actual dialogue pace, action completion, reaction time, and transitions. Avoid forcing a scene into a duration that removes the causal action or payoff.

Flag rather than hide:

- crowds or many speaking characters;
- rapid location/wardrobe/state changes;
- exact hand-object contact or complex geometry;
- simultaneous dialogue and difficult action;
- transformations, vehicles, water, mirrors, repeated limbs, or critical object counts;
- text-heavy inserts or copyrighted visible material.

When simultaneous dialogue and action is too fragile for the selected video route, simplify the contact geometry, divide the task into consecutive action units, move a Line off screen, or use a deliberate stillness beat. Do not delete meaningful action and leave the character standing only to make generation easier.

Revise staging when the same story meaning can be expressed more reliably. Preserve the harder version only when the difficulty is itself essential to the story.
