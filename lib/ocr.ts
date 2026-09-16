import { NextRequest, NextResponse } from 'next/server';

export async function extractTextWithOCR(file: File): Promise<{ text: string; pageCount: number; fileName: string }> {
  const url = 'https://api.upstage.ai/v1/document-digitization';
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('OCR API 키가 없어요.');
  }

  const formData = new FormData();
  formData.append('document', file);
  formData.append('model', 'ocr');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OCR 호출 실패: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    text?: string;
    pages?: Array<{ text?: string; confidence?: number }>;
    numBilledPages?: number;
    error?: string;
  };

  if (data.error) {
    throw new Error(`OCR 오류: ${data.error}`);
  }

  const fullText = data.text ?? '';
  const pages = data.pages ?? [];
  const pageTexts = pages
    .map((p) => (typeof p === 'object' && p !== null && 'text' in p ? (p.text as string) ?? '' : ''))
    .filter((t) => t.trim());

  const text = pageTexts.length > 0 ? pageTexts.join('\n') : fullText;
  const pageCount = Math.max(pageTexts.length, data.numBilledPages ?? pages.length ?? 1);

  return {
    text,
    pageCount,
    fileName: file.name,
  };
}
