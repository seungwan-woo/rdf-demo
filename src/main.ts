import { candidates, scenarioDefaults, type ContextInput, type Recommendation, type ScenarioKey } from './domain';
import { buildDecisionWorkspace, type DecisionWorkspace } from './decision-pipeline';
import { renderGraph } from './rdf';
import { renderGraphViz, type GraphViz, type GraphVizEdge, type GraphVizNode } from './graph-viz';
import { buildLabelCatalog, describeRdfTerm, formatContextLine, optionLabel } from './labels';
import { clearShareHistory, escapeHtml, loadShareHistory, saveShareHistory, type ShareHistoryEntry } from './share-history';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

const scenarioOptions: ReadonlyArray<{ value: ScenarioKey; label: string }> = [
  { value: 'family-photo', label: '가족 사진 공유 (Family photo share)' },
  { value: 'work-doc', label: '업무 문서 공유 (Work document share)' },
  { value: 'social-link', label: '링크 공유 (Social link share)' },
  { value: 'app-surfacing', label: '앱 우선 노출 추천 (App surfacing recommendation)' },
  { value: 'restaurant-recommendation', label: '음식점 추천 (Restaurant recommendation)' },
];

const labels = buildLabelCatalog();
let shareHistory: ReadonlyArray<ShareHistoryEntry> = loadShareHistory();
let shareStatusMessage = '공유 이력은 localStorage에 저장됩니다. (Share history persists to localStorage)';

const section = document.createElement('main');
section.className = 'shell';

section.innerHTML = `
  <header class="hero">
    <div>
      <p class="eyebrow">${labels.heroEyebrow}</p>
      <h1>${labels.heroTitle}</h1>
      <p class="subtitle">${labels.heroSubtitle}</p>
    </div>
    <div class="badge">${labels.githubPagesBadge}</div>
  </header>
`;

const controls = document.createElement('section');
controls.className = 'panel';
controls.innerHTML = `<h2>${labels.controlsTitle}</h2>`;

const shareControls = document.createElement('section');
shareControls.className = 'panel';
shareControls.innerHTML = `<h2>${labels.shareControlsTitle}</h2>`;

const scenarioSelect = document.createElement('select');
scenarioSelect.className = 'wide';
for (const option of scenarioOptions) {
  const el = document.createElement('option');
  el.value = option.value;
  el.textContent = option.label;
  scenarioSelect.appendChild(el);
}
scenarioSelect.value = 'family-photo';

const contentTypeSelect = document.createElement('select');
contentTypeSelect.className = 'wide';
for (const value of ['image', 'document', 'link'] as const) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = optionLabel('contentType', value);
  contentTypeSelect.appendChild(option);
}

const sourceAppSelect = document.createElement('select');
sourceAppSelect.className = 'wide';
for (const value of ['gallery', 'mail', 'browser', 'chat'] as const) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = optionLabel('sourceApp', value);
  sourceAppSelect.appendChild(option);
}

const timeBandSelect = document.createElement('select');
timeBandSelect.className = 'wide';
for (const value of ['morning', 'afternoon', 'evening'] as const) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = optionLabel('timeBand', value);
  timeBandSelect.appendChild(option);
}

const placeSelect = document.createElement('select');
placeSelect.className = 'wide';
for (const value of ['home', 'office', 'moving'] as const) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = optionLabel('place', value);
  placeSelect.appendChild(option);
}

const runButton = document.createElement('button');
runButton.className = 'primary';
runButton.textContent = labels.runButton;

const shareTargetSelect = document.createElement('select');
shareTargetSelect.className = 'wide';

const shareButton = document.createElement('button');
shareButton.className = 'primary share-button';
shareButton.textContent = labels.shareButton;

const seedDemoButton = document.createElement('button');
seedDemoButton.className = 'secondary share-button';
seedDemoButton.textContent = '데모 데이터 채우기 (Seed demo data)';

const resetHistoryButton = document.createElement('button');
resetHistoryButton.className = 'danger share-button';
resetHistoryButton.textContent = '데이터 초기화 (Reset data)';

const shareHistoryPanel = document.createElement('div');
shareHistoryPanel.className = 'share-history-panel';

const form = document.createElement('div');
form.className = 'grid';
form.append(
  labelWrap('시나리오 (Scenario)', scenarioSelect),
  labelWrap(formatContextLine('contentType', contentTypeSelect.value).split(':')[0]!, contentTypeSelect),
  labelWrap(formatContextLine('sourceApp', sourceAppSelect.value).split(':')[0]!, sourceAppSelect),
  labelWrap(formatContextLine('timeBand', timeBandSelect.value).split(':')[0]!, timeBandSelect),
  labelWrap(formatContextLine('place', placeSelect.value).split(':')[0]!, placeSelect),
  runButton,
);

const shareForm = document.createElement('div');
shareForm.className = 'share-grid';

const shareActionButtons = document.createElement('div');
shareActionButtons.className = 'share-actions';
shareActionButtons.append(shareButton, seedDemoButton, resetHistoryButton);

shareForm.append(
  labelWrap(labels.shareTargetLabel, shareTargetSelect),
  shareActionButtons,
);

const usageTips = document.createElement('details');
usageTips.className = 'usage-tips';
usageTips.innerHTML = `
  <summary>사용 가이드 (How to use)</summary>
  <ol>
    <li>시나리오를 선택하고 추천 실행을 눌러 현재 추천을 확인합니다.</li>
    <li>공유/선택 결과를 기록하면 다음 추천에 history bonus가 반영됩니다.</li>
    <li>데모 데이터 채우기로 시나리오별 이력을 빠르게 만들 수 있습니다.</li>
    <li>데이터 초기화로 localStorage 이력을 즉시 비울 수 있습니다.</li>
  </ol>
`;

controls.appendChild(form);
shareControls.append(usageTips, shareForm, shareHistoryPanel);

const output = document.createElement('section');
output.className = 'output-grid';

const graphCard = card(labels.graphTitle);
const graphInspector = document.createElement('section');
graphInspector.className = 'panel graph-inspector';

const rankingCard = card(labels.rankingTitle);
const explanationCard = card(labels.explanationTitle);
const workspaceCard = card('아키텍처 스냅샷 (Architecture Snapshot)');
const legendCard = card(labels.designNotesTitle);

const graphColumn = document.createElement('section');
graphColumn.className = 'graph-column';
graphColumn.append(graphCard, graphInspector);

output.append(graphColumn, rankingCard, explanationCard, workspaceCard, legendCard);

section.append(controls, shareControls, output);
app.append(section);

const setDefaults = (scenario: ScenarioKey): void => {
  const defaults = scenarioDefaults[scenario];
  contentTypeSelect.value = defaults.contentType;
  sourceAppSelect.value = defaults.sourceApp;
  timeBandSelect.value = defaults.timeBand;
  placeSelect.value = defaults.place;
};

const kindLabel = (kind: GraphVizNode['kind']): string => {
  switch (kind) {
    case 'ctx':
      return describeRdfTerm('Working Context');
    case 'pde':
      return describeRdfTerm('PDE / Long-term');
    case 'ce':
      return describeRdfTerm('CE / Runtime');
    case 'decision':
      return describeRdfTerm('Decision / Outcome');
    case 'literal':
      return describeRdfTerm('Literal Evidence');
    case 'other':
    default:
      return describeRdfTerm('Other');
  }
};

const makeList = (items: ReadonlyArray<string>, className: string): HTMLUListElement => {
  const ul = document.createElement('ul');
  ul.className = className;
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
  return ul;
};

const renderNodeInspector = (node: GraphVizNode, viz: GraphViz): void => {
  const outgoing = viz.edges.filter((edge) => edge.sourceKey === node.key);
  const incoming = viz.edges.filter((edge) => edge.targetKey === node.key);
  const relatedNodeKeys = new Set<string>([node.key]);
  outgoing.forEach((edge) => {
    relatedNodeKeys.add(edge.targetKey);
  });
  incoming.forEach((edge) => {
    relatedNodeKeys.add(edge.sourceKey);
  });

  const container = document.createElement('div');
  container.className = 'inspector-body';

  const header = document.createElement('div');
  header.className = 'inspector-header';
  header.innerHTML = `
    <p class="chip">${kindLabel(node.kind)}</p>
    <h4>${escapeHtml(node.label)}</h4>
    <p>${node.kind === 'ctx' ? '현재 share intent를 구성하는 작업 그래프의 중심 노드입니다.' : node.kind === 'pde' ? '장기 관계와 affinity evidence를 담고 있습니다.' : node.kind === 'ce' ? '실시간 시간/장소/앱 상태를 담고 있습니다.' : node.kind === 'decision' ? '의사결정과 결과 피드백을 기록합니다.' : '보조 evidence 노드입니다.'}</p>
  `;

  const meta = document.createElement('div');
  meta.className = 'inspector-meta';
  meta.innerHTML = `<span>나가는 연결 ${outgoing.length}개 (outgoing)</span><span>들어오는 연결 ${incoming.length}개 (incoming)</span><span>연결 노드 ${relatedNodeKeys.size}개 (connected nodes)</span>`;

  const outgoingList = makeList(
    outgoing.map((edge) => `${edge.predicate} → ${edge.targetLabel}`),
    'inspector-list',
  );
  const incomingList = makeList(
    incoming.map((edge) => `${edge.predicate} ← ${edge.sourceLabel}`),
    'inspector-list',
  );

  const related = document.createElement('div');
  related.className = 'inspector-related';
  related.innerHTML = '<h5>이웃 노드 (Neighborhood)</h5>';
  related.append(
    makeList(
      Array.from(relatedNodeKeys).map((key) => {
        const found = viz.nodes.find((n) => n.key === key);
        return found ? `${found.label} (${kindLabel(found.kind)})` : key;
      }),
      'inspector-list compact',
    ),
  );

  const sections = document.createElement('div');
  sections.className = 'inspector-sections';

  const outgoingBlock = document.createElement('section');
  outgoingBlock.innerHTML = '<h5>나가는 증거 (Outgoing evidence)</h5>';
  outgoingBlock.append(outgoingList);

  const incomingBlock = document.createElement('section');
  incomingBlock.innerHTML = '<h5>들어오는 증거 (Incoming evidence)</h5>';
  incomingBlock.append(incomingList);

  sections.append(outgoingBlock, incomingBlock);
  container.append(header, meta, sections, related);
  graphInspector.replaceChildren(titleNode(labels.graphInspectorTitle), container);
};

const renderEdgeInspector = (edge: GraphVizEdge): void => {
  const container = document.createElement('div');
  container.className = 'inspector-body';
  const header = document.createElement('div');
  header.className = 'inspector-header';
  header.innerHTML = `
    <p class="chip">엣지 증거 (EDGE EVIDENCE)</p>
    <h4>${escapeHtml(edge.predicate)}</h4>
    <p>${escapeHtml(edge.sourceLabel)} → ${escapeHtml(edge.targetLabel)}</p>
  `;

  const meta = document.createElement('div');
  meta.className = 'inspector-meta';
  meta.innerHTML = '<span>트리플 (triple)</span><span>술어 (predicate)</span><span>관계 (relation)</span>';

  const body = document.createElement('div');
  body.className = 'inspector-edge';
  body.innerHTML = `
    <p><strong>RDF 트리플 (RDF triple)</strong></p>
    <pre class="graph">${escapeHtml(`${edge.sourceLabel} ${edge.predicate} ${edge.targetLabel} .`)}</pre>
    <p>이 엣지는 노드 사이의 증거 연결(evidence link)을 설명합니다.</p>
  `;

  container.append(header, meta, body);
  graphInspector.replaceChildren(titleNode(labels.graphInspectorTitle), container);
};

const renderDecisionInspector = (evidence: DecisionWorkspace['evidence']): void => {
  const container = document.createElement('div');
  container.className = 'inspector-body';

  const header = document.createElement('div');
  header.className = 'inspector-header';
  header.innerHTML = `
    <p class="chip">의사결정 근거 (DECISION BASIS)</p>
    <h4>${evidence.topRecommendation.candidate.label}</h4>
    <p>${evidence.scenarioLabel}에서 가장 높은 점수를 받은 후보입니다.</p>
  `;

  const meta = document.createElement('div');
  meta.className = 'inspector-meta';
  meta.innerHTML = `
    <span>score ${evidence.topRecommendation.score}</span>
    <span>base ${evidence.topRecommendation.breakdown.base}</span>
    <span>scenario ${evidence.topRecommendation.breakdown.scenario}</span>
    <span>content ${evidence.topRecommendation.breakdown.content}</span>
    <span>time/place ${evidence.topRecommendation.breakdown.timePlace}</span>
  `;

  const bar = (label: string, value: number, max: number, accent: string): string => {
    const pct = max <= 0 ? 0 : Math.max(8, (value / max) * 100);
    return `
      <div class="decision-bar">
        <div class="decision-bar__label"><span>${label}</span><span>${value}</span></div>
        <div class="decision-bar__track"><div class="decision-bar__fill" style="width:${pct.toFixed(1)}%; background:${accent}"></div></div>
      </div>
    `;
  };

  const maxScore = Math.max(evidence.topRecommendation.breakdown.base, evidence.topRecommendation.breakdown.scenario, evidence.topRecommendation.breakdown.content, evidence.topRecommendation.breakdown.timePlace);

  const body = document.createElement('div');
  body.className = 'inspector-edge';
  body.innerHTML = `
    <p><strong>지배적인 신호 (Dominant signals)</strong></p>
    <div class="decision-signals">
      ${evidence.dominantSignals.map((signal) => `<span class="signal-pill">${signal}</span>`).join(' ')}
    </div>
    <p><strong>점수 분해 (Score breakdown)</strong></p>
    ${bar('기본값 base', evidence.topRecommendation.breakdown.base, maxScore, '#60a5fa')}
    ${bar('시나리오 scenario', evidence.topRecommendation.breakdown.scenario, maxScore, '#a78bfa')}
    ${bar('콘텐츠 content', evidence.topRecommendation.breakdown.content, maxScore, '#f59e0b')}
    ${bar('시간/장소 time/place', evidence.topRecommendation.breakdown.timePlace, maxScore, '#34d399')}
    <p><strong>상위 랭킹 사다리 (Top ranking ladder)</strong></p>
    <ol class="decision-ranking">
      ${evidence.ranked.slice(0, 4).map((item) => `<li>${item.candidate.label} <span>${item.score}</span></li>`).join('')}
    </ol>
    <p class="decision-note">의사결정은 단일 규칙이 아니라 시나리오, 콘텐츠, 런타임 컨텍스트를 합산한 결과입니다.</p>
  `;

  container.append(header, meta, body);
  graphInspector.replaceChildren(titleNode(labels.graphInspectorTitle), container);
};

const renderDefaultInspector = (viz: GraphViz, evidence: DecisionWorkspace['evidence']): void => {
  const container = document.createElement('div');
  container.className = 'inspector-body';
  container.innerHTML = `
    <div class="inspector-header">
      <p class="chip">개요 (OVERVIEW)</p>
      <h4>노드를 hover하거나 클릭하세요 (Hover or click a node)</h4>
      <p>현재 작업 그래프(working graph)는 PDE 장기 컨텍스트와 CE 실시간 컨텍스트를 결합합니다.</p>
    </div>
    <div class="inspector-meta">
      <span>${viz.summary}</span>
      <span>nodes: ${viz.nodes.length}</span>
      <span>edges: ${viz.edges.length}</span>
      <span>top: ${evidence.topRecommendation.candidate.label}</span>
      <span>score: ${evidence.topRecommendation.score}</span>
    </div>
    <div class="inspector-edge">
      <p>노드를 클릭하면 이웃(neighborhood)을 고정할 수 있고, 엣지 위로 이동하면 해당 트리플(triple)을 볼 수 있습니다.</p>
      <p><strong>현재 결정 (Current decision)</strong>: ${evidence.topRecommendation.candidate.label} (${evidence.topRecommendation.score})</p>
    </div>
  `;
  graphInspector.replaceChildren(titleNode(labels.graphInspectorTitle), container);
};

const bindGraphInteractions = (graphView: HTMLElement, viz: GraphViz, evidence: DecisionWorkspace['evidence']): void => {
  const svg = graphView.querySelector<SVGSVGElement>('svg');
  if (!svg) return;

  const nodeElements = Array.from(svg.querySelectorAll<SVGGElement>('[data-node-key]'));
  const edgeElements = Array.from(svg.querySelectorAll<SVGGElement>('[data-edge-key]'));
  const nodeByKey = new Map(viz.nodes.map((node) => [node.key, node] as const));
  const edgeByKey = new Map(viz.edges.map((edge) => [edge.key, edge] as const));
  const edgeKeysByNode = new Map<string, ReadonlyArray<string>>();

  const allNodeKeys = viz.nodes.map((node) => node.key);
  for (const nodeKey of allNodeKeys) {
    const keys: string[] = [];
    viz.edges.forEach((edge) => {
      if (edge.sourceKey === nodeKey || edge.targetKey === nodeKey) keys.push(edge.key);
    });
    edgeKeysByNode.set(nodeKey, keys);
  }

  const connectedNodeKeys = (focus: string): Set<string> => {
    const set = new Set<string>([focus]);
    viz.edges.forEach((edge) => {
      if (edge.sourceKey === focus) set.add(edge.targetKey);
      if (edge.targetKey === focus) set.add(edge.sourceKey);
    });
    return set;
  };

  const connectedEdgeKeys = (focus: string): Set<string> => new Set(edgeKeysByNode.get(focus) ?? []);

  type Focus = Readonly<{ type: 'node' | 'edge'; key: string }>;
  let pinned: Focus | null = null;

  const applyFocus = (focus: Focus | null, source: 'hover' | 'pin' | 'default'): void => {
    if (!focus) {
      nodeElements.forEach((el) => {
        el.classList.remove('is-dimmed', 'is-selected', 'is-connected');
      });
      edgeElements.forEach((el) => {
        el.classList.remove('is-dimmed', 'is-selected', 'is-connected');
      });
      renderDefaultInspector(viz, evidence);
      if (source !== 'pin') {
        svg.removeAttribute('data-focus');
      }
      return;
    }

    svg.setAttribute('data-focus', focus.type);

    if (focus.type === 'node') {
      const connectedNodes = connectedNodeKeys(focus.key);
      const connectedEdges = connectedEdgeKeys(focus.key);
      nodeElements.forEach((el) => {
        const key = el.dataset.nodeKey ?? '';
        el.classList.toggle('is-selected', key === focus.key);
        el.classList.toggle('is-connected', connectedNodes.has(key));
        el.classList.toggle('is-dimmed', key !== focus.key && !connectedNodes.has(key));
      });
      edgeElements.forEach((el) => {
        const key = el.dataset.edgeKey ?? '';
        el.classList.toggle('is-selected', connectedEdges.has(key));
        el.classList.toggle('is-connected', connectedEdges.has(key));
        el.classList.toggle('is-dimmed', !connectedEdges.has(key));
      });
      const node = nodeByKey.get(focus.key);
      if (node) {
        if (node.kind === 'decision') {
          renderDecisionInspector(evidence);
        } else {
          renderNodeInspector(node, viz);
        }
      }
      return;
    }

    const edge = edgeByKey.get(focus.key);
    if (!edge) return;
    nodeElements.forEach((el) => {
      const key = el.dataset.nodeKey ?? '';
      const active = key === edge.sourceKey || key === edge.targetKey;
      el.classList.toggle('is-selected', active);
      el.classList.toggle('is-connected', active);
      el.classList.toggle('is-dimmed', !active);
    });
    edgeElements.forEach((el) => {
      const key = el.dataset.edgeKey ?? '';
      el.classList.toggle('is-selected', key === edge.key);
      el.classList.toggle('is-connected', key === edge.key);
      el.classList.toggle('is-dimmed', key !== edge.key);
    });
    renderEdgeInspector(edge);
  };

  nodeElements.forEach((el) => {
    const key = el.dataset.nodeKey;
    if (!key) return;
    el.addEventListener('pointerenter', () => {
      if (pinned) return;
      applyFocus({ type: 'node', key }, 'hover');
    });
    el.addEventListener('pointerleave', () => {
      if (pinned) return;
      applyFocus(null, 'default');
    });
    el.addEventListener('focus', () => {
      if (pinned) return;
      applyFocus({ type: 'node', key }, 'hover');
    });
    el.addEventListener('blur', () => {
      if (pinned) return;
      applyFocus(null, 'default');
    });
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      pinned = pinned?.type === 'node' && pinned.key === key ? null : { type: 'node', key };
      applyFocus(pinned, 'pin');
    });
  });

  edgeElements.forEach((el) => {
    const key = el.dataset.edgeKey;
    if (!key) return;
    el.addEventListener('pointerenter', () => {
      if (pinned) return;
      applyFocus({ type: 'edge', key }, 'hover');
    });
    el.addEventListener('pointerleave', () => {
      if (pinned) return;
      applyFocus(null, 'default');
    });
    el.addEventListener('focus', () => {
      if (pinned) return;
      applyFocus({ type: 'edge', key }, 'hover');
    });
    el.addEventListener('blur', () => {
      if (pinned) return;
      applyFocus(null, 'default');
    });
  });

  svg.addEventListener('click', (event) => {
    if (event.target === svg) {
      pinned = null;
      applyFocus(null, 'default');
    }
  });

  renderDefaultInspector(viz, evidence);
};

const readInput = (): { scenario: ScenarioKey; input: ContextInput } => ({
  scenario: scenarioSelect.value as ScenarioKey,
  input: {
    contentType: contentTypeSelect.value as ContextInput['contentType'],
    sourceApp: sourceAppSelect.value as ContextInput['sourceApp'],
    timeBand: timeBandSelect.value as ContextInput['timeBand'],
    place: placeSelect.value as ContextInput['place'],
  },
});

const updateShareTargetOptions = (ranked: ReadonlyArray<Recommendation>): void => {
  const previous = shareTargetSelect.value;
  shareTargetSelect.replaceChildren();
  ranked.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.candidate.id;
    option.textContent = `${item.candidate.label} (${item.candidate.kind}) · score ${item.score}`;
    shareTargetSelect.appendChild(option);
  });

  if (ranked.some((item) => item.candidate.id === previous)) {
    shareTargetSelect.value = previous;
    return;
  }

  if (ranked[0]) {
    shareTargetSelect.value = ranked[0].candidate.id;
  }
};

const renderShareHistory = (): void => {
  const historyItems = [...shareHistory].slice(-5).reverse();
  const byScenario = new Map<string, number>();
  for (const entry of shareHistory) {
    byScenario.set(entry.scenario, (byScenario.get(entry.scenario) ?? 0) + 1);
  }
  const scenarioSummary = Array.from(byScenario.entries())
    .map(([scenario, count]) => `${escapeHtml(scenario)}=${count}`)
    .join(' · ');
  const historyList = historyItems.length > 0
    ? `<ol class="share-history-list">${historyItems.map((entry) => `
      <li>
        <strong>${escapeHtml(entry.selectedTargetLabel)}</strong>
        <span class="score">${escapeHtml(entry.result)}</span>
        <small>${escapeHtml(entry.scenario)} · rec=${escapeHtml(entry.recommendedTargetId)} · ${escapeHtml(entry.sharedAt)}</small>
      </li>
    `).join('')}</ol>`
    : `<p class="share-history-empty">${labels.shareHistoryEmpty}</p>`;

  shareHistoryPanel.innerHTML = `
    <div class="share-history-head">
      <p><strong>${labels.shareHistoryTitle}</strong></p>
      <p>${shareHistory.length} events persisted in localStorage</p>
      <p>scenario split: ${scenarioSummary || 'none'}</p>
      <p>${escapeHtml(shareStatusMessage)}</p>
    </div>
    ${historyList}
  `;
};

const render = (): void => {
  const { scenario, input } = readInput();
  const workspace = buildDecisionWorkspace(scenario, input, shareHistory);
  const graphViz = renderGraphViz(workspace.workingGraph);

  shareButton.textContent = scenario === 'app-surfacing'
    ? '앱 선택 기록 (Record app choice)'
    : scenario === 'restaurant-recommendation'
      ? '음식점 선택 기록 (Record restaurant choice)'
      : labels.shareButton;

  updateShareTargetOptions(workspace.ranked);
  renderShareHistory();

  const graphView = document.createElement('div');
  graphView.className = 'graph-view';
  graphView.innerHTML = graphViz.svg;

  const graphMeta = document.createElement('div');
  graphMeta.className = 'graph-meta';
  graphMeta.innerHTML = `
    <p><strong>${graphViz.summary}</strong></p>
    <details>
      <summary>${labels.rdfTriplesSummary}</summary>
      <pre class="graph">${escapeHtml(renderGraph(workspace.workingGraph).join('\n'))}</pre>
    </details>
  `;

  graphCard.replaceChildren(titleNode(labels.graphTitle), graphView, graphMeta);
  bindGraphInteractions(graphView, graphViz, workspace.evidence);

  const rankingList = document.createElement('ol');
  rankingList.className = 'ranking';
  workspace.ranked.slice(0, 5).forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${item.candidate.label}</strong> <span class="score">${item.score}</span><br/><small>${item.reasons.join(' · ') || '기본 prior만 반영 (base prior only)'}</small>`;
    rankingList.appendChild(li);
  });
  rankingCard.replaceChildren(titleNode(labels.rankingTitle), rankingList);

  const explanationBlock = document.createElement('div');
  explanationBlock.className = 'explain';
  explanationBlock.innerHTML = `
    <p><strong>${workspace.explanation.scenarioLabel}</strong></p>
    <p>${workspace.explanation.summary}</p>
    <ul>
      ${[
        formatContextLine('contentType', input.contentType),
        formatContextLine('sourceApp', input.sourceApp),
        formatContextLine('timeBand', input.timeBand),
        formatContextLine('place', input.place),
      ].map((line) => `<li>${line}</li>`).join('')}
    </ul>
    <p>${labels.graphSize}: ${workspace.explanation.graphSize} triples</p>
  `;
  explanationCard.replaceChildren(titleNode(labels.explanationTitle), explanationBlock);

  const architectureBlock = document.createElement('div');
  architectureBlock.className = 'notes';
  architectureBlock.innerHTML = `
    <p><strong>Layer boundary snapshot</strong></p>
    <ul>
      <li>Source(Input): scenario=${workspace.scenario}, content=${workspace.input.contentType}, sourceApp=${workspace.input.sourceApp}</li>
      <li>Storage(History): total ${shareHistory.length} events</li>
      <li>Working Graph: base ${workspace.baseGraph.length} + history merge => ${workspace.workingGraph.length} triples</li>
      <li>Compression: recent raw ${workspace.historyCompression.recentEntries.length} / summary ${workspace.historyCompression.summaries.length}</li>
      <li>Decision: top=${workspace.evidence.topRecommendation.candidate.label}, score=${workspace.evidence.topRecommendation.score}</li>
    </ul>
  `;
  workspaceCard.replaceChildren(titleNode('아키텍처 스냅샷 (Architecture Snapshot)'), architectureBlock);

  const lastEvent = shareHistory.length > 0 ? shareHistory[shareHistory.length - 1] : null;
  const notes = document.createElement('div');
  notes.className = 'notes';
  notes.innerHTML = `
    <ul>
      <li>PDE는 장기 관계와 친밀도(affinity)를 제공합니다.</li>
      <li>CE는 현재 시간, 장소, 앱 상태를 제공합니다.</li>
      <li>컨텍스트 그래프(Context Graph)는 두 정보를 합친 작업 그래프입니다.</li>
      <li>작업 그래프는 최근 raw ${workspace.historyCompression.recentEntries.length}건과 summary ${workspace.historyCompression.summaries.length}건만 반영합니다.</li>
      <li>RDF 트리플은 설명 가능성과 질의 가능성을 높입니다.</li>
      <li>fp-ts는 순수 함수 기반 조립과 정렬에 사용됩니다.</li>
      <li>이제 share 실행 결과도 localStorage 기반 RDF event로 누적됩니다.</li>
    </ul>
    <p>후보: ${candidates.length}개</p>
    <p>누적 share events: ${shareHistory.length}개</p>
    <p>최근 share: ${lastEvent ? `${escapeHtml(lastEvent.selectedTargetLabel)} · ${escapeHtml(lastEvent.sharedAt)}` : '없음 (none yet)'}</p>
  `;
  legendCard.replaceChildren(titleNode(labels.designNotesTitle), notes);
};

scenarioSelect.addEventListener('change', () => {
  setDefaults(scenarioSelect.value as ScenarioKey);
  render();
});

[contentTypeSelect, sourceAppSelect, timeBandSelect, placeSelect].forEach((el) => el.addEventListener('change', render));
runButton.addEventListener('click', render);

const appendHistoryEntry = (entry: ShareHistoryEntry): boolean => {
  const nextHistory: ReadonlyArray<ShareHistoryEntry> = [...shareHistory, entry];
  if (!saveShareHistory(nextHistory)) return false;
  shareHistory = nextHistory;
  return true;
};

const actionNounForScenario = (scenario: ScenarioKey): string => {
  if (scenario === 'app-surfacing') return '앱 선택';
  if (scenario === 'restaurant-recommendation') return '음식점 선택';
  return '공유';
};

const createEntry = (
  scenario: ScenarioKey,
  input: ContextInput,
  selectedTargetId: string,
  selectedTargetLabel: string,
  recommendedTargetId: string,
): ShareHistoryEntry => ({
  id: `share-event-${shareHistory.length + 1}`,
  scenario,
  input,
  recommendedTargetId,
  selectedTargetId,
  selectedTargetLabel,
  result: 'success',
  sharedAt: new Date().toISOString(),
});

shareButton.addEventListener('click', () => {
  const { scenario, input } = readInput();
  const workspace = buildDecisionWorkspace(scenario, input, shareHistory);
  const selectedTarget = candidates.find((candidate) => candidate.id === shareTargetSelect.value) ?? workspace.ranked[0]?.candidate;
  const recommendedTarget = workspace.ranked[0]?.candidate;

  if (!selectedTarget || !recommendedTarget) {
    shareStatusMessage = '기록 가능한 대상이 없습니다. (No target available)';
    render();
    return;
  }

  const success = appendHistoryEntry(createEntry(
    scenario,
    input,
    selectedTarget.id,
    selectedTarget.label,
    recommendedTarget.id,
  ));

  if (!success) {
    shareStatusMessage = 'localStorage 저장에 실패해 이력이 반영되지 않았습니다. (Persistence failed)';
    render();
    return;
  }

  shareStatusMessage = `${selectedTarget.label} ${actionNounForScenario(scenario)} 이력을 저장했습니다. (Saved successfully)`;
  render();
});

seedDemoButton.addEventListener('click', () => {
  const templates: ReadonlyArray<{
    scenario: ScenarioKey;
    input: ContextInput;
    selectedTargetId: string;
    selectedTargetLabel: string;
    recommendedTargetId: string;
  }> = [
    { scenario: 'family-photo', input: scenarioDefaults['family-photo'], selectedTargetId: 'kakaotalk', selectedTargetLabel: '카카오톡', recommendedTargetId: 'mom' },
    { scenario: 'work-doc', input: scenarioDefaults['work-doc'], selectedTargetId: 'slack', selectedTargetLabel: 'Slack', recommendedTargetId: 'slack' },
    { scenario: 'social-link', input: scenarioDefaults['social-link'], selectedTargetId: 'best-friend', selectedTargetLabel: '베스트프렌드', recommendedTargetId: 'best-friend' },
    { scenario: 'app-surfacing', input: scenarioDefaults['app-surfacing'], selectedTargetId: 'slack', selectedTargetLabel: 'Slack', recommendedTargetId: 'slack' },
    { scenario: 'restaurant-recommendation', input: scenarioDefaults['restaurant-recommendation'], selectedTargetId: 'chicken-place', selectedTargetLabel: '치킨집', recommendedTargetId: 'chicken-place' },
  ];

  let ok = true;
  for (const template of templates) {
    ok = appendHistoryEntry(createEntry(
      template.scenario,
      template.input,
      template.selectedTargetId,
      template.selectedTargetLabel,
      template.recommendedTargetId,
    ));
    if (!ok) break;
  }

  shareStatusMessage = ok
    ? '데모 데이터 5건을 추가했습니다. (Added 5 demo history entries)'
    : '데모 데이터 저장 중 오류가 발생했습니다. (Failed while seeding data)';
  render();
});

resetHistoryButton.addEventListener('click', () => {
  if (!clearShareHistory()) {
    shareStatusMessage = '데이터 초기화에 실패했습니다. (Reset failed)';
    render();
    return;
  }

  shareHistory = [];
  shareStatusMessage = '데이터를 초기화했습니다. (History reset complete)';
  render();
});

setDefaults('family-photo');
render();

function labelWrap(label: string, input: HTMLSelectElement): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const title = document.createElement('span');
  title.textContent = label;
  wrapper.append(title, input);
  return wrapper;
}

function card(title: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'panel';
  section.innerHTML = `<h2>${title}</h2>`;
  return section;
}

function titleNode(text: string): HTMLHeadingElement {
  const h = document.createElement('h3');
  h.textContent = text;
  return h;
}

