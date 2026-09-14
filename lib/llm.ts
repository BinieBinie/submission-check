export async function callSolarPro4(messages: object[], apiKey: string) {
  const url = 'https://api.upstage.ai/v1/chat/completions';
  const body = {
    model: 'solar-pro4',
    messages,
    max_tokens: 4096,
    temperature: 0,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Solar Pro 4 호출 실패: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Solar Pro 4 응답에 콘텐츠가 없습니다.');
  }
  return content;
}
