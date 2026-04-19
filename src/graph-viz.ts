import { describeRdfTerm } from './labels';
import type { Graph, Term } from './rdf';

export type GraphVizNodeKind = 'ctx' | 'pde' | 'ce' | 'decision' | 'literal' | 'other';

export type GraphVizNode = Readonly<{
  key: string;
  label: string;
  kind: GraphVizNodeKind;
  x: number;
  y: number;
}>;

export type GraphVizEdge = Readonly<{
  key: string;
  sourceKey: string;
  targetKey: string;
  predicate: string;
  sourceLabel: string;
  targetLabel: string;
  path: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
}>;

export type GraphViz = Readonly<{
  svg: string;
  summary: string;
  nodes: ReadonlyArray<GraphVizNode>;
  edges: ReadonlyArray<GraphVizEdge>;
}>;

const width = 1220;
const height = 700;
const nodeW = 138;
const nodeH = 48;
const radius = 16;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const labelOf = (term: Term): string => {
  if (term.termType === 'Literal') return term.value;
  if (term.termType === 'BlankNode') return `_:${term.value}`;
  const colon = term.value.indexOf(':');
  return colon >= 0 ? term.value.slice(colon + 1) : term.value;
};

const kindOf = (term: Term): GraphVizNodeKind => {
  if (term.termType === 'Literal') return 'literal';
  if (term.termType === 'BlankNode') return 'decision';
  if (term.value.startsWith('ctx:')) return 'ctx';
  if (term.value.startsWith('pde:')) return 'pde';
  if (term.value.startsWith('ce:')) return 'ce';
  if (term.value.startsWith('decision:')) return 'decision';
  return 'other';
};

const keyOf = (term: Term): string => `${term.termType}:${term.value}`;

const hashInt = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
};

const hashFloat = (value: string): number => (hashInt(value) % 10000) / 10000;

const anchorFor = (kind: GraphVizNodeKind): { x: number; y: number } => {
  switch (kind) {
    case 'ctx':
      return { x: width * 0.5, y: 130 };
    case 'pde':
      return { x: width * 0.22, y: 300 };
    case 'ce':
      return { x: width * 0.78, y: 300 };
    case 'decision':
      return { x: width * 0.5, y: 540 };
    case 'literal':
      return { x: width * 0.72, y: 250 };
    case 'other':
    default:
      return { x: width * 0.5, y: 620 };
  }
};

const groupLabelFor = (kind: GraphVizNodeKind): string => {
  switch (kind) {
    case 'ctx':
      return describeRdfTerm('Working Context');
    case 'pde':
      return describeRdfTerm('PDE / Long-term');
    case 'ce':
      return describeRdfTerm('CE / Runtime');
    case 'decision':
      return describeRdfTerm('Decision & Outcome');
    case 'literal':
      return describeRdfTerm('Literal Evidence');
    case 'other':
    default:
      return describeRdfTerm('Other');
  }
};

const colorFor = (kind: GraphVizNodeKind): { fill: string; stroke: string; glow: string } => {
  switch (kind) {
    case 'ctx':
      return { fill: 'url(#grad-ctx)', stroke: '#67e8f9', glow: 'rgba(45, 212, 191, 0.28)' };
    case 'pde':
      return { fill: 'url(#grad-pde)', stroke: '#a5b4fc', glow: 'rgba(129, 140, 248, 0.28)' };
    case 'ce':
      return { fill: 'url(#grad-ce)', stroke: '#fbbf24', glow: 'rgba(251, 191, 36, 0.26)' };
    case 'decision':
      return { fill: 'url(#grad-decision)', stroke: '#d8b4fe', glow: 'rgba(192, 132, 252, 0.30)' };
    case 'literal':
      return { fill: 'url(#grad-literal)', stroke: '#94a3b8', glow: 'rgba(148, 163, 184, 0.18)' };
    case 'other':
    default:
      return { fill: 'url(#grad-other)', stroke: '#64748b', glow: 'rgba(100, 116, 139, 0.18)' };
  }
};

const nodeSummary = (kind: GraphVizNodeKind): string => {
  switch (kind) {
    case 'ctx':
      return '공유 의도와 실시간 신호를 결합한 중심 노드 (share intent and runtime fusion)';
    case 'pde':
      return '장기 관계와 친밀도 증거를 담는 노드 (long-term relationship / affinity evidence)';
    case 'ce':
      return '시간, 장소, 디바이스 상태를 담는 노드 (time / place / device runtime signals)';
    case 'decision':
      return '순위, 결과, 피드백 루프를 표현하는 노드 (ranking, outcome, feedback loop)';
    case 'literal':
      return '문자열 값 같은 리터럴 증거 (typed literal evidence)';
    case 'other':
    default:
      return '보조 노드 (auxiliary node)';
  }
};

type LayoutNode = GraphVizNode & Readonly<{ anchorX: number; anchorY: number; vx: number; vy: number }>;

const positionsForGroup = (
  items: ReadonlyArray<{ key: string; label: string; kind: GraphVizNodeKind }>,
  kind: GraphVizNodeKind,
): ReadonlyArray<LayoutNode> => {
  const anchor = anchorFor(kind);
  const total = items.length;
  const spread = Math.max(80, Math.min(220, total * 34));
  const start = total <= 1 ? 0 : -spread / 2;
  return items.map((item, idx) => {
    const offset = total <= 1 ? 0 : start + (spread / Math.max(total - 1, 1)) * idx;
    const sway = (hashFloat(item.key) - 0.5) * 70;
    return {
      ...item,
      x: anchor.x + sway,
      y: anchor.y + offset,
      anchorX: anchor.x,
      anchorY: anchor.y,
      vx: 0,
      vy: 0,
    };
  });
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeLayout = (nodes: ReadonlyArray<LayoutNode>): ReadonlyArray<GraphVizNode> => {
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = 62;
  const padY = 72;
  const availableW = width - padX * 2;
  const availableH = height - padY * 2;
  const scaleX = maxX - minX < 1 ? 1 : availableW / (maxX - minX);
  const scaleY = maxY - minY < 1 ? 1 : availableH / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - ((maxX - minX) * scale)) / 2 - minX * scale;
  const offsetY = (height - ((maxY - minY) * scale)) / 2 - minY * scale;

  return nodes.map((node) => ({
    key: node.key,
    label: node.label,
    kind: node.kind,
    x: clamp(node.x * scale + offsetX, padX, width - padX),
    y: clamp(node.y * scale + offsetY, padY, height - padY),
  }));
};

const makeCurvedPath = (source: GraphVizNode, target: GraphVizNode): { path: string; labelX: number; labelY: number } => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.max(Math.hypot(dx, dy), 1);
  const ux = dx / len;
  const uy = dy / len;
  const startX = source.x + ux * (nodeW / 2);
  const startY = source.y + uy * (nodeH / 2);
  const endX = target.x - ux * (nodeW / 2);
  const endY = target.y - uy * (nodeH / 2);
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const perpX = -uy;
  const perpY = ux;
  const curvature = clamp(120 * (0.3 + hashFloat(`${source.key}->${target.key}`)), 36, 126);
  const bend = ((source.kind === 'ctx' || target.kind === 'ctx') ? 0.8 : 0.55) * curvature;
  const controlX = midX + perpX * bend;
  const controlY = midY + perpY * bend;
  return {
    path: `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`,
    labelX: controlX,
    labelY: controlY,
  };
};

export const renderGraphViz = (graph: Graph): GraphViz => {
  const edgesRaw = graph.map((triple) => ({
    sourceKey: keyOf(triple.subject),
    targetKey: keyOf(triple.object),
    predicate: labelOf(triple.predicate),
    sourceLabel: labelOf(triple.subject),
    targetLabel: labelOf(triple.object),
  }));

  const nodeMap = new Map<string, { key: string; label: string; kind: GraphVizNodeKind }>();
  for (const triple of graph) {
    const subjectKey = keyOf(triple.subject);
    const objectKey = keyOf(triple.object);
    if (!nodeMap.has(subjectKey)) {
      nodeMap.set(subjectKey, { key: subjectKey, label: labelOf(triple.subject), kind: kindOf(triple.subject) });
    }
    if (!nodeMap.has(objectKey)) {
      nodeMap.set(objectKey, { key: objectKey, label: labelOf(triple.object), kind: kindOf(triple.object) });
    }
  }

  const grouped = {
    ctx: [] as ReadonlyArray<{ key: string; label: string; kind: GraphVizNodeKind }>,
    pde: [] as ReadonlyArray<{ key: string; label: string; kind: GraphVizNodeKind }>,
    ce: [] as ReadonlyArray<{ key: string; label: string; kind: GraphVizNodeKind }>,
    decision: [] as ReadonlyArray<{ key: string; label: string; kind: GraphVizNodeKind }>,
    literal: [] as ReadonlyArray<{ key: string; label: string; kind: GraphVizNodeKind }>,
    other: [] as ReadonlyArray<{ key: string; label: string; kind: GraphVizNodeKind }>,
  };

  const allNodes = Array.from(nodeMap.values());
  for (const node of allNodes) {
    grouped[node.kind] = [...grouped[node.kind], node];
  }

  let layout: LayoutNode[] = [
    ...positionsForGroup(grouped.ctx, 'ctx'),
    ...positionsForGroup(grouped.pde, 'pde'),
    ...positionsForGroup(grouped.ce, 'ce'),
    ...positionsForGroup(grouped.decision, 'decision'),
    ...positionsForGroup(grouped.literal, 'literal'),
    ...positionsForGroup(grouped.other, 'other'),
  ];

  const edgePairs = edgesRaw.map((edge, idx) => ({ ...edge, key: `edge-${idx}` }));
  const nodeIndex = new Map(layout.map((node) => [node.key, node] as const));

  const desiredDistance = (source: LayoutNode, target: LayoutNode): number => {
    if (source.kind === 'ctx' || target.kind === 'ctx') return 175;
    if (source.kind === 'decision' || target.kind === 'decision') return 165;
    if (source.kind === target.kind) return 140;
    if (source.kind === 'literal' || target.kind === 'literal') return 120;
    return 150;
  };

  for (let iter = 0; iter < 72; iter += 1) {
    const next = layout.map((node) => ({ ...node }));

    for (let i = 0; i < next.length; i += 1) {
      const node = next[i]!;
      const ax = (node.anchorX - node.x) * 0.022;
      const ay = (node.anchorY - node.y) * 0.022;
      node.vx += ax;
      node.vy += ay;
    }

    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i]!;
        const b = next[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const minDist = a.kind === b.kind ? 132 : 96;
        const force = (minDist * minDist) / (dist * dist);
        const repel = 0.55 * force;
        const fx = (dx / dist) * repel;
        const fy = (dy / dist) * repel;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    for (const edge of edgePairs) {
      const source = next.find((node) => node.key === edge.sourceKey);
      const target = next.find((node) => node.key === edge.targetKey);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const desired = desiredDistance(source, target);
      const spring = (dist - desired) * 0.0075;
      const fx = (dx / dist) * spring;
      const fy = (dy / dist) * spring;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    for (const node of next) {
      const left = 72;
      const right = width - 72;
      const top = 86;
      const bottom = height - 82;
      if (node.x < left) node.vx += (left - node.x) * 0.018;
      if (node.x > right) node.vx -= (node.x - right) * 0.018;
      if (node.y < top) node.vy += (top - node.y) * 0.018;
      if (node.y > bottom) node.vy -= (node.y - bottom) * 0.018;
      node.vx *= 0.82;
      node.vy *= 0.82;
      node.vx = clamp(node.vx, -8, 8);
      node.vy = clamp(node.vy, -8, 8);
      node.x += node.vx;
      node.y += node.vy;
    }

    layout = next;
  }

  const normalized = normalizeLayout(layout) as LayoutNode[];
  layout = normalized;
  nodeIndex.clear();
  for (const node of layout) nodeIndex.set(node.key, node as LayoutNode);

  const nodeMarkup = layout
    .map((node) => {
      const palette = colorFor(node.kind);
      const title = `${node.label} · ${groupLabelFor(node.kind)} · ${nodeSummary(node.kind)}`;
      const x = node.x - nodeW / 2;
      const y = node.y - nodeH / 2;
      return `
        <g class="kg-node kg-node--${node.kind}" data-node-key="${escapeXml(node.key)}" data-node-kind="${node.kind}" tabindex="0" role="button" aria-label="${escapeXml(title)}">
          <title>${escapeXml(title)}</title>
          <rect class="kg-node-glow" x="${(x - 6).toFixed(1)}" y="${(y - 6).toFixed(1)}" rx="${radius + 6}" ry="${radius + 6}" width="${(nodeW + 12).toFixed(1)}" height="${(nodeH + 12).toFixed(1)}" fill="${palette.glow}" />
          <rect class="kg-node-body" x="${x.toFixed(1)}" y="${y.toFixed(1)}" rx="${radius}" ry="${radius}" width="${nodeW}" height="${nodeH}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2.4" />
          <rect class="kg-node-hit" x="${(x - 10).toFixed(1)}" y="${(y - 10).toFixed(1)}" rx="${radius + 10}" ry="${radius + 10}" width="${(nodeW + 20).toFixed(1)}" height="${(nodeH + 20).toFixed(1)}" fill="transparent" />
          <text class="kg-node-label" x="${node.x.toFixed(1)}" y="${(node.y - 2).toFixed(1)}" text-anchor="middle">${escapeXml(node.label)}</text>
          <text class="kg-node-kind" x="${node.x.toFixed(1)}" y="${(node.y + 15).toFixed(1)}" text-anchor="middle">${escapeXml(groupLabelFor(node.kind))}</text>
        </g>
      `;
    })
    .join('');

  const edgeMarkup = edgePairs
    .map((edge) => {
      const source = nodeIndex.get(edge.sourceKey);
      const target = nodeIndex.get(edge.targetKey);
      if (!source || !target) return '';
      const path = makeCurvedPath(source, target);
      const title = `${edge.sourceLabel} —${edge.predicate}→ ${edge.targetLabel}`;
      const labelWidth = Math.max(84, Math.min(150, edge.predicate.length * 8 + 24));
      return `
        <g class="kg-edge kg-edge--${source.kind}-${target.kind}" data-edge-key="${edge.key}" data-source-key="${escapeXml(edge.sourceKey)}" data-target-key="${escapeXml(edge.targetKey)}" data-predicate="${escapeXml(edge.predicate)}" tabindex="0" role="button" aria-label="${escapeXml(title)}">
          <title>${escapeXml(title)}</title>
          <path class="kg-edge-path" d="${path.path}" />
          <rect class="kg-edge-pill" x="${(path.labelX - labelWidth / 2).toFixed(1)}" y="${(path.labelY - 12).toFixed(1)}" width="${labelWidth.toFixed(1)}" height="24" rx="12" ry="12" />
          <text class="kg-edge-label" x="${path.labelX.toFixed(1)}" y="${(path.labelY + 1).toFixed(1)}" text-anchor="middle">${escapeXml(edge.predicate)}</text>
        </g>
      `;
    })
    .join('');

  const backgroundLabels = `
    <g class="kg-lane-labels">
      <text x="88" y="96">PDE / 장기 기억 (long-term memory)</text>
      <text x="912" y="96" text-anchor="end">CE / 실시간 신호 (runtime signals)</text>
      <text x="600" y="652" text-anchor="middle">의사결정 / 결과 루프 (decision / outcome loop)</text>
    </g>
  `;

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Context graph visualization" class="graph-svg">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(148,163,184,0.08)" stroke-width="1" />
        </pattern>
        <linearGradient id="grad-ctx" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#0f766e" />
          <stop offset="100%" stop-color="#115e59" />
        </linearGradient>
        <linearGradient id="grad-pde" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#4338ca" />
          <stop offset="100%" stop-color="#312e81" />
        </linearGradient>
        <linearGradient id="grad-ce" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#b45309" />
          <stop offset="100%" stop-color="#92400e" />
        </linearGradient>
        <linearGradient id="grad-decision" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#7c3aed" />
          <stop offset="100%" stop-color="#5b21b6" />
        </linearGradient>
        <linearGradient id="grad-literal" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="grad-other" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#1f2937" />
          <stop offset="100%" stop-color="#111827" />
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.12 0 1 0 0 0.85 0 0 1 0 0.95 0 0 0 0.24 0" />
        </filter>
        <marker id="arrowhead" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#cbd5e1"></path>
        </marker>
      </defs>
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="22" ry="22" fill="#020617" stroke="#1e293b" stroke-width="2" />
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="22" ry="22" fill="url(#grid)" opacity="0.55" />
      <text x="28" y="38" class="graph-title">컨텍스트 그래프 (Context Graph)</text>
      <text x="28" y="60" class="graph-subtitle">힘 기반 레이아웃 · 증거는 hover · 클릭하면 주변 노드 고정 (Force-directed layout · hover for evidence · click to pin neighborhood)</text>
      ${backgroundLabels}
      ${edgeMarkup}
      ${nodeMarkup}
    </svg>
  `;

  const summary = `노드 ${layout.length}개 / 엣지 ${edgePairs.length}개 (nodes / edges)`;
  return { svg, summary, nodes: layout, edges: edgePairs.map((edge, idx) => ({
    key: `edge-${idx}`,
    sourceKey: edge.sourceKey,
    targetKey: edge.targetKey,
    predicate: edge.predicate,
    sourceLabel: edge.sourceLabel,
    targetLabel: edge.targetLabel,
    path: makeCurvedPath(nodeIndex.get(edge.sourceKey)!, nodeIndex.get(edge.targetKey)!).path,
    labelX: makeCurvedPath(nodeIndex.get(edge.sourceKey)!, nodeIndex.get(edge.targetKey)!).labelX,
    labelY: makeCurvedPath(nodeIndex.get(edge.sourceKey)!, nodeIndex.get(edge.targetKey)!).labelY,
    labelWidth: Math.max(84, Math.min(150, edge.predicate.length * 8 + 24)),
  })) };
};
