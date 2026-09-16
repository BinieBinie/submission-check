'use client';

import { useState, useCallback } from 'react';

interface Requirement {
  id: number;
  text: string;
  source: string;
  type: 'A' | 'B';
  strength: '필수' | '권장';
}

interface ACheck {
  id: number;
  requirement: string;
  quote: string;
  result: '[충족]' | '[불충분]' | '[미충족]';
}

interface BCheck {
  id: number;
  requirement: string;
  question: string;
}

interface InspectResult {
  requirements: Requirement[];
  aChecks: ACheck[];
  bChecks: BCheck[];
  finalMessage: string;
  warning?: string;
}

export default function Home() {
  const [guideline, setGuideline] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('submission-check-guideline');
        return saved ?? '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [document, setDocument] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('submission-check-document');
        return saved ?? '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [guidelineFile, setGuidelineFile] = useState<File | null>(null);
  const [guidelineIsExtracting, setGuidelineIsExtracting] = useState(false);
  const [guidelineExtractError, setGuidelineExtractError] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentIsExtracting, setDocumentIsExtracting] = useState(false);
  const [documentExtractError, setDocumentExtractError] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [result, setResult] = useState<InspectResult | null>(null);
  const [bCheckChecked, setBCheckChecked] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const [swapWarn, setSwapWarn] = useState(false);
  const [mockMode, setMockMode] = useState(false);

  const saveToLocalStorage = useCallback(() => {
    try {
      localStorage.setItem('submission-check-guideline', guideline);
      localStorage.setItem('submission-check-document', document);
    } catch {
      // ignore
    }
  }, [guideline, document]);

  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem('submission-check-guideline');
      localStorage.removeItem('submission-check-document');
    } catch {
      // ignore
    }
  }, []);

  const handleGuidelineChange = (value: string) => {
    setGuideline(value);
    saveToLocalStorage();
    if (result) setResult(null);
  };

  const handleDocumentChange = (value: string) => {
    setDocument(value);
    saveToLocalStorage();
    if (result) setResult(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fileCategory = (file: File): string => {
    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|heic|tiff?)$/i.test(file.name)) {
      return '이미지';
    }
    if (/\.pdf$/i.test(file.name)) {
      return 'PDF';
    }
    return '파일';
  };

  const extractFileText = async (file: File): Promise<{ text: string; pageCount: number }> => {
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|heic|tiff?)$/i.test(file.name);

    if (isImage) {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: { name: file.name, data: base64, type: file.type } }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `OCR 실패: ${res.status}`);
      }
      const data = (await res.json()) as { text: string; pageCount: number };
      return { text: data.text, pageCount: data.pageCount };
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = await import('pdfjs-dist');
    const originalWorkerSrc = pdfjs.GlobalWorkerOptions.workerSrc;
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const pageTexts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = (content.items as { str?: string }[])
          .map((item) => item.str ?? '')
          .join('');
        if (pageText.trim()) {
          pageTexts.push(pageText);
        }
      }
      return { text: pageTexts.join('\n'), pageCount: pdf.numPages };
    } finally {
      pdfjs.GlobalWorkerOptions.workerSrc = originalWorkerSrc;
    }
  };

  const handleExtractGuideline = async () => {
    if (!guidelineFile) return;
    setGuidelineIsExtracting(true);
    setGuidelineExtractError('');
    try {
      const { text } = await extractFileText(guidelineFile);
      setGuideline(text);
    } catch (e) {
      setGuidelineExtractError(String(e));
    } finally {
      setGuidelineIsExtracting(false);
    }
  };

  const handleExtractDocument = async () => {
    if (!documentFile) return;
    setDocumentIsExtracting(true);
    setDocumentExtractError('');
    try {
      const { text, pageCount } = await extractFileText(documentFile);
      const fileInfoLine = `파일: ${documentFile.name} / 페이지 수: ${pageCount}\n`;
      setDocument(fileInfoLine + text);
    } catch (e) {
      setDocumentExtractError(String(e));
    } finally {
      setDocumentIsExtracting(false);
    }
  };

  const removeGuidelineFile = () => {
    setGuidelineFile(null);
    setGuidelineExtractError('');
  };

  const removeDocumentFile = () => {
    setDocumentFile(null);
    setDocumentExtractError('');
  };

  const SWAP_KEYWORDS_DOC_LIKE_IN_GUIDELINE = [
    '포트폴리오',
    '활동 계획서',
    '예산 항목',
    '참여 내역',
    '기획 개요',
    '기대 효과',
    '콘텐츠 제작',
  ];
  const SWAP_KEYWORDS_GUIDELINE_LIKE_IN_DOC = [
    '지원 자격',
    '제출 마감',
    '제출 방법',
    '파일 형식',
    '분량',
    '폰트',
    '모집',
    '심사',
    '제출물',
  ];

  const detectSwapSuspect = (guidelineText: string, documentText: string): boolean => {
    if (!guidelineText.trim() || !documentText.trim()) return false;
    let docLikeInGuideline = 0;
    for (const kw of SWAP_KEYWORDS_DOC_LIKE_IN_GUIDELINE) {
      if (guidelineText.includes(kw)) docLikeInGuideline += 1;
    }
    let guidelineLikeInDoc = 0;
    for (const kw of SWAP_KEYWORDS_GUIDELINE_LIKE_IN_DOC) {
      if (documentText.includes(kw)) guidelineLikeInDoc += 1;
    }
    return docLikeInGuideline >= 2 && guidelineLikeInDoc >= 2;
  };

  const handleSwap = () => {
    const tmpGuidelines = guideline;
    const tmpDocuments = document;
    const tmpGuidelineFile = guidelineFile;
    const tmpDocumentFile = documentFile;
    const tmpGuidelineExtractError = guidelineExtractError;
    const tmpDocumentExtractError = documentExtractError;

    setGuideline(tmpDocuments);
    setDocument(tmpGuidelines);
    setGuidelineFile(tmpDocumentFile);
    setDocumentFile(tmpGuidelineFile);
    setGuidelineExtractError(tmpDocumentExtractError);
    setDocumentExtractError(tmpGuidelineExtractError);
    setSwapWarn(false);
    setResult(null);
    setError('');
  };

  const handleInspect = async () => {
    if (detectSwapSuspect(guideline, document)) {
      setSwapWarn(true);
      setError('');
      return;
    }
    if (!guideline.trim()) {
      setError('요강을 입력해 주세요.');
      return;
    }
    setError('');
    setResult(null);
    setIsInspecting(true);
    try {
      const effectiveDocument = document;
      if (!effectiveDocument.trim()) {
        setError('결과물 본문 또는 PDF 추출 텍스트가 필요해요.');
        return;
      }

      const body: Record<string, unknown> = {
        guideline: guideline,
        document: effectiveDocument,
        mockMode,
        fileName: documentFile?.name ?? guidelineFile?.name ?? '',
        extension: (documentFile ?? guidelineFile)?.name
          ?.split('.')
          ?.pop()
          ?.toLowerCase() ?? 'pdf',
      };

      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `검사 실패: ${res.status}`);
      }
      const data = (await res.json()) as InspectResult;
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsInspecting(false);
    }
  };

  const handleClear = () => {
    setGuideline('');
    setDocument('');
    removeGuidelineFile();
    removeDocumentFile();
    setResult(null);
    setError('');
    clearLocalStorage();
  };

  const EXAMPLE_GUIDELINE =
    '콘텐츠 기획 공모전\n\n지원 자격: 만 19세 이상, 콘텐츠 기획 경험 1회 이상\n제출물: 활동 계획서 1부(PDF), 포트폴리오 1부(PDF)\n활동 계획서 필수 포함 항목: 기획 개요, 추진 배경, 월별 세부 추진 일정, 예산 항목(항목별 금액 명시), 기대 효과, 팀 구성 및 역할\n파일 형식: PDF만 인정\n분량: 활동 계획서 A4 2장 이내\n폰트: 본문 10pt 이상\n파일명: 활동 계획서는 학번_이름.pdf, 포트폴리오는 이름_포트폴리오.pdf\n제출 마감: 2026년 9월 30일 18시\n제출 방법: 온라인 접수\n주의: 포트폴리오에 참여 내역을 반드시 기재\n별첨: 별첨 1. 심사 기준표 참조\n붙임: 붙임 양식(신청서식)은 홈페이지 공지사항에서 다운로드\n';

  const EXAMPLE_DOCUMENT =
    '콘텐츠 기획 공모전 활동 계획서\n\n1. 기획 개요\n- 기획명: 온라인 콘텐츠 시리즈 기획\n- 목적: 타겟 사용자의 참여 유도 및 브랜드 인지도 확대\n- 대상: 만 19세 이상 콘텐츠 소비층\n\n2. 추진 배경\n- 최근 짧은 형식 콘텐츠의 소비량이 증가하고 있어, 시리즈형 기획이 적합하다고 판단함\n- 예산 내에서 반복 노출과 참여 유도를 함께 달성할 수 있는 구성이 필요함\n\n3. 추진 내용\n- 1회차: 기획 의도와 시리즈 구성 안내\n- 2회차: 참여형 콘텐츠 소개\n- 3회차: 결과 공유 및 후속 참여 유도\n- 발행 형식: 이미지+짧은 문구 중심\n- 발행 주기: 주 1회\n\n5. 기대 효과\n- 시리즈 누적 노출을 통한 인지도 향상\n- 참여형 콘텐츠로 사용자 반응 확보\n- 후속 기획으로 연결 가능한 기반 마련\n\n※ 본 활동 계획서는 A4 2장 분량으로 작성했으며, 본문 글자는 11pt로 표기했음.\n';

  const handleExample = () => {
    setGuideline(EXAMPLE_GUIDELINE);
    setDocument(EXAMPLE_DOCUMENT);
    setResult(null);
    setError('');
  };

  return (
    <main style={{ background: 'var(--canvas)', padding: 'var(--sp-section) var(--sp-md)', fontFamily: 'var(--font-sans)', maxWidth: 'var(--max-width)', margin: '0 auto', boxSizing: 'border-box' }}>
      <style>{`\n        @media (max-width: 640px) {\n          .input-grid { grid-template-columns: 1fr !important; }\n          .result-table { min-width: 100% !important; }\n          .logo-img { width: 140px !important; }\n        }\n      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
        <img
          src="/logo/naedodwae_logo_bang.svg"
          alt="내도돼 로고"
          className="logo-img"
          style={{ width: 180, height: 'auto' }}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-body)', lineHeight: 'var(--lh-body)', textAlign: 'center', margin: 0 }}>
          제출 전, 내 제출물이 요건에 맞는지 확인해 보세요.<br />
          제출 요강과 제출물을 넣으면 제출 요건을 자동으로 정리해 드리고, 문서 내용이 요건을 충족하는지도 확인해 드려요.<br />
          PDF나 이미지를 올리면 텍스트로 바꿔 초안으로 보여드려요. 필요하면 직접 수정할 수도 있고요.<br />
          파일 형식, 페이지 수, 폰트처럼 자동 판별이 어려운 항목은 직접 확인할 체크리스트로 정리해 드려요.<br />
          내도 돼? 내도 돼! 지금 확인해보세요.
        </p>
      </div>

      <div className="input-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-layout-gap)', marginBottom: 'var(--sp-lg)' }}>
        <section style={{ marginBottom: 0 }}>
          <label style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)', display: 'block', marginBottom: 'var(--sp-xs)' }}>제출 요강 원문</label>
          <textarea
            value={guideline}
            onChange={(e) => handleGuidelineChange(e.target.value)}
            placeholder="제출 요강/모집공고 원문을 붙여넣으세요."
            style={{ width: '100%', minHeight: 220, padding: 'var(--sp-sm) var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)', color: 'var(--ink)', background: 'var(--field)', border: 'none', borderRadius: 'var(--rounded-sm)', boxSizing: 'border-box' }}
          />
          <div style={{ marginTop: 'var(--sp-sm)', padding: 'var(--sp-lg)', border: '1px solid var(--hairline-soft)', borderRadius: 'var(--rounded-md)', background: 'var(--canvas)' }}>
            <div style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)', marginBottom: 'var(--sp-xs)' }}>파일 업로드 - 제출 요강 (선택)</div>
            <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginBottom: 'var(--sp-sm)', lineHeight: 'var(--lh-caption)' }}>
              요강을 PDF나 이미지로 올리면 텍스트를 추출해서 초안으로 만들 수 있어요. 필요하면 직접 수정할 수도 있고요.
            </p>
            {guidelineFile && (
              <div style={{ marginBottom: 'var(--sp-sm)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                업로드됨: <span style={{ fontWeight: 'var(--fw-label)', color: 'var(--ink)' }}>{guidelineFile.name}</span>
                <span style={{ marginLeft: '8px', color: 'var(--text-faint)' }}>({fileCategory(guidelineFile)})</span>
              </div>
            )}
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp,image/bmp,image/heic"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file) {
                  setGuidelineFile(file);
                  setGuidelineExtractError('');
                }
              }}
            />
            <button
              type="button"
              onClick={handleExtractGuideline}
              disabled={guidelineIsExtracting}
              style={{ marginTop: '36px', padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: guidelineIsExtracting ? 'var(--canvas-soft)' : 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: guidelineIsExtracting ? 'not-allowed' : 'pointer' }}
            >
              {guidelineIsExtracting ? '텍스트 추출 중...' : '텍스트 추출'}
            </button>
            {guidelineIsExtracting && (
              <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--text-muted)', fontSize: 'var(--fs-caption)' }}>
                {guidelineFile ? `(${fileCategory(guidelineFile)} 텍스트를 추출 중입니다.)` : '텍스트를 추출 중입니다.'}
              </div>
            )}
            {guidelineExtractError && (
              <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--ink)', fontSize: 'var(--fs-caption)' }}>텍스트 추출에 실패했어요: {guidelineExtractError}</div>
            )}
            {guidelineFile && !guidelineIsExtracting && !guidelineExtractError && (
              <button
                type="button"
                onClick={removeGuidelineFile}
                style={{ marginTop: '48px', padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: 'pointer' }}
              >
                업로드 제거
              </button>
            )}
          </div>
        </section>

        <section style={{ marginBottom: 0 }}>
          <label style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)', display: 'block', marginBottom: 'var(--sp-xs)' }}>제출할 결과물 본문</label>
          <textarea
            value={document}
            onChange={(e) => handleDocumentChange(e.target.value)}
            placeholder="제출할 결과물 본문을 붙여넣으세요. PDF나 이미지를 올렸다가 텍스트로 바꿔 넣어도 돼요."
            style={{ width: '100%', minHeight: 220, padding: 'var(--sp-sm) var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)', color: 'var(--ink)', background: 'var(--field)', border: 'none', borderRadius: 'var(--rounded-sm)', boxSizing: 'border-box' }}
          />
          <div style={{ marginTop: 'var(--sp-sm)', padding: 'var(--sp-lg)', border: '1px solid var(--hairline-soft)', borderRadius: 'var(--rounded-md)', background: 'var(--canvas)' }}>
            <div style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)', marginBottom: 'var(--sp-xs)' }}>파일 업로드 - 제출 결과물 (선택)</div>
            <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginBottom: 'var(--sp-sm)', lineHeight: 'var(--lh-caption)' }}>
              결과물이 PDF나 이미지면 여기서 텍스트를 뽑아 초안으로 바꿀 수 있어요. 필요하면 직접 수정할 수도 있고요.
            </p>
            {documentFile && (
              <div style={{ marginBottom: 'var(--sp-sm)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                업로드됨: <span style={{ fontWeight: 'var(--fw-label)', color: 'var(--ink)' }}>{documentFile.name}</span>
                <span style={{ marginLeft: '8px', color: 'var(--text-faint)' }}>({fileCategory(documentFile)})</span>
              </div>
            )}
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp,image/bmp,image/heic"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file) {
                  setDocumentFile(file);
                  setDocumentExtractError('');
                }
              }}
            />
            <button
              type="button"
              onClick={handleExtractDocument}
              disabled={documentIsExtracting}
              style={{ marginTop: '36px', padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: documentIsExtracting ? 'var(--canvas-soft)' : 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: documentIsExtracting ? 'not-allowed' : 'pointer' }}
            >
              {documentIsExtracting ? '텍스트 추출 중...' : '텍스트 추출'}
            </button>
            {documentIsExtracting && (
              <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--text-muted)', fontSize: 'var(--fs-caption)' }}>
                {documentFile ? `(${fileCategory(documentFile)} 텍스트를 추출 중입니다.)` : '텍스트를 추출 중입니다.'}
              </div>
            )}
            {documentExtractError && (
              <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--ink)', fontSize: 'var(--fs-caption)' }}>텍스트 추출에 실패했어요: {documentExtractError}</div>
            )}
            {documentFile && !documentIsExtracting && !documentExtractError && (
              <button
                type="button"
                onClick={removeDocumentFile}
                style={{ marginTop: '48px', padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: 'pointer' }}
              >
                업로드 제거
              </button>
            )}
          </div>
        </section>
      </div>

      {error && (
        <div style={{ marginTop: 'var(--sp-sm)', padding: 'var(--sp-sm) var(--sp-md)', background: 'var(--canvas-soft)', border: '1px solid var(--hairline-soft)', borderRadius: 'var(--rounded-sm)', color: 'var(--ink)' }}>
          {error}
        </div>
      )}

      {swapWarn && (
        <div style={{ marginTop: 'var(--sp-sm)', padding: 'var(--sp-sm) var(--sp-md)', background: 'var(--canvas-soft)', border: '1px solid var(--hairline-soft)', borderRadius: 'var(--rounded-sm)', color: 'var(--ink)' }}>
          <strong style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)' }}>입력 순서를 바꿔서 넣었을 수 있어요.</strong>
          <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--ink-soft)', fontSize: 'var(--fs-body-sm)' }}>
            제출 요강 원문에 결과물 쪽 단어가, 결과물 본문에 요강 쪽 단어가 함께 보여서 두 입력이 서로 바뀐 것 같아요.
          </div>
          <button
            type="button"
            onClick={handleSwap}
            style={{ marginTop: 'var(--sp-sm)', padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--on-primary)', background: 'var(--ink)', border: 'none', borderRadius: 'var(--rounded-full)', cursor: 'pointer' }}
          >
            제출 요강과 결과물 순서를 바꾸기
          </button>
        </div>
      )}

      <section style={{ marginTop: 'var(--sp-lg)', display: 'flex', gap: 'var(--sp-md)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleInspect}
          disabled={isInspecting}
          style={{ padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--on-primary)', background: 'var(--ink)', border: 'none', borderRadius: 'var(--rounded-full)', cursor: !isInspecting ? 'pointer' : 'not-allowed' }}
        >
          {isInspecting ? '검사 중...' : '검사 실행'}
        </button>
        <button
          type="button"
          onClick={handleClear}
          style={{ padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: 'pointer' }}
        >
          입력 초기화
        </button>
        <button
          type="button"
          onClick={handleExample}
          style={{ padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: 'pointer' }}
        >
          예시 보기
        </button>
      </section>

      {result && (
        <section style={{ marginTop: 'var(--sp-xl)', borderTop: '1px solid var(--hairline-soft)', paddingTop: 'var(--sp-md)' }}>
          <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-h2)', lineHeight: 'var(--lh-h2)', color: 'var(--ink)', marginBottom: 'var(--sp-md)' }}>검사 결과.</h2>

          {result.warning && (
            <div style={{ marginBottom: 'var(--sp-md)', padding: 'var(--sp-sm) var(--sp-md)', background: 'var(--canvas-soft)', border: '1px solid var(--hairline-soft)', borderRadius: 'var(--rounded-sm)', color: 'var(--ink)' }}>
              <strong style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)' }}>요강 확인 필요.</strong>
              <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--ink-soft)', fontSize: 'var(--fs-body-sm)' }}>{result.warning}</div>
            </div>
          )}

          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <h3 style={{ fontSize: 'var(--fs-h4)', fontWeight: 'var(--fw-h4)', lineHeight: 'var(--lh-h4)', color: 'var(--ink)', marginBottom: 'var(--sp-sm)' }}>1) 추출된 제출 요건.</h3>
            <table className="result-table" style={{ width: '100%', minWidth: '470px', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--canvas-soft)' }}>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>번호</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>요건</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>요강 원문 인용</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>구분</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>강제성</th>
                </tr>
              </thead>
              <tbody>
              {result.requirements.map((r) => (
                 <tr key={r.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)' }}>{r.id}</td>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)' }}>{r.text}</td>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)' }}>{r.source}</td>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)', textAlign: 'left' }}>
                     {r.type === 'A' ? <span style={{ color: 'var(--result-pass-text)', fontWeight: 'var(--fw-title)' }}>자동 확인 완료</span> : <span style={{ color: 'var(--text-muted)', fontWeight: 'var(--fw-label)' }}>직접 확인 필요</span>}
                   </td>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)' }}>{r.strength}</td>
                 </tr>
               ))}
               </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <h3 style={{ fontSize: 'var(--fs-h4)', fontWeight: 'var(--fw-h4)', lineHeight: 'var(--lh-h4)', color: 'var(--ink)', marginBottom: 'var(--sp-sm)' }}>2) 자동 점검 결과.</h3>
            <table className="result-table" style={{ width: '100%', minWidth: '410px', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--canvas-soft)' }}>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>번호</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>요건</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>결과물에서 찾은 부분(인용)</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>판정</th>
                </tr>
              </thead>
              <tbody>
              {result.aChecks.map((c) => (
                 <tr key={c.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)' }}>{c.id}</td>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)' }}>{c.requirement}</td>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)' }}>{c.quote || '관련 부분 없음'}</td>
                   <td style={{ padding: '8px 10px', border: '1px solid var(--hairline)', textAlign: 'center', fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', background: c.result === '[충족]' ? 'var(--result-pass-bg)' : c.result === '[불충분]' ? 'var(--result-partial-bg)' : 'var(--result-fail-bg)', color: c.result === '[충족]' ? 'var(--result-pass-text)' : c.result === '[불충분]' ? 'var(--result-partial-text)' : 'var(--result-fail-text)' }}>{c.result}</td>
                 </tr>
               ))}
               </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ fontSize: 'var(--fs-h4)', fontWeight: 'var(--fw-h4)', lineHeight: 'var(--lh-h4)', color: 'var(--ink)', marginBottom: 'var(--sp-sm)' }}>3) 직접 확인이 필요한 항목.</h3>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)' }}>
              {result.bChecks.map((b) => (
                <li key={b.id} style={{ marginBottom: 'var(--sp-sm)', paddingLeft: 'var(--sp-md)', display: 'flex', gap: 'var(--sp-sm)', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={bCheckChecked[b.id] ?? false}
                    onChange={() => setBCheckChecked((prev) => ({ ...prev, [b.id]: !prev[b.id] }))}
                    style={{ marginTop: 2, accentColor: 'var(--ink)', width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span style={{ color: 'var(--ink)' }}>{b.question}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 'var(--sp-lg)', padding: 'var(--sp-md)', borderRadius: 'var(--rounded-md)', background: result.finalMessage.includes('아직 제출하지') ? 'var(--accent)' : 'var(--canvas-soft)', border: `1px solid ${result.finalMessage.includes('아직 제출하지') ? 'var(--accent)' : 'var(--hairline-soft)'}`, color: result.finalMessage.includes('아직 제출하지') ? 'var(--on-primary)' : 'var(--ink)' }}>
            {result.finalMessage}
          </div>
        </section>
      )}
      <footer style={{ marginTop: 'var(--sp-section)', padding: 'var(--sp-lg) var(--sp-md)', background: 'var(--ink)', color: 'var(--on-primary)', borderRadius: 'var(--rounded-md) 0 0 0', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-faint)' }}>Design Reference: Mobbin Design System (https://getdesign.md/mobbin/design-md)</div>
      </footer>
    </main>
  );
}
