import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContextGraph } from './domain';
import {
  appendShareHistoryToGraph,
  buildShareEventTriples,
  escapeHtml,
  loadShareHistory,
  persistShareHistoryEntry,
  saveShareHistory,
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
});
