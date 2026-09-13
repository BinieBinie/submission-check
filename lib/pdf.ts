import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// pdfjs-dist는 버전/환경에 따라 기본 export가 다를 수 있어,
// 실무에서는 공식 가이드에 맞춰 worker 경로를 잡아주세요.
// 여기에서는 텍스트 추출만 수행한다고 가정합니다.
async function extractTextFromPdf(filePath: string): Promise<string> {
  // pdfjs-dist를 사용할 경우 예시 구조입니다.
  // 실제 빌드/실행 환경에 맞춰 import와 worker 설정을 조정해야 합니다.
  //
  // 예시:
  // const pdfjsLib = await import('pdfjs-dist');
  // pdfjsLib.GlobalWorkerOptions.workerSrc = ...;
  // const data = new Uint8Array(fs.readFileSync(filePath));
  // const pdf = await pdfjsLib.getDocument({ data }).promise;
  // let text = '';
  // for (let i = 1; i <= pdf.numPages; i++) {
  //   const page = await pdf.getPage(i);
  //   const content = await page.getTextContent();
  //   text += content.items.map((item: any) => item.str).join(' ') + '\n';
  // }
  // return text;

  // 임시 placeholder: 실제 구현 시 위 로직을 넣습니다.
  throw new Error('PDF 텍스트 추출 로직이 아직 구현되지 않았습니다.');
}

export interface ExtractedPdfInfo {
  text: string;
  fileName: string;
  extension: string;
  pageCount: number | null;
}

export async function extractPdf(fileBuffer: Buffer, fileName: string): Promise<ExtractedPdfInfo> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'submission-check-pdf-'));
  const tmpPath = path.join(tmpDir, fileName);
  fs.writeFileSync(tmpPath, fileBuffer);

  try {
    const text = await extractTextFromPdf(tmpPath);
    const extension = path.extname(fileName).toLowerCase().slice(1) || 'pdf';
    // pageCount는 추출 과정에서 얻을 수 있으면 채우고, 없으면 null로 둡니다.
    const pageCount: number | null = null;
    return { text, fileName, extension, pageCount };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
