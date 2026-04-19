# RDF Sharesheet Demo

TypeScript + fp-ts + RDF-style context graph로 sharesheet 추천을 설명하는 데모입니다.

## What this demo shows

- PDE(장기 컨텍스트) + CE(실시간 컨텍스트) + share intent를 합쳐 working context graph를 생성
- RDF triple 형태로 context를 시각화
- sharesheet 후보(contact/app)를 rule + scoring 기반으로 추천
- 추천 근거를 explanation packet으로 함께 표시
- 실제 share 수행 결과를 localStorage 기반 RDF ShareEvent로 누적하며, 오래된 이력은 summary node로 압축해 graph 크기를 제한

## Local run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Docs

- RDF 초기값과 그래프 생성 흐름: `docs/rdf-initial-values.md`

## GitHub Pages

이 프로젝트는 정적 사이트입니다. GitHub Pages에서 호스팅할 수 있습니다.

### 방법

1. 이 폴더를 GitHub repository로 push
2. Repository Settings → Pages
3. Source를 GitHub Actions로 설정
4. `.github/workflows/deploy.yml`을 사용

### 주의

GitHub Pages의 repo 이름이 `rdf-demo`가 아니면 `vite.config.ts`의 base path를 맞춰 주세요.

예:

```ts
const base = process.env.BASE_PATH ?? '/rdf-demo/';
```
