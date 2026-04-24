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

export type ShareHistoryGraphSummary = Readonly<{
  nodeId: string;
  scenario: ScenarioKey;
  selectedTargetId: string;
  selectedTargetLabel: string;
  count: number;
  firstSharedAt: string;
  lastSharedAt: string;
  representative: ShareHistoryEntry;
}>;

export type ShareHistoryCompression = Readonly<{
  recentEntries: ReadonlyArray<ShareHistoryEntry>;
  summaries: ReadonlyArray<ShareHistoryGraphSummary>;
}>;

export const SHARE_HISTORY_STORAGE_KEY = 'rdf-demo/share-history';
export const SHARE_HISTORY_GRAPH_RECENT_LIMIT = 5;

const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));

const targetTerm = (candidateId: string) => {
  const candidate = candidateById.get(candidateId);
  const prefix = candidate?.kind === 'app'
    ? 'app'
    : candidate?.kind === 'restaurant'
      ? 'restaurant'
      : 'contact';
  return iri(`${prefix}:${candidateId}`);
};

const eventNode = (entryId: string) => iri(`decision:${entryId}`);
const summaryNode = (scenario: ScenarioKey, selectedTargetId: string) =>
  iri(`decision:summary-${scenario}-${selectedTargetId}`);

const compareBySharedAt = (left: ShareHistoryEntry, right: ShareHistoryEntry): number =>
  left.sharedAt.localeCompare(right.sharedAt);

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

export const buildShareHistorySummaryTriples = (summary: ShareHistoryGraphSummary): ReadonlyArray<Triple> => {
  const node = summaryNode(summary.scenario, summary.selectedTargetId);
  return [
    triple(node, iri('rdf:type'), iri('ctx:ShareEventSummary')),
    triple(node, iri('ctx:forIntent'), iri('ctx:share')),
    triple(node, iri('ctx:scenario'), literal(summary.scenario)),
    triple(node, iri('ctx:selectedTarget'), targetTerm(summary.selectedTargetId)),
    triple(node, iri('ctx:selectedTargetLabel'), literal(summary.selectedTargetLabel)),
    triple(node, iri('ctx:shareCount'), literal(String(summary.count))),
    triple(node, iri('ctx:firstSharedAt'), literal(summary.firstSharedAt)),
    triple(node, iri('ctx:lastSharedAt'), literal(summary.lastSharedAt)),
    triple(node, iri('ctx:contentType'), literal(summary.representative.input.contentType)),
    triple(node, iri('ctx:sourceApp'), literal(summary.representative.input.sourceApp)),
    triple(node, iri('ctx:timeBand'), literal(summary.representative.input.timeBand)),
    triple(node, iri('ctx:place'), literal(summary.representative.input.place)),
    triple(node, iri('ctx:compressionStrategy'), literal(`recent-${SHARE_HISTORY_GRAPH_RECENT_LIMIT} + scenario/target summary`)),
  ];
};

export const compressShareHistoryForGraph = (
  history: ReadonlyArray<ShareHistoryEntry>,
  recentEventCount: number = SHARE_HISTORY_GRAPH_RECENT_LIMIT,
): ShareHistoryCompression => {
  if (history.length <= recentEventCount) {
    return { recentEntries: [...history].sort(compareBySharedAt), summaries: [] };
  }

  const ordered = [...history].sort(compareBySharedAt);
  const boundaryIndex = Math.max(0, ordered.length - recentEventCount);
  const olderEntries = ordered.slice(0, boundaryIndex);
  const recentEntries = ordered.slice(boundaryIndex);
  const grouped = new Map<string, ShareHistoryEntry[]>();

  for (const entry of olderEntries) {
    const key = `${entry.scenario}::${entry.selectedTargetId}`;
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }

  const summaries = Array.from(grouped.values())
    .map((entries) => {
      const sorted = [...entries].sort(compareBySharedAt);
      const representative = sorted[sorted.length - 1]!;
      return {
        nodeId: `decision:summary-${representative.scenario}-${representative.selectedTargetId}`,
        scenario: representative.scenario,
        selectedTargetId: representative.selectedTargetId,
        selectedTargetLabel: representative.selectedTargetLabel,
        count: entries.length,
        firstSharedAt: sorted[0]!.sharedAt,
        lastSharedAt: sorted[sorted.length - 1]!.sharedAt,
        representative,
      } satisfies ShareHistoryGraphSummary;
    })
    .sort((left, right) => left.lastSharedAt.localeCompare(right.lastSharedAt));

  return { recentEntries, summaries };
};

export const appendShareHistoryToGraph = (graph: Graph, history: ReadonlyArray<ShareHistoryEntry>): Graph => {
  const compression = compressShareHistoryForGraph(history);
  return [
    ...graph,
    ...compression.summaries.flatMap((summary) => buildShareHistorySummaryTriples(summary)),
    ...compression.recentEntries.flatMap((entry) => buildShareEventTriples(entry)),
  ];
};

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
