import { describe, expect, it } from 'vitest';
import { buildDecisionEvidence, rankCandidates, type ContextInput } from './domain';
import type { ShareHistoryEntry } from './share-history';

const familyPhotoInput: ContextInput = {
  contentType: 'image',
  sourceApp: 'gallery',
  timeBand: 'evening',
  place: 'home',
};

const matchingHistoryEntry = (id: string): ShareHistoryEntry => ({
  id,
  scenario: 'family-photo',
  input: familyPhotoInput,
  recommendedTargetId: 'mom',
  selectedTargetId: 'kakaotalk',
  selectedTargetLabel: '카카오톡',
  result: 'success',
  sharedAt: '2026-04-19T10:00:00.000Z',
});

describe('history-based recommendation bonus', () => {
  it('boosts a previously selected target when history matches the current context', () => {
    const ranked = rankCandidates('family-photo', familyPhotoInput, [matchingHistoryEntry('evt-1')]);

    expect(ranked[0]?.candidate.id).toBe('kakaotalk');
    expect(ranked[0]?.reasons.some((reason) => reason.includes('history'))).toBe(true);
    expect(ranked[0]?.breakdown.history).toBeGreaterThan(0);
  });

  it('accumulates history bonus across repeated similar selections', () => {
    const ranked = rankCandidates('family-photo', familyPhotoInput, [
      matchingHistoryEntry('evt-1'),
      matchingHistoryEntry('evt-2'),
    ]);
    const kakaotalk = ranked.find((item) => item.candidate.id === 'kakaotalk');

    expect(kakaotalk?.breakdown.history).toBe(28);
    expect(kakaotalk?.score).toBe(45);
  });

  it('keeps static ranking behavior when history is empty', () => {
    const ranked = rankCandidates('family-photo', familyPhotoInput, []);

    expect(ranked[0]?.candidate.id).toBe('mom');
    expect(ranked[0]?.breakdown.history).toBe(0);
  });

  it('includes history contribution in decision evidence dominant signals', () => {
    const evidence = buildDecisionEvidence('family-photo', familyPhotoInput, [
      matchingHistoryEntry('evt-1'),
    ]);

    expect(evidence.topRecommendation.candidate.id).toBe('kakaotalk');
    expect(evidence.dominantSignals.some((signal) => signal.includes('history=+'))).toBe(true);
  });
});

describe('multi recommendation scenarios', () => {
  it('supports app surfacing scenario with app-only candidates', () => {
    const input: ContextInput = {
      contentType: 'document',
      sourceApp: 'mail',
      timeBand: 'afternoon',
      place: 'office',
    };

    const ranked = rankCandidates('app-surfacing', input, []);

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((item) => item.candidate.kind === 'app')).toBe(true);
    expect(ranked[0]?.candidate.id).toBe('slack');
  });

  it('supports restaurant recommendation scenario with restaurant-only candidates', () => {
    const input: ContextInput = {
      contentType: 'image',
      sourceApp: 'chat',
      timeBand: 'evening',
      place: 'home',
    };

    const ranked = rankCandidates('restaurant-recommendation', input, []);

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((item) => item.candidate.kind === 'restaurant')).toBe(true);
    expect(ranked[0]?.candidate.id).toBe('chicken-place');
  });
});
