export function mockResult() {
  return {
    requirements: [
      {
        id: 1,
        text: '결과물에 필수 항목이 포함되어야 함',
        source: '"반드시 포함되어야 한다"',
        type: 'A',
        strength: '필수',
      },
      {
        id: 2,
        text: '파일명 규칙 준수',
        source: '"파일명은 학번_이름 형식으로 제출"',
        type: 'B',
        strength: '필수',
      },
      {
        id: 3,
        text: '추천서 첨부',
        source: '"추천서를 첨부할 것을 권장한다"',
        type: 'B',
        strength: '권장',
      },
    ],
    aChecks: [
      {
        id: 1,
        requirement: '결과물에 필수 항목이 포함되어야 함',
        quote: '결과물 본문에 필수 항목 내용이 포함되어 있음',
        result: '[충족]',
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
    finalMessage:
      '내용 확인 가능한 요건은 확인되었어요. 다만 파일명 규칙과 추천서 첨부는 직접 확인이 필요해요. 아직 제출하지 마시고 [B] 항목을 먼저 확인해 주세요.',
    warning:
      '요강에 "별첨", "붙임 참조" 같은 외부 문서 참조가 보여요. 더 많은 요건이 있을 수 있으니 원본 요강을 한 번 더 확인해 주세요.',
  };
}
