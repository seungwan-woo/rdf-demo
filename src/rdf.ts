import { pipe } from 'fp-ts/function';
import * as A from 'fp-ts/ReadonlyArray';
import { DataFactory } from 'rdf-data-factory';
import type * as RDF from '@rdfjs/types';

const factory = new DataFactory();

export type Term = RDF.Term;
export type Triple = RDF.Quad;
export type Graph = ReadonlyArray<Triple>;

export const iri = (value: string): RDF.NamedNode => factory.namedNode(value);
export const literal = (value: string): RDF.Literal => factory.literal(value);
export const blank = (value: string): RDF.BlankNode => factory.blankNode(value);

export const triple = (subject: RDF.Quad_Subject, predicate: RDF.Quad_Predicate, object: RDF.Quad_Object): Triple =>
  factory.quad(subject, predicate, object);

const renderTerm = (term: RDF.Term): string => {
  switch (term.termType) {
    case 'Literal':
      return `"${term.value}"`;
    case 'BlankNode':
      return `_:${term.value}`;
    case 'NamedNode':
    default:
      return term.value;
  }
};

export const renderTriple = (t: Triple): string =>
  `${renderTerm(t.subject)} ${renderTerm(t.predicate)} ${renderTerm(t.object)} .`;

export const renderGraph = (graph: Graph): ReadonlyArray<string> =>
  pipe(graph, A.map(renderTriple));
