# History-Based Personalization Bonus Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Turn share history from a passive RDF log into an active recommendation signal by adding a small history-based bonus layer on top of the existing static ranking.

Architecture: Keep the current rule-based score as the base ranker, then add a pure history bonus function that inspects prior `ShareHistoryEntry` records for context similarity and boosts candidates the user actually selected in similar situations. The UI should continue to render the same ranking flow, but the recommendation and decision evidence should now use history-aware ranking instead of static-only ranking.

Tech Stack: TypeScript, fp-ts, Vitest, Vite, localStorage-backed share history.

---

## Scope

This plan intentionally implements the smallest useful personalization loop:

- Reuse existing `ShareHistoryEntry` data
- Add a pure scoring function for history bonuses
- Integrate the bonus into ranking and decision evidence
- Surface the bonus in recommendation reasons
- Do not add new persistence schema fields yet
- Do not change the RDF graph format yet beyond existing append behavior

---

## Desired behavior

For a current `(scenario, input)` pair, prior share events should contribute bonus points to the candidate that was actually selected when the prior context is similar.

Initial bonus rules:
- same `scenario`: +4
- same `contentType`: +4
- same `timeBand`: +2
- same `place`: +2
- exact same `sourceApp`: +2
- bonus applies to the prior event's `selectedTargetId`
- total history bonus for a candidate is the sum across matching history entries

This keeps the model simple, explainable, and deterministic.

---

## Files to modify

- Modify: `src/domain.ts`
- Modify: `src/main.ts`
- Create or extend tests: `src/domain.test.ts` or `src/share-history.test.ts`
- Create: `docs/plans/2026-04-19-history-personalization-bonus.md`

---

## Task 1: Add a failing ranking test for history bonus

Objective: Prove that history should change ordering when past user selections strongly match the current context.

Files:
- Create: `src/domain.test.ts`

Step 1: Write failing test

```ts
import { describe, expect, it } from 'vitest';
import { rankCandidates, type ContextInput, type ShareHistoryEntry } from './domain-or-share-history-imports';

it('boosts a previously selected target when history matches the current context', () => {
  const input: ContextInput = {
    contentType: 'image',
    sourceApp: 'gallery',
    timeBand: 'evening',
    place: 'home',
  };

  const history: ReadonlyArray<ShareHistoryEntry> = [
    {
      id: 'evt-1',
      scenario: 'family-photo',
      input,
      recommendedTargetId: 'mom',
      selectedTargetId: 'kakaotalk',
      selectedTargetLabel: '카카오톡',
      result: 'success',
      sharedAt: '2026-04-19T10:00:00.000Z',
    },
  ];

  const ranked = rankCandidates('family-photo', input, history);

  expect(ranked[0]?.candidate.id).toBe('kakaotalk');
  expect(ranked[0]?.reasons.some((reason) => reason.includes('history'))).toBe(true);
});
```

Step 2: Run test to verify failure

Run: `npm test -- src/domain.test.ts`
Expected: FAIL because `rankCandidates` does not accept history yet.

Step 3: Commit after green

```bash
git add src/domain.test.ts
git commit -m "test: define expected history bonus behavior"
```

---

## Task 2: Add a failing unit test for the pure history bonus function

Objective: Lock down the bonus math separately from ranking order.

Files:
- Modify: `src/domain.test.ts`

Step 1: Write failing test

```ts
it('computes cumulative history bonus from similar prior events', () => {
  // same scenario + content + time + place + sourceApp = 14
  // repeated twice for same selected target => 28
  expect(computeHistoryBonus('kakaotalk', 'family-photo', input, history)).toBe(28);
});
```

Step 2: Run test to verify failure

Run: `npm test -- src/domain.test.ts`
Expected: FAIL because `computeHistoryBonus` does not exist yet.

Step 3: Commit after green

```bash
git add src/domain.test.ts src/domain.ts
git commit -m "test: define history bonus calculation"
```

---

## Task 3: Implement pure history bonus helpers in `src/domain.ts`

Objective: Add deterministic, testable bonus logic without coupling it to the UI.

Files:
- Modify: `src/domain.ts`

Step 1: Add a local history entry type import or shared type dependency

Implementation note:
- Avoid circular imports. Prefer extracting the shared `ShareHistoryEntry` type into a small shared type module if needed.
- If circularity does not arise, importing the type from `./share-history` is acceptable.

Step 2: Implement pure helpers

Suggested API:

```ts
export const historySignalScore = (
  scenario: ScenarioKey,
  input: ContextInput,
  entry: ShareHistoryEntry,
): number => {
  let score = 0;
  if (entry.scenario === scenario) score += 2;
  if (entry.input.contentType === input.contentType) score += 2;
  if (entry.input.timeBand === input.timeBand) score += 1;
  if (entry.input.place === input.place) score += 1;
  if (entry.input.sourceApp === input.sourceApp) score += 1;
  return score;
};

export const computeHistoryBonus = (
  candidateId: string,
  scenario: ScenarioKey,
  input: ContextInput,
  history: ReadonlyArray<ShareHistoryEntry>,
): number => history
  .filter((entry) => entry.selectedTargetId === candidateId)
  .reduce((sum, entry) => sum + historySignalScore(scenario, input, entry), 0);
```

Step 3: Keep implementation pure
- No localStorage access in `domain.ts`
- No UI strings in the bonus calculator
- No mutation

Step 4: Run targeted tests

Run: `npm test -- src/domain.test.ts`
Expected: PASS

---

## Task 4: Integrate history bonus into recommendation scoring

Objective: Make ranking use both static score and history score.

Files:
- Modify: `src/domain.ts`

Step 1: Extend `ScoreBreakdown`

Add:

```ts
history: number;
```

Step 2: Update total score formula

Current:

```ts
const total = base + scenarioScore + content + timePlace;
```

Target:

```ts
const history = computeHistoryBonus(candidate.id, scenario, input, historyEntries);
const total = base + scenarioScore + content + timePlace + history;
```

Step 3: Update `rankCandidates`

Current:

```ts
export const rankCandidates = (scenario: ScenarioKey, input: ContextInput): ReadonlyArray<Recommendation>
```

Target:

```ts
export const rankCandidates = (
  scenario: ScenarioKey,
  input: ContextInput,
  history: ReadonlyArray<ShareHistoryEntry> = [],
): ReadonlyArray<Recommendation>
```

Step 4: Add reason text when history contributed

Suggested reason label:

```ts
`history bonus (+${history})`
```

Append it only when `history > 0`.

Step 5: Run tests

Run: `npm test -- src/domain.test.ts`
Expected: PASS

---

## Task 5: Integrate history-aware ranking into decision evidence

Objective: Ensure inspector/explanation uses the same ranking logic as the UI list.

Files:
- Modify: `src/domain.ts`

Step 1: Update `buildDecisionEvidence`

Current:

```ts
const ranked = rankCandidates(scenario, input);
```

Target:

```ts
const ranked = rankCandidates(scenario, input, history);
```

Step 2: Update function signature

```ts
export const buildDecisionEvidence = (
  scenario: ScenarioKey,
  input: ContextInput,
  history: ReadonlyArray<ShareHistoryEntry> = [],
): DecisionEvidence
```

Step 3: Include history signal in `dominantSignals`
- If top recommendation has a non-zero history breakdown, include a line like `history=+7`

Step 4: Run tests

Run: `npm test -- src/domain.test.ts`
Expected: PASS

---

## Task 6: Wire history into `src/main.ts`

Objective: Make runtime rendering use history-aware domain functions.

Files:
- Modify: `src/main.ts`

Step 1: Update render path

Current:

```ts
const ranked = rankCandidates(scenario, input);
const decisionEvidence = buildDecisionEvidence(scenario, input);
```

Target:

```ts
const ranked = rankCandidates(scenario, input, shareHistory);
const decisionEvidence = buildDecisionEvidence(scenario, input, shareHistory);
```

Step 2: Update share action path

Current:

```ts
const ranked = rankCandidates(scenario, input);
```

Target:

```ts
const ranked = rankCandidates(scenario, input, shareHistory);
```

Step 3: Keep persistence behavior unchanged
- Still append share events as before
- Only ranking behavior changes

Step 4: Manual verification
- Perform a share selecting a non-top target in a scenario
- Re-render same scenario/input
- Confirm that target moves upward because of history bonus

---

## Task 7: Add regression tests for no-history behavior

Objective: Prove the old static ranking is preserved when there is no history.

Files:
- Modify: `src/domain.test.ts`

Step 1: Add test

```ts
it('keeps static ranking behavior when history is empty', () => {
  const ranked = rankCandidates('family-photo', input, []);
  expect(ranked[0]?.candidate.id).toBe('mom');
});
```

Step 2: Run targeted tests

Run: `npm test -- src/domain.test.ts`
Expected: PASS

---

## Task 8: Full verification

Objective: Verify no regressions across the app.

Files:
- No code changes required

Step 1: Run all tests

```bash
npm test
```

Expected: all tests pass

Step 2: Run production build

```bash
npm run build
```

Expected: successful Vite build

Step 3: Commit

```bash
git add src/domain.ts src/main.ts src/domain.test.ts docs/plans/2026-04-19-history-personalization-bonus.md
git commit -m "feat: add history-based recommendation bonus"
```

---

## Notes and constraints

- Keep this implementation explainable and deterministic
- Do not introduce probabilistic learning or external storage changes yet
- Prefer additive bonus only; do not alter existing static weights in this iteration
- Avoid circular type imports; if needed, extract `ShareHistoryEntry` type into a shared module in a follow-up

---

## Acceptance criteria

- Recommendation ranking changes when similar history exists
- No-history ranking remains identical to today
- Top recommendation reasons show when history influenced the result
- Decision evidence uses the same history-aware ranking as the visible ranking list
- Tests and build pass
