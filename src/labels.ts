export type ContextFieldKey = 'contentType' | 'sourceApp' | 'timeBand' | 'place';

type BilingualEntry = { en: string; ko: string };

const fieldLabels: Record<ContextFieldKey, BilingualEntry> = {
  contentType: { en: 'Content Type', ko: '콘텐츠 유형' },
  sourceApp: { en: 'Source App', ko: '출발 앱' },
  timeBand: { en: 'Time Band', ko: '시간대' },
  place: { en: 'Place', ko: '장소' },
};

const valueLabels: Record<ContextFieldKey, Record<string, BilingualEntry>> = {
  contentType: {
    image: { en: 'image', ko: '이미지' },
    document: { en: 'document', ko: '문서' },
    link: { en: 'link', ko: '링크' },
  },
  sourceApp: {
    gallery: { en: 'gallery', ko: '갤러리' },
    mail: { en: 'mail', ko: '메일' },
    browser: { en: 'browser', ko: '브라우저' },
    chat: { en: 'chat', ko: '채팅' },
  },
  timeBand: {
    morning: { en: 'morning', ko: '아침' },
    afternoon: { en: 'afternoon', ko: '오후' },
    evening: { en: 'evening', ko: '저녁' },
  },
  place: {
    home: { en: 'home', ko: '집' },
    office: { en: 'office', ko: '사무실' },
    moving: { en: 'moving', ko: '이동 중' },
  },
};

const rdfTermLabels: Record<string, string> = {
  'Working Context': '작업 컨텍스트',
  'PDE / Long-term': 'PDE / 장기 컨텍스트',
  'CE / Runtime': 'CE / 실시간 컨텍스트',
  'Decision / Outcome': '의사결정 / 결과',
  'Decision & Outcome': '의사결정 / 결과',
  'Literal Evidence': '리터럴 증거',
  Other: '기타',
};

const bilingual = (ko: string, en: string): string => `${ko} (${en})`;

export const describeRdfTerm = (english: string): string => {
  const korean = rdfTermLabels[english];
  return korean ? bilingual(korean, english) : english;
};

export const optionLabel = (field: ContextFieldKey, value: string): string => {
  const entry = valueLabels[field][value];
  return entry ? bilingual(entry.ko, entry.en) : value;
};

export const formatContextLine = (field: ContextFieldKey, value: string): string => {
  const fieldLabel = fieldLabels[field];
  const translatedValue = valueLabels[field][value];
  const renderedValue = translatedValue ? bilingual(translatedValue.ko, translatedValue.en) : value;
  return `${bilingual(fieldLabel.ko, fieldLabel.en)}: ${renderedValue}`;
};

export const buildLabelCatalog = () => ({
  heroEyebrow: 'RDF + fp-ts + TypeScript · RDF 그래프 기반 추천 데모',
  heroTitle: '공유 추천 데모 (Sharesheet Recommendation Demo)',
  heroSubtitle:
    'PDE(장기 컨텍스트)와 CE(실시간 컨텍스트)를 RDF 작업 그래프(working graph)로 묶어 추천 순위를 계산합니다.',
  githubPagesBadge: 'GitHub Pages 배포 가능 (GitHub Pages ready)',
  controlsTitle: '컨텍스트 입력 (Context Input)',
  shareControlsTitle: '공유 실행 (Share Action)',
  shareTargetLabel: '공유 대상 (Share Target)',
  shareButton: '공유 수행 후 RDF에 기록 (Share + append RDF)',
  shareHistoryTitle: '공유 이력 (Share History)',
  shareHistoryEmpty: '아직 수행된 share event가 없습니다. (No share events yet)',
  graphTitle: '컨텍스트 그래프 (Context Graph)',
  graphInspectorTitle: '그래프 인스펙터 (Graph Inspector)',
  rankingTitle: '상위 추천 (Top Recommendations)',
  explanationTitle: '이 순위가 나온 이유 (Why this ranking?)',
  designNotesTitle: '설계 메모 (Design Notes)',
  rdfTriplesSummary: 'RDF 트리플 보기 (View RDF triples)',
  runButton: '추천 실행 (Recommendation Run)',
  graphSize: '그래프 크기 (graph size)',
});
