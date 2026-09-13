function buildPrompt(guideline: string, document: string, hasPdfText: boolean, fileName?: string, extension?: string, pageCount?: number | null): string {
  const docLabel = hasPdfText ? 'PDF에서 추출한 결과물 텍스트' : '결과물 본문';
  const docSection = hasPdfText
    ? `\n\n--- PDF에서 추출한 결과물 텍스트 ---\n${document}\n--- 끝 ---`
    : `\n\n--- ${docLabel} ---\n${document}\n--- 끝 ---`;

  const fileInfo = fileName
    ? `\n\n파일 정보: 파일명="${fileName}", 확장자="${extension}", 페이지 수=${pageCount !== null ? String(pageCount) : '알 수 없음'}`
    : '';

  return `당신은 "제출 요건 준수 검사"를 수행하는 도우미예요.
아래 제출 요강과 제출물(결과물)을 보고, 제출 직전 최종 점검을 해요.

## 역할
- 요강에서 지켜야 할 요건을 빠짐없이 뽑아 번호를 매긴다.
- 각 요건을 [A] 자동 확인 가능 / [B] 직접 확인 필요로 분류한다.
- [A] 항목은 결과물 텍스트에서 인용한 뒤, "확인됨"/"일부만 확인됨"/"확인되지 않음" 중 하나로 판정한다.
- [B] 항목은 판정하지 않고, 직접 확인 질문으로 제시한다.
- 요강에 없는 요건은 만들지 않는다.
- [B] 항목은 추측으로 판정하지 않는다.

## 입력
제출 요강:
===
${guideline}
===

${docSection}${fileInfo}

## 출력 형식
결과는 반드시 아래 JSON 형식만 출력하세요. 다른 문장은 붙이지 마세요.

{
  "requirements": [
    {
      "id": 1,
      "text": "요건 요약",
      "source": "요강 원문 인용",
      "type": "A",
      "strength": "필수"
    }
  ],
  "aChecks": [
    {
      "id": 1,
      "requirement": "요건 요약",
      "quote": "결과물에서 찾은 부분 인용",
      "result": "확인됨"
    }
  ],
  "bChecks": [
    {
      "id": 1,
      "requirement": "요건 요약",
      "question": "직접 확인 질문"
    }
  ],
  "finalMessage": "최종 안내 문장",
  "warning": "요강 확인 필요 경고가 있으면 작성, 없으면 생략"
}

## 판정 규칙
- "확인됨"/"일부만 확인됨"/"확인되지 않음"은 결과물 텍스트에서 확인한 정도에 따라 쓴다.
- 인용할 수 없으면 "확인됨"으로 판정하지 않는다.
- "quote"는 실제 결과물에서 찾은 부분을 그대로 적는다. 찾지 못했으면 빈 문자열로 둔다.
- [B] 항목은 판정하지 말고 "question"으로만 제시한다.
- finalMessage에는 다음을 반영한다:
  - [미충족] 또는 [일부만 확인됨]이 있거나 미확인 [B] 항목이 남아 있으면 "아직 제출하지 마세요"를 포함한 안내를 작성한다.
  - 모두 해결되었으면 "제출 준비가 되었어요"를 포함한 안내를 작성한다.
  - [필수] 요건이 충족되지 않았으면 "이대로 제출하면 형식 요건 위반이에요"를 명확히 포함한다.
  - [권장]만 미충족이면 제출은 가능하되 보완을 권한다는 점을 포함한 안내를 작성한다.
- 경고가 필요한 경우(외부 문서 참조, 요강이 지나치게 짧거나 일부만 붙여넣은 것으로 보이는 경우 등)에는 "warning"을 작성한다.

## 문체 규칙
- 결과 화면에서는 "~해요" 체의 부드러운 대화체로 보여준다.
- 영어 단어를 섞지 않는다.
- 사용자 화면에 보이는 용어는 내부 분류([A]/[B])를 그대로 노출하지 않고, "자동 확인 완료"/"직접 확인 필요"로 표시한다.
- 판정값도 "내용 확인됨"/"일부만 확인됨"/"확인되지 않음" 형태로 표시한다.

## 낮은 신뢰도 대응
- 요강이 지나치게 짧거나 일부만 붙여넣은 것으로 보이면, "warning"에 "요강이 불완전해 보여요. 더 많은 요건이 있을 수 있어요." 비슷한 안내를 넣는다.
- "별첨", "붙임 참조", "자세한 내용은 ~에서 확인" 같은 외부 문서 참조 표현이 있으면, "warning"에 요강 확인 필요 안내를 넣는다.

이제 위 규칙을 따라 결과를 JSON으로만 출력하세요.
`;
}

function parseResult(content: string): {
  requirements: Array<{ id: number; text: string; source: string; type: 'A' | 'B'; strength: '필수' | '권장' }>;
  aChecks: Array<{ id: number; requirement: string; quote: string; result: '확인됨' | '일부만 확인됨' | '확인되지 않음' }>;
  bChecks: Array<{ id: number; requirement: string; question: string }>;
  finalMessage: string;
  warning?: string;
} {
  const trimmed = content.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('LLM 응답이 JSON 형식이 아니에요.');
  }

  try {
    const data = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
    return {
      requirements: (data.requirements ?? []) as Array<{ id: number; text: string; source: string; type: 'A' | 'B'; strength: '필수' | '권장' }>,
      aChecks: (data.aChecks ?? []) as Array<{ id: number; requirement: string; quote: string; result: '확인됨' | '일부만 확인됨' | '확인되지 않음' }>,
      bChecks: (data.bChecks ?? []) as Array<{ id: number; requirement: string; question: string }>,
      finalMessage: String(data.finalMessage ?? ''),
      warning: data.warning ? String(data.warning) : undefined,
    };
  } catch (e) {
    throw new Error('LLM 응답을 파싱하지 못했어요.');
  }
}

function mockResult(): {
  requirements: Array<{ id: number; text: string; source: string; type: 'A' | 'B'; strength: '필수' | '권장' }>;
  aChecks: Array<{ id: number; requirement: string; quote: string; result: '확인됨' | '일부만 확인됨' | '확인되지 않음' }>;
  bChecks: Array<{ id: number; requirement: string; question: string }>;
  finalMessage: string;
  warning?: string;
} {
  return {
    requirements: [
      { id: 1, text: '결과물에 필수 항목이 포함되어야 함', source: '"반드시 포함되어야 한다"', type: 'A', strength: '필수' },
      { id: 2, text: '파일명 규칙 준수', source: '"파일명은 학번_이름 형식으로 제출"', type: 'B', strength: '필수' },
      { id: 3, text: '추천서 첨부', source: '"추천서를 첨부할 것을 권장한다"', type: 'B', strength: '권장' },
    ],
    aChecks: [
      {
        id: 1,
        requirement: '결과물에 필수 항목이 포함되어야 함',
        quote: '결과물 본문에 필수 항목 내용이 포함되어 있음',
        result: '확인됨',
      },
    ],
    bChecks: [
      {
        id: 2,
        requirement: '파일명 규칙 준수',
        question: '파일명이 학번_이름 형식인지 확인해 주세요.',
      },
      {
        id: 3,
        requirement: '추천서 첨부',
        question: '추천서 파일을 실제로 첨부했는지 확인해 주세요.',
      },
    ],
    finalMessage: '내용 확인 가능한 요건은 확인되었어요. 다만 파일명 규칙과 추천서 첨부는 직접 확인이 필요해요. 아직 제출하지 마시고 [B] 항목을 먼저 확인해 주세요.',
    warning: '요강에 "별첨", "붙임 참조" 같은 외부 문서 참조가 보여요. 더 많은 요건이 있을 수 있으니 원본 요강을 한 번 더 확인해 주세요.',
  };
}
