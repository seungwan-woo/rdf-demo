import { describe, expect, it } from 'vitest';
import { buildDecisionWorkspace, type DecisionWorkspace } from './decision-pipeline';
import type { ContextInput } from './domain';
import type { ShareHistoryEntry } from './share-history';

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
    sharedAt: '2026-04-19T08:00:00.000Z',
  },
  {
    id: 'evt-2',
    scenario: 'family-photo',
    input,
    recommendedTargetId: 'mom',
    selectedTargetId: 'kakaotalk',
    selectedTargetLabel: '카카오톡',
    result: 'success',
    sharedAt: '2026-04-19T08:10:00.000Z',
  },
  {
    id: 'evt-3',
    scenario: 'family-photo',
    input,
    recommendedTargetId: 'mom',
    selectedTargetId: 'mom',
    selectedTargetLabel: '엄마',
    result: 'success',
    sharedAt: '2026-04-19T08:20:00.000Z',
  },
  {
    id: 'evt-4',
    scenario: 'family-photo',
    input,
    recommendedTargetId: 'mom',
    selectedTargetId: 'kakaotalk',
    selectedTargetLabel: '카카오톡',
    result: 'success',
    sharedAt: '2026-04-19T08:30:00.000Z',
  },
  {
    id: 'evt-5',
    scenario: 'family-photo',
    input,
    recommendedTargetId: 'mom',
    selectedTargetId: 'kakaotalk',
    selectedTargetLabel: '카카오톡',
    result: 'success',
    sharedAt: '2026-04-19T08:40:00.000Z',
  },
  {
    id: 'evt-6',
    scenario: 'family-photo',
    input,
    recommendedTargetId: 'mom',
    selectedTargetId: 'kakaotalk',
    selectedTargetLabel: '카카오톡',
    result: 'success',
    sharedAt: '2026-04-19T08:50:00.000Z',
  },
  {
    id: 'evt-7',
    scenario: 'family-photo',
    input,
    recommendedTargetId: 'mom',
    selectedTargetId: 'kakaotalk',
    selectedTargetLabel: '카카오톡',
    result: 'success',
    sharedAt: '2026-04-19T09:00:00.000Z',
  },
];

describe('decision workspace composition', () => {
  it('assembles the source, storage, working graph, and decision outputs into one workspace', () => {
    const workspace = buildDecisionWorkspace('family-photo', input, history);

    expect(workspace.baseGraph.length).toBeGreaterThan(0);
    expect(workspace.workingGraph.length).toBeGreaterThan(workspace.baseGraph.length);
    expect(workspace.historyCompression.recentEntries.map((entry) => entry.id)).toEqual([
      'evt-3',
      'evt-4',
      'evt-5',
      'evt-6',
      'evt-7',
    ]);
    expect(workspace.historyCompression.summaries).toHaveLength(1);
    expect(workspace.evidence.scenarioLabel).toContain('가족 사진');
    expect(workspace.explanation.graphSize).toBe(workspace.workingGraph.length);
    expect(workspace.ranked[0]?.candidate.id).toBe('kakaotalk');
  });

  it('returns a strongly typed decision workspace shape for the UI layer', () => {
    const workspace: DecisionWorkspace = buildDecisionWorkspace('family-photo', input, history);

    expect(workspace.evidence.topRecommendation.score).toBeGreaterThan(0);
    expect(workspace.explanation.contextLines).toEqual([
      'contentType=image',
      'sourceApp=gallery',
      'timeBand=evening',
      'place=home',
    ]);
  });
});
