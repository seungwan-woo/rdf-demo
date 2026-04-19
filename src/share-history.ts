import { candidates, type ContextInput, type ScenarioKey } from './domain';
import { iri, literal, triple, type Graph, type Triple } from './rdf';

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export type ShareHistoryEntry = Readonly<{
  id: string;
  scenario: ScenarioKey;
  input: ContextInput;
  recommendedTargetId: string;
  selectedTargetId: string;
  selectedTargetLabel: string;
  result: 'success';
  sharedAt: string;
}>;

export const SHARE_HISTORY_STORAGE_KEY = 'rdf-demo/share-history';

const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));

const targetTerm = (candidateId: string) => {
  const candidate = candidateById.get(candidateId);
  const prefix = candidate?.kind === 'app' ? 'app' : 'contact';
  return iri(`${prefix}:${candidateId}`);
};

const eventNode = (entryId: string) => iri(`decision:${entryId}`);

export const buildShareEventTriples = (entry: ShareHistoryEntry): ReadonlyArray<Triple> => {
  const event = eventNode(entry.id);
  return [
    triple(event, iri('rdf:type'), iri('ctx:ShareEvent')),
    triple(event, iri('ctx:forIntent'), iri('ctx:share')),
    triple(event, iri('ctx:scenario'), literal(entry.scenario)),
    triple(event, iri('ctx:contentType'), literal(entry.input.contentType)),
    triple(event, iri('ctx:sourceApp'), literal(entry.input.sourceApp)),
    triple(event, iri('ctx:timeBand'), literal(entry.input.timeBand)),
    triple(event, iri('ctx:place'), literal(entry.input.place)),
    triple(event, iri('ctx:recommendedTarget'), targetTerm(entry.recommendedTargetId)),
    triple(event, iri('ctx:selectedTarget'), targetTerm(entry.selectedTargetId)),
    triple(event, iri('ctx:selectedTargetLabel'), literal(entry.selectedTargetLabel)),
    triple(event, iri('ctx:shareResult'), literal(entry.result)),
    triple(event, iri('ctx:sharedAt'), literal(entry.sharedAt)),
  ];
};

export const appendShareHistoryToGraph = (graph: Graph, history: ReadonlyArray<ShareHistoryEntry>): Graph => [
  ...graph,
  ...history.flatMap((entry) => buildShareEventTriples(entry)),
];

const isValidEntry = (value: unknown): value is ShareHistoryEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  const input = entry.input as Record<string, unknown> | undefined;
  return typeof entry.id === 'string'
    && typeof entry.scenario === 'string'
    && !!input
    && typeof input.contentType === 'string'
    && typeof input.sourceApp === 'string'
    && typeof input.timeBand === 'string'
    && typeof input.place === 'string'
    && typeof entry.recommendedTargetId === 'string'
    && typeof entry.selectedTargetId === 'string'
    && typeof entry.selectedTargetLabel === 'string'
    && entry.result === 'success'
    && typeof entry.sharedAt === 'string';
};

export const loadShareHistory = (): ReadonlyArray<ShareHistoryEntry> => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SHARE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
};

export const saveShareHistory = (history: ReadonlyArray<ShareHistoryEntry>): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(SHARE_HISTORY_STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
};

export const persistShareHistoryEntry = (entry: ShareHistoryEntry): ReadonlyArray<ShareHistoryEntry> | null => {
  const nextHistory = [...loadShareHistory(), entry];
  return saveShareHistory(nextHistory) ? nextHistory : null;
};
