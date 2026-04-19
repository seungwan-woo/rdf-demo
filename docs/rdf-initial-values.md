# RDF 초기값과 그래프 생성 흐름

이 문서는 이 데모에서 RDF 그래프의 초기값이 어디서 정해지고, 실제 working graph가 어떻게 만들어지는지 빠르게 이해하기 위한 메모입니다.

## 한눈에 요약

RDF의 초기값은 크게 4군데에서 들어옵니다.

1. `src/domain.ts`의 `scenarioDefaults`
   - UI에서 시나리오를 고르면 기본 입력값(`contentType`, `sourceApp`, `timeBand`, `place`)을 세팅합니다.
2. `src/domain.ts`의 `pdeFacts`
   - 시나리오별 장기 컨텍스트(PDE)용 RDF triple seed를 제공합니다.
3. `src/domain.ts`의 `buildContextGraph`
   - 공통 base triple과 시나리오별 `pdeFacts`를 합쳐 최종 RDF graph를 만듭니다.
4. `src/share-history.ts`의 `appendShareHistoryToGraph`
   - 사용자가 demo에서 실제로 수행한 share 결과를 `ctx:ShareEvent` RDF triple로 누적해 최종 graph에 덧붙입니다.
   - 다만 무한히 append하면 graph가 너무 커지므로, 최근 이벤트는 raw triple로 유지하고 오래된 이벤트는 summary node로 압축합니다.

## 코드 기준 위치

- 기본 시나리오 입력값: `src/domain.ts:72`
- 시나리오별 PDE seed triple: `src/domain.ts:54`
- 공통 RDF base graph 생성: `src/domain.ts:84`
- UI 기본값 적용: `src/main.ts:122`
- 최초 시나리오 선택값: `src/main.ts:47`

## 실제 기본값

`scenarioDefaults`는 아래처럼 정의되어 있습니다.

- `family-photo`
  - `contentType: image`
  - `sourceApp: gallery`
  - `timeBand: evening`
  - `place: home`
- `work-doc`
  - `contentType: document`
  - `sourceApp: mail`
  - `timeBand: afternoon`
  - `place: office`
- `social-link`
  - `contentType: link`
  - `sourceApp: browser`
  - `timeBand: evening`
  - `place: home`

그리고 UI는 `src/main.ts`에서 처음에 `scenarioSelect.value = 'family-photo'`로 시작하고, 이어서 `setDefaults(scenario)`를 통해 위 기본값들을 각 select box에 반영합니다.

## Mermaid 다이어그램

```mermaid
flowchart TD
    A[앱 시작<br/>src/main.ts] --> B[초기 시나리오 선택<br/>family-photo]
    B --> C[setDefaults(scenario)]
    C --> D[scenarioDefaults 조회<br/>src/domain.ts]
    D --> E[기본 입력값 세팅<br/>contentType / sourceApp / timeBand / place]

    E --> F[render() 호출]
    F --> G[readInput()로 현재 UI 값 수집]
    G --> H[buildContextGraph(scenario, input)]

    H --> I[공통 base triple 생성<br/>ctx:share / pde:profile / ce:runtime / decision:1]
    H --> J[시나리오별 pdeFacts 조회<br/>family-photo / work-doc / social-link]

    I --> K[최종 Graph = base + pdeFacts]
    J --> K

    K --> L[renderGraph(graph)<br/>RDF triple 텍스트 렌더링]
    K --> M[renderGraphViz(graph)<br/>시각화용 노드/엣지 생성]
    K --> N[rankCandidates / buildDecisionEvidence<br/>추천 점수 계산]
```

## 공통 base graph에서 고정으로 들어가는 RDF

`buildContextGraph()`는 사용자가 고른 입력값과 무관하게 아래 구조를 먼저 만듭니다.

- `ctx:share rdf:type ctx:ShareIntent`
- `ctx:share ctx:contentType "..."`
- `ctx:share ctx:sourceApp "..."`
- `ctx:share ctx:timeBand "..."`
- `ctx:share ctx:place "..."`
- `ctx:share ctx:scenario "..."`
- `ctx:share ctx:hasLongTermContext pde:profile`
- `ctx:share ctx:hasRuntimeContext ce:runtime`
- `pde:profile rdf:type pde:LongTermContext`
- `ce:runtime rdf:type ce:RuntimeContext`
- `decision:1 rdf:type ctx:Decision`
- `decision:1 ctx:forIntent ctx:share`
- `decision:1 ctx:produces ctx:ranking`
- `_:outcome-1 ctx:refersTo decision:1`

즉, 초기 RDF의 뼈대는 항상 동일하고, 실제 차이는
- 사용자가 고른 runtime literal 값
- 시나리오별 `pdeFacts`
두 부분에서 생깁니다.

## 시나리오별 PDE seed

### family-photo

- `pde:mom rdf:type pde:FamilyMember`
- `pde:best-friend pde:affinity "high"`
- `pde:family-cluster pde:contains pde:mom`

### work-doc

- `pde:team-lead rdf:type pde:WorkContact`
- `pde:coworker pde:affinity "high"`
- `pde:workspace pde:contains pde:team-lead`

### social-link

- `pde:best-friend rdf:type pde:CloseFriend`
- `pde:kakaotalk pde:channel "chat"`
- `pde:social-circle pde:contains pde:best-friend`

## 데이터 흐름 관점에서 보면

- UI 기본값의 출발점은 `scenarioDefaults`
- RDF 구조의 공통 뼈대는 `buildContextGraph()` 내부 `base`
- 시나리오별 장기 기억은 `pdeFacts`
- 최종 그래프는 `return [...base, ...pdeFacts[scenario]]`

즉, “RDF의 초기값”을 묻는다면 가장 정확하게는:

1. 입력 기본값은 `scenarioDefaults`
2. 그래프 기본 골격은 `buildContextGraph()`의 `base`
3. 시나리오별 seed fact는 `pdeFacts`
4. 사용자가 누적한 share 결과는 `appendShareHistoryToGraph()`에서 recent/raw + summary로 압축되어 합쳐짐

이 4개가 합쳐져 현재 데모의 RDF 초기 상태와 누적 상태를 만든다고 보면 됩니다.

## Share 결과 압축 전략

share 결과는 localStorage에 append-only로 남기되, 그래프에 넣을 때만 압축합니다.

### 규칙

- 최근 5개 이벤트는 raw `ctx:ShareEvent` 노드로 유지
- 그보다 오래된 이벤트는 `scenario + selectedTargetId` 기준으로 묶어서 `ctx:ShareEventSummary` 노드로 변환
- summary 노드에는 다음 정보를 저장
  - `ctx:shareCount`
  - `ctx:firstSharedAt`
  - `ctx:lastSharedAt`
  - 대표 입력값(`contentType`, `sourceApp`, `timeBand`, `place`)
  - `ctx:compressionStrategy`

### 왜 이 방식인가

1. 그래프 크기를 bounded하게 유지할 수 있음
2. 최근 행동은 raw event로 보존되어 디버깅/설명이 쉬움
3. 오래된 패턴은 summary로 남겨서 추천 근거와 추세만 유지할 수 있음

즉, 저장소는 append-only, 시각화용 working graph는 compressed view로 분리하는 방식입니다.
