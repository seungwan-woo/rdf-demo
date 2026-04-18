import { pipe } from 'fp-ts/function';
import * as A from 'fp-ts/ReadonlyArray';

export type Term =
  | { readonly kind: 'iri'; readonly value: string }
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'blank'; readonly value: string };

export type Triple = Readonly<{
  subject: Term;
  predicate: Term;
  object: Term;
}>;

export type Graph = ReadonlyArray<Triple>;

export const iri = (value: string): Term => ({ kind: 'iri', value });
export const literal = (value: string): Term => ({ kind: 'literal', value });
export const blank = (value: string): Term => ({ kind: 'blank', value });

export const triple = (subject: Term, predicate: Term, object: Term): Triple => ({
  subject,
  predicate,
  object,
});

const renderTerm = (term: Term): string =>
  term.kind === 'literal' ? `"${term.value}"` : term.value;

export const renderTriple = (t: Triple): string =>
  `${renderTerm(t.subject)} ${renderTerm(t.predicate)} ${renderTerm(t.object)} .`;

export const renderGraph = (graph: Graph): ReadonlyArray<string> =>
  pipe(graph, A.map(renderTriple));
