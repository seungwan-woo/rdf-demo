import { pipe } from 'fp-ts/function';
import * as A from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import { blank, Graph, iri, literal, triple, type Triple } from './rdf';

export type ScenarioKey = 'family-photo' | 'work-doc' | 'social-link';

export type ContextInput = Readonly<{
  contentType: 'image' | 'document' | 'link';
  sourceApp: 'gallery' | 'mail' | 'browser' | 'chat';
  timeBand: 'morning' | 'afternoon' | 'evening';
  place: 'home' | 'office' | 'moving';
}>;

export type Candidate = Readonly<{
  id: string;
  label: string;
  kind: 'contact' | 'app';
  affinityTags: ReadonlyArray<string>;
}>;

export type ScoreBreakdown = Readonly<{
  base: number;
  scenario: number;
  content: number;
  timePlace: number;
  total: number;
}>;

export type Recommendation = Readonly<{
  candidate: Candidate;
  score: number;
  reasons: ReadonlyArray<string>;
  breakdown: ScoreBreakdown;
}>;

export type DecisionEvidence = Readonly<{
  scenarioLabel: string;
  topRecommendation: Recommendation;
  ranked: ReadonlyArray<Recommendation>;
  dominantSignals: ReadonlyArray<string>;
}>;

export const candidates: ReadonlyArray<Candidate> = [
  { id: 'mom', label: '엄마', kind: 'contact', affinityTags: ['family', 'image', 'home', 'evening'] },
  { id: 'best-friend', label: '베스트프렌드', kind: 'contact', affinityTags: ['social', 'image', 'link', 'evening'] },
  { id: 'team-lead', label: '팀 리드', kind: 'contact', affinityTags: ['work', 'document', 'office', 'afternoon'] },
  { id: 'coworker', label: '동료', kind: 'contact', affinityTags: ['work', 'document', 'office'] },
  { id: 'slack', label: 'Slack', kind: 'app', affinityTags: ['work', 'document', 'office'] },
  { id: 'kakaotalk', label: '카카오톡', kind: 'app', affinityTags: ['social', 'image', 'home', 'evening'] },
  { id: 'gmail', label: 'Gmail', kind: 'app', affinityTags: ['work', 'document', 'office'] },
];

const pdeFacts: Readonly<Record<ScenarioKey, ReadonlyArray<Triple>>> = {
  'family-photo': [
    triple(iri('pde:mom'), iri('rdf:type'), iri('pde:FamilyMember')),
    triple(iri('pde:best-friend'), iri('pde:affinity'), literal('high')),
    triple(iri('pde:family-cluster'), iri('pde:contains'), iri('pde:mom')),
  ],
  'work-doc': [
    triple(iri('pde:team-lead'), iri('rdf:type'), iri('pde:WorkContact')),
    triple(iri('pde:coworker'), iri('pde:affinity'), literal('high')),
    triple(iri('pde:workspace'), iri('pde:contains'), iri('pde:team-lead')),
  ],
  'social-link': [
    triple(iri('pde:best-friend'), iri('rdf:type'), iri('pde:CloseFriend')),
    triple(iri('pde:kakaotalk'), iri('pde:channel'), literal('chat')),
    triple(iri('pde:social-circle'), iri('pde:contains'), iri('pde:best-friend')),
  ],
};

export const scenarioDefaults: Readonly<Record<ScenarioKey, ContextInput>> = {
  'family-photo': { contentType: 'image', sourceApp: 'gallery', timeBand: 'evening', place: 'home' },
  'work-doc': { contentType: 'document', sourceApp: 'mail', timeBand: 'afternoon', place: 'office' },
  'social-link': { contentType: 'link', sourceApp: 'browser', timeBand: 'evening', place: 'home' },
};

export const scenarioLabel: Record<ScenarioKey, string> = {
  'family-photo': '가족 사진 공유',
  'work-doc': '업무 문서 공유',
  'social-link': '링크 공유',
};

export const buildContextGraph = (scenario: ScenarioKey, input: ContextInput): Graph => {
  const base = [
    triple(iri('ctx:share'), iri('rdf:type'), iri('ctx:ShareIntent')),
    triple(iri('ctx:share'), iri('ctx:contentType'), literal(input.contentType)),
    triple(iri('ctx:share'), iri('ctx:sourceApp'), literal(input.sourceApp)),
    triple(iri('ctx:share'), iri('ctx:timeBand'), literal(input.timeBand)),
    triple(iri('ctx:share'), iri('ctx:place'), literal(input.place)),
    triple(iri('ctx:share'), iri('ctx:scenario'), literal(scenario)),
    triple(iri('ctx:share'), iri('ctx:hasLongTermContext'), iri('pde:profile')),
    triple(iri('ctx:share'), iri('ctx:hasRuntimeContext'), iri('ce:runtime')),
    triple(iri('pde:profile'), iri('rdf:type'), iri('pde:LongTermContext')),
    triple(iri('ce:runtime'), iri('rdf:type'), iri('ce:RuntimeContext')),
    triple(iri('decision:1'), iri('rdf:type'), iri('ctx:Decision')),
    triple(iri('decision:1'), iri('ctx:forIntent'), iri('ctx:share')),
    triple(iri('decision:1'), iri('ctx:produces'), iri('ctx:ranking')),
    triple(blank('outcome-1'), iri('ctx:refersTo'), iri('decision:1')),
  ];

  return [...base, ...pdeFacts[scenario]];
};

const hasTag = (tags: ReadonlyArray<string>, needle: string): boolean =>
  pipe(tags, A.some((tag) => tag === needle));

const featureMatches = (candidate: Candidate, input: ContextInput): ReadonlyArray<string> => {
  const checks: ReadonlyArray<[boolean, string]> = [
    [hasTag(candidate.affinityTags, input.place), `장소(${input.place}) 적합`],
    [hasTag(candidate.affinityTags, input.timeBand), `시간대(${input.timeBand}) 적합`],
    [hasTag(candidate.affinityTags, input.contentType), `콘텐츠(${input.contentType}) 적합`],
    [hasTag(candidate.affinityTags, input.sourceApp), `소스앱(${input.sourceApp}) 적합`],
  ];

  return pipe(checks, A.filterMap(([ok, label]) => (ok ? O.some(label) : O.none)));
};

const baseScore = (candidate: Candidate): number => (candidate.kind === 'contact' ? 10 : 6);

const scenarioBonus = (candidate: Candidate, scenario: ScenarioKey): number => {
  const tagByScenario: Record<ScenarioKey, string> = {
    'family-photo': 'family',
    'work-doc': 'work',
    'social-link': 'social',
  };
  return hasTag(candidate.affinityTags, tagByScenario[scenario]) ? 8 : 0;
};

const contentBonus = (candidate: Candidate, input: ContextInput): number =>
  hasTag(candidate.affinityTags, input.contentType) ? 5 : 0;

const timePlaceBonus = (candidate: Candidate, input: ContextInput): number => {
  const timeBonus = hasTag(candidate.affinityTags, input.timeBand) ? 3 : 0;
  const placeBonus = hasTag(candidate.affinityTags, input.place) ? 3 : 0;
  return timeBonus + placeBonus;
};

const scoreCandidate = (scenario: ScenarioKey, input: ContextInput, candidate: Candidate): Recommendation => {
  const base = baseScore(candidate);
  const scenarioScore = scenarioBonus(candidate, scenario);
  const content = contentBonus(candidate, input);
  const timePlace = timePlaceBonus(candidate, input);
  const total = base + scenarioScore + content + timePlace;
  const reasons = featureMatches(candidate, input);
  return {
    candidate,
    score: total,
    reasons,
    breakdown: {
      base,
      scenario: scenarioScore,
      content,
      timePlace,
      total,
    },
  };
};

export const rankCandidates = (scenario: ScenarioKey, input: ContextInput): ReadonlyArray<Recommendation> => {
  const ranked = pipe(candidates, A.map((candidate) => scoreCandidate(scenario, input, candidate)));
  return [...ranked].sort((a, b) => b.score - a.score || a.candidate.label.localeCompare(b.candidate.label, 'ko'));
};

export const buildDecisionEvidence = (scenario: ScenarioKey, input: ContextInput): DecisionEvidence => {
  const ranked = rankCandidates(scenario, input);
  const dominantSignals = ranked[0]
    ? [
        `scenario=${scenarioLabel[scenario]}`,
        `top=${ranked[0].candidate.label}`,
        `score=${ranked[0].score}`,
        ...ranked[0].reasons.slice(0, 3),
      ]
    : [];

  return {
    scenarioLabel: scenarioLabel[scenario],
    topRecommendation: ranked[0] ?? scoreCandidate(scenario, input, candidates[0]!),
    ranked,
    dominantSignals,
  };
};

export const explanationFor = (scenario: ScenarioKey, input: ContextInput, graph: Graph) => ({
  scenarioLabel: scenarioLabel[scenario],
  graphSize: graph.length,
  summary: `PDE 장기 컨텍스트와 CE 실시간 컨텍스트를 결합해 ${scenarioLabel[scenario]}에 맞는 share target를 정렬합니다.`,
  contextLines: [
    `contentType=${input.contentType}`,
    `sourceApp=${input.sourceApp}`,
    `timeBand=${input.timeBand}`,
    `place=${input.place}`,
  ],
});
