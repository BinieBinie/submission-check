import { NextRequest, NextResponse } from 'next/server';
import { extractTextWithOCR } from '@/lib/ocr';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { file } = body as { file?: { name: string; data: string; type: string } };

    if (!file) {
      return NextResponse.json({ error: '파일 정보가 없어요.' }, { status: 400 });
    }

    // 클라이언트에서 base64로 보낸 파일을 복원
    const byteString = atob(file.data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const uploadedFile = new File([ab], file.name, { type: file.type || 'application/octet-stream' });

    const result = await extractTextWithOCR(uploadedFile);

    return NextResponse.json(
      {
        text: result.text,
        pageCount: result.pageCount,
        fileName: result.fileName,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OCR 처리 중 오류가 발생했어요.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
