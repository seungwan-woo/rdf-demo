import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContextGraph } from './domain';
import {
  appendShareHistoryToGraph,
  buildShareEventTriples,
  clearShareHistory,
  compressShareHistoryForGraph,
  escapeHtml,
  loadShareHistory,
  persistShareHistoryEntry,
  saveShareHistory,
  SHARE_HISTORY_GRAPH_RECENT_LIMIT,
  type ShareHistoryEntry,
} from './share-history';

const sampleEntry: ShareHistoryEntry = {
  id: 'evt-1',
  scenario: 'family-photo',
  input: {
    contentType: 'image',
    sourceApp: 'gallery',
    timeBand: 'evening',
    place: 'home',
  },
  recommendedTargetId: 'mom',
  selectedTargetId: 'kakaotalk',
  selectedTargetLabel: '카카오톡',
  result: 'success',
  sharedAt: '2026-04-19T09:30:00.000Z',
};

const makeEntry = (id: string, sharedAt: string, selectedTargetId = 'kakaotalk'): ShareHistoryEntry => ({
  ...sampleEntry,
  id,
  selectedTargetId,
  selectedTargetLabel: selectedTargetId === 'mom' ? '엄마' : '카카오톡',
  recommendedTargetId: selectedTargetId,
  sharedAt,
});

describe('share history RDF integration', () => {
  it('builds RDF triples for a share event including recommended and selected targets', () => {
    const triples = buildShareEventTriples(sampleEntry);
    const rendered = triples.map((triple) => ({
      subject: triple.subject.value,
      predicate: triple.predicate.value,
      object: triple.object.value,
      objectTermType: triple.object.termType,
    }));

    expect(rendered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: 'decision:evt-1', predicate: 'rdf:type', object: 'ctx:ShareEvent' }),
        expect.objectContaining({ subject: 'decision:evt-1', predicate: 'ctx:forIntent', object: 'ctx:share' }),
        expect.objectContaining({ subject: 'decision:evt-1', predicate: 'ctx:recommendedTarget', object: 'contact:mom' }),
        expect.objectContaining({ subject: 'decision:evt-1', predicate: 'ctx:selectedTarget', object: 'app:kakaotalk' }),
        expect.objectContaining({ subject: 'decision:evt-1', predicate: 'ctx:shareResult', object: 'success', objectTermType: 'Literal' }),
        expect.objectContaining({ subject: 'decision:evt-1', predicate: 'ctx:sharedAt', object: '2026-04-19T09:30:00.000Z', objectTermType: 'Literal' }),
      ]),
    );
  });

  it('appends persisted share history triples onto the base graph', () => {
    const baseGraph = buildContextGraph('family-photo', sampleEntry.input);

    const merged = appendShareHistoryToGraph(baseGraph, [sampleEntry]);
    const shareEventSubjects = merged.filter((triple) => triple.subject.value === 'decision:evt-1');

    expect(merged.length).toBeGreaterThan(baseGraph.length);
    expect(shareEventSubjects.length).toBeGreaterThan(0);
    expect(merged.some((triple) => triple.predicate.value === 'ctx:selectedTarget' && triple.object.value === 'app:kakaotalk')).toBe(true);
  });

  it('compresses older share events into summary nodes while keeping recent events raw', () => {
    const history = [
      makeEntry('evt-1', '2026-04-19T08:00:00.000Z'),
      makeEntry('evt-2', '2026-04-19T08:10:00.000Z'),
      makeEntry('evt-3', '2026-04-19T08:20:00.000Z', 'mom'),
      makeEntry('evt-4', '2026-04-19T08:30:00.000Z'),
      makeEntry('evt-5', '2026-04-19T08:40:00.000Z'),
      makeEntry('evt-6', '2026-04-19T08:50:00.000Z'),
      makeEntry('evt-7', '2026-04-19T09:00:00.000Z'),
    ];

    const compression = compressShareHistoryForGraph(history, SHARE_HISTORY_GRAPH_RECENT_LIMIT);

    expect(compression.recentEntries.map((entry) => entry.id)).toEqual(['evt-3', 'evt-4', 'evt-5', 'evt-6', 'evt-7']);
    expect(compression.summaries).toHaveLength(1);
    expect(compression.summaries[0]).toMatchObject({
      scenario: 'family-photo',
      selectedTargetId: 'kakaotalk',
      count: 2,
      firstSharedAt: '2026-04-19T08:00:00.000Z',
      lastSharedAt: '2026-04-19T08:10:00.000Z',
    });

    const baseGraph = buildContextGraph('family-photo', sampleEntry.input);
    const merged = appendShareHistoryToGraph(baseGraph, history);

    expect(merged.some((triple) => triple.subject.value === 'decision:evt-1')).toBe(false);
    expect(merged.some((triple) => triple.subject.value === 'decision:evt-2')).toBe(false);
    expect(merged.some((triple) => triple.subject.value === 'decision:evt-3')).toBe(true);
    expect(merged.some((triple) => triple.subject.value === 'decision:summary-family-photo-kakaotalk')).toBe(true);
    expect(
      merged.some(
        (triple) => triple.subject.value === 'decision:summary-family-photo-kakaotalk'
          && triple.predicate.value === 'ctx:shareCount'
          && triple.object.value === '2',
      ),
    ).toBe(true);
  });

  it('escapes persisted strings before they are inserted into HTML-based UI sections', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)> & "quote"')).toBe(
      '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quote&quot;',
    );
  });
});

describe('share history persistence', () => {
  const fakeStorage = (() => {
    let store = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(() => {
        store = new Map<string, string>();
      }),
    };
  })();

  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage);
    fakeStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips share history entries through localStorage', () => {
    expect(saveShareHistory([sampleEntry])).toBe(true);

    const loaded = loadShareHistory();

    expect(fakeStorage.setItem).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual([sampleEntry]);
  });

  it('appends new events onto the latest persisted history before saving', () => {
    const otherEntry: ShareHistoryEntry = {
      ...sampleEntry,
      id: 'evt-0',
      selectedTargetId: 'mom',
      selectedTargetLabel: '엄마',
      recommendedTargetId: 'mom',
      sharedAt: '2026-04-19T09:00:00.000Z',
    };
    fakeStorage.setItem('rdf-demo/share-history', JSON.stringify([otherEntry]));

    const persisted = persistShareHistoryEntry(sampleEntry);

    expect(persisted).toEqual([otherEntry, sampleEntry]);
    expect(loadShareHistory()).toEqual([otherEntry, sampleEntry]);
  });

  it('reports failure when localStorage writes throw', () => {
    fakeStorage.setItem.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });

    expect(saveShareHistory([sampleEntry])).toBe(false);
  });

  it('returns an empty history when localStorage contains malformed data', () => {
    fakeStorage.setItem('rdf-demo/share-history', '{not-json');

    expect(loadShareHistory()).toEqual([]);
  });

  it('clears persisted history from localStorage', () => {
    expect(saveShareHistory([sampleEntry])).toBe(true);
    expect(loadShareHistory()).toHaveLength(1);

    expect(clearShareHistory()).toBe(true);
    expect(loadShareHistory()).toEqual([]);
    expect(fakeStorage.removeItem).toHaveBeenCalledWith('rdf-demo/share-history');
  });

  it('returns false when clearing history throws', () => {
    fakeStorage.removeItem.mockImplementationOnce(() => {
      throw new Error('cannot remove');
    });

    expect(clearShareHistory()).toBe(false);
  });
});
