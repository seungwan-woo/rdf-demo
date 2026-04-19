import { describe, expect, it } from 'vitest';
import { buildLabelCatalog, describeRdfTerm, formatContextLine } from './labels';
import { blank, iri, literal, triple } from './rdf';

describe('rdf-data-factory wrapper', () => {
  it('creates RDF/JS compatible terms and quads while preserving rendered triples', () => {
    const subject = iri('ctx:share');
    const predicate = iri('ctx:contentType');
    const object = literal('image');
    const result = triple(subject, predicate, object);

    expect(subject.termType).toBe('NamedNode');
    expect(predicate.termType).toBe('NamedNode');
    expect(object.termType).toBe('Literal');
    expect(blank('outcome-1').termType).toBe('BlankNode');
    expect(result.termType).toBe('Quad');
    expect(result.subject.value).toBe('ctx:share');
    expect(result.predicate.value).toBe('ctx:contentType');
    expect(result.object.value).toBe('image');
    expect(result.graph.termType).toBe('DefaultGraph');
    expect(result.subject.equals(iri('ctx:share'))).toBe(true);
    expect(result.predicate.equals(iri('ctx:contentType'))).toBe(true);
    expect(result.object.equals(literal('image'))).toBe(true);
  });
});

describe('korean label helpers', () => {
  it('provides bilingual labels for github pages controls and graph copy', () => {
    const labels = buildLabelCatalog();

    expect(labels.heroTitle).toContain('공유 추천 데모');
    expect(labels.heroTitle).toContain('Sharesheet Recommendation Demo');
    expect(labels.controlsTitle).toContain('컨텍스트 입력');
    expect(labels.graphInspectorTitle).toContain('그래프 인스펙터');
    expect(labels.designNotesTitle).toContain('설계 메모');
    expect(labels.rdfTriplesSummary).toContain('RDF 트리플 보기');
    expect(labels.runButton).toContain('추천 실행');
    expect(labels.runButton).toContain('Recommendation Run');
  });

  it('translates RDF terms and context values into korean-friendly descriptions', () => {
    expect(describeRdfTerm('PDE / Long-term')).toContain('장기 컨텍스트');
    expect(describeRdfTerm('Literal Evidence')).toContain('리터럴');
    expect(describeRdfTerm('Decision / Outcome')).toContain('의사결정');

    expect(formatContextLine('contentType', 'image')).toContain('콘텐츠 유형');
    expect(formatContextLine('contentType', 'image')).toContain('이미지');
    expect(formatContextLine('sourceApp', 'browser')).toContain('브라우저');
    expect(formatContextLine('timeBand', 'evening')).toContain('저녁');
    expect(formatContextLine('place', 'office')).toContain('사무실');
  });
});
