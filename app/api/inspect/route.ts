import { NextRequest, NextResponse } from 'next/server';
import { callSolarPro4 } from '@/lib/llm';
import { mockResult } from '@/lib/mock';

function buildPrompt(
  guideline: string,
  document: string,
): string {
  return `당신은 "제출 요건 준수 검사"를 수행하는 도우미예요.
아래 제출 요강과 제출물(결과물)을 보고, 제출 직전 최종 점검을 해요.

## 역할
- 요강에서 지켜야 할 요건을 빠짐없이 뽑아 번호를 매긴다.
- 각 요건을 [A] 자동 확인 가능 / [B] 직접 확인 필요로 분류한다.
- [A] 항목은 결과물 텍스트에서 인용한 뒤, "[충족]"/"[불충분]"/"[미충족]" 중 하나로 판정한다.
- [B] 항목은 판정하지 않고, 직접 확인 질문으로 제시한다.
- 요강에 없는 요건은 만들지 않는다.
- [B] 항목은 추측으로 판정하지 않는다.

## 1단계: 요건 추출 규칙
- 요강에 "별첨", "붙임 참조", "자세한 내용은 ~에서 확인" 같이
  외부 문서를 가리키는 표현이 있으면 **절대 요건으로 만들지 않는다.**
  이런 표현은 요건 번호를 매기지 않고, 요건 목록(requirements)에도 넣지 않는다.
  정말 필요한 경우 "요강 확인 필요" 경고(warning)로만 남긴다.
- 요건 목록에 넣는 항목은 요강 본문에서 지켜야 할 조건만이다.
  외부 문서 참조 문장은 조건이 아니라 안내이므로 요건으로 세지 않는다.
- 요강 원문이 지나치게 짧거나 일부만 붙여넣은 것으로 보이면
  같은 이유로 "요강 확인 필요"를 남긴다.
- 각 요건마다 요강 원문을 그대로 인용한다.

## 2단계: 확인 가능성 분류 기준
- [A]는 결과물 텍스트만 보고 **판정까지 끝낼 수 있을 때만** 쓴다.
  판정 근거가 파일 속성, 지정 양식 원본, 붙임 문서, 실제 첨부 여부 같은
  텍스트 외부 정보에 의존하면 [B]로 분류한다.
- 아래처럼 텍스트만으로는 알 수 없는 항목은 [B]로 본다.
  - 파일명 규칙
  - 파일 형식/확장자
  - 페이지 수, 분량
  - 폰트 종류·크기, 여백
  - 실제 첨부 여부(첨부파일을 보냈는지)
  - 제출 경로, 제출 방법, 마감 시각
- 하나의 요건이 [A]와 [B] 성격을 모두 가지면,
  둘로 나눠 각각 번호를 준다. 하나로 합치지 않는다.
- [B] 항목은 추측으로 판정하지 않는다.
  결과물에 관련 언급이 없다고 해서 "[미충족]"으로 단정하지 않는다.
  [B]는 항상 question으로만 제시한다.
- 별도 파일로 제출하는 첨부서류(추천서, 계획서, 증빙 등)는
  본문에 관련 내용이 있으면 [A]/[B]로 나누고,
  본문에 아무 언급이 없으면 [B] 하나로 둔다.

## 입력
제출 요강:
===
${guideline}
===

제출물(결과물):
===
${document}
===

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
      "result": "[충족]"
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
- "[충족]"/"[불충분]"/"[미충족]"은 결과물 텍스트에서 확인한 정도에 따라 쓴다.
- 인용할 수 없으면 "[충족]"으로 판정하지 않는다.
- "quote"는 실제 결과물에서 찾은 부분을 그대로 적는다. 찾지 못했으면 빈 문자열로 둔다.
- [B] 항목은 판정하지 말고 "question"으로만 제시한다.
- finalMessage에는 다음을 반영한다:
  - [미충족] 또는 [불충분]이 있거나 미확인 [B] 항목이 남아 있으면 "아직 제출하지 마세요"를 포함한 안내를 작성한다.
  - 모두 해결되었으면 "제출 준비가 되었어요"를 포함한 안내를 작성한다.
  - [필수] 요건이 충족되지 않았으면 "이대로 제출하면 형식 요건 위반이에요"를 명확히 포함한다.
  - [권장]만 미충족이면 제출은 가능하되 보완을 권한다는 점을 포함한 안내를 작성한다.
- 경고가 필요한 경우(외부 문서 참조, 요강이 지나치게 짧거나 일부만 붙여넣은 것으로 보이는 경우 등)에는 "warning"을 작성한다.

## 문체 규칙
- 결과 화면에서는 "~해요" 체의 부드러운 대화체로 보여준다.
- 영어 단어를 섞지 않는다.
- 사용자 화면에 보이는 용어는 내부 분류([A]/[B])를 그대로 노출하지 않고, "자동 확인 완료"/"직접 확인 필요"로 표시한다.
- 판정값도 "[충족]"/"[불충분]"/"[미충족]" 형태로 표시한다.

## 낮은 신뢰도 대응
- 요강이 지나치게 짧거나 일부만 붙여넣은 것으로 보이면, "warning"에 "요강이 불완전해 보여요. 더 많은 요건이 있을 수 있어요." 비슷한 안내를 넣는다.
- "별첨", "붙임 참조", "자세한 내용은 ~에서 확인" 같은 외부 문서 참조 표현이 있으면, "warning"에 요강 확인 필요 안내를 넣는다.

이제 위 규칙을 따라 결과를 JSON으로만 출력하세요.
`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { guideline, document, mockMode } = body as {
      guideline?: string;
      document?: string;
      mockMode?: boolean;
    };

    if (!guideline || !document) {
      return NextResponse.json({ error: '요강과 결과물을 입력해 주세요.' }, { status: 400 });
    }

    if (mockMode) {
      return NextResponse.json(mockResult(), { status: 200 });
    }

    const apiKey = process.env.UPSTAGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 없어요. 배포 전에는 모의 응답(키 없이 흐름 확인)을 사용해 주세요.' }, { status: 503 });
    }

    const prompt = buildPrompt(guideline, document);
    const content = await callSolarPro4([{ role: 'user', content: prompt }], apiKey);

    const parsed = parseResult(content);
    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '검사 중 오류가 발생했어요.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseResult(content: string): {
  requirements: Array<{ id: number; text: string; source: string; type: 'A' | 'B'; strength: '필수' | '권장' }>;
  aChecks: Array<{ id: number; requirement: string; quote: string; result: '[충족]' | '[불충분]' | '[미충족]' }>;
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
      aChecks: (data.aChecks ?? []) as Array<{ id: number; requirement: string; quote: string; result: '[충족]' | '[불충분]' | '[미충족]' }>,
      bChecks: (data.bChecks ?? []) as Array<{ id: number; requirement: string; question: string }>,
      finalMessage: String(data.finalMessage ?? ''),
      warning: data.warning ? String(data.warning) : undefined,
    };
  } catch (e) {
    throw new Error('LLM 응답을 파싱하지 못했어요.');
  }
}
