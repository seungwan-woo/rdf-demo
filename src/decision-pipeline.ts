import { buildContextGraph, buildDecisionEvidence, explanationFor, rankCandidates, type ContextInput, type DecisionEvidence, type Recommendation, type ScenarioKey } from './domain';
import { appendShareHistoryToGraph, compressShareHistoryForGraph, type ShareHistoryCompression, type ShareHistoryEntry } from './share-history';
import type { Graph } from './rdf';

export type DecisionWorkspace = Readonly<{
  scenario: ScenarioKey;
  input: ContextInput;
  baseGraph: Graph;
  workingGraph: Graph;
  historyCompression: ShareHistoryCompression;
  ranked: ReadonlyArray<Recommendation>;
  evidence: DecisionEvidence;
  explanation: ReturnType<typeof explanationFor>;
}>;

export const buildDecisionWorkspace = (
  scenario: ScenarioKey,
  input: ContextInput,
  history: ReadonlyArray<ShareHistoryEntry> = [],
): DecisionWorkspace => {
  const scenarioHistory = history.filter((entry) => entry.scenario === scenario);
  const baseGraph = buildContextGraph(scenario, input);
  const historyCompression = compressShareHistoryForGraph(scenarioHistory);
  const workingGraph = appendShareHistoryToGraph(baseGraph, scenarioHistory);
  const ranked = rankCandidates(scenario, input, scenarioHistory);
  const evidence = buildDecisionEvidence(scenario, input, scenarioHistory);
  const explanation = explanationFor(scenario, input, workingGraph);

  return {
    scenario,
    input,
    baseGraph,
    workingGraph,
    historyCompression,
    ranked,
    evidence,
    explanation,
  };
};
