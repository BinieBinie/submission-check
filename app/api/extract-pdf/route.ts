import { NextRequest, NextResponse } from 'next/server';
import { extractPdf } from '@/lib/pdf';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name = '', buffer = [] } = body as { name?: string; buffer?: number[] };

    if (!name || !Array.isArray(buffer)) {
      return NextResponse.json({ error: '파일 정보가 없어요.' }, { status: 400 });
    }

    const fileName = String(name);
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension && extension !== 'pdf') {
      return NextResponse.json(
        {
          text: '',
          fileName,
          extension,
          pageCount: null,
          note: '.hwp 등 이 서비스에서는 직접 읽을 수 없는 형식이에요. 직접 확인 필요 항목으로 넘겨요.',
        },
        { status: 200 }
      );
    }

    const fileBuffer = Buffer.from(buffer);
    const result = await extractPdf(fileBuffer, fileName);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF 추출 중 오류가 발생했어요.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
