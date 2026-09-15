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
  const [guidelinePdfFile, setGuidelinePdfFile] = useState<File | null>(null);
  const [guidelinePdfText, setGuidelinePdfText] = useState('');
  const [guidelineIsExtracting, setGuidelineIsExtracting] = useState(false);
  const [guidelineExtractError, setGuidelineExtractError] = useState('');
  const [documentPdfFile, setDocumentPdfFile] = useState<File | null>(null);
  const [documentPdfText, setDocumentPdfText] = useState('');
  const [documentIsExtracting, setDocumentIsExtracting] = useState(false);
  const [documentExtractError, setDocumentExtractError] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [result, setResult] = useState<InspectResult | null>(null);
  const [error, setError] = useState('');
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

  const extractPdfText = async (file: File): Promise<{ text: string; pageCount: number }> => {
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

  const handleExtractGuidelinePdf = async () => {
    if (!guidelinePdfFile) return;
    setGuidelineIsExtracting(true);
    setGuidelineExtractError('');
    try {
      const { text } = await extractPdfText(guidelinePdfFile);
      setGuidelinePdfText(text);
    } catch (e) {
      setGuidelineExtractError(String(e));
    } finally {
      setGuidelineIsExtracting(false);
    }
  };

  const handleExtractDocumentPdf = async () => {
    if (!documentPdfFile) return;
    setDocumentIsExtracting(true);
    setDocumentExtractError('');
    try {
      const { text, pageCount } = await extractPdfText(documentPdfFile);
      const fileInfoLine = `파일: ${documentPdfFile.name} / 페이지 수: ${pageCount}\n`;
      setDocumentPdfText(fileInfoLine + text);
    } catch (e) {
      setDocumentExtractError(String(e));
    } finally {
      setDocumentIsExtracting(false);
    }
  };

  const removeGuidelinePdf = () => {
    setGuidelinePdfFile(null);
    setGuidelinePdfText('');
    setGuidelineExtractError('');
  };

  const removeDocumentPdf = () => {
    setDocumentPdfFile(null);
    setDocumentPdfText('');
    setDocumentExtractError('');
  };

  const handleInspect = async () => {
    const effectiveGuideline = guidelinePdfText.trim() ? guidelinePdfText : guideline;
    if (!effectiveGuideline.trim()) {
      setError('요강을 입력해 주세요.');
      return;
    }
    setError('');
    setResult(null);
    setIsInspecting(true);
    try {
      const effectiveDocument = documentPdfText.trim() ? documentPdfText : document;
      if (!effectiveDocument.trim()) {
        setError('결과물 본문 또는 PDF 추출 텍스트가 필요해요.');
        return;
      }

      const body: Record<string, unknown> = {
        guideline: effectiveGuideline,
        document: effectiveDocument,
        mockMode,
        fileName: documentPdfFile?.name ?? guidelinePdfFile?.name ?? '',
        extension: (documentPdfFile ?? guidelinePdfFile)?.name
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
    removeGuidelinePdf();
    removeDocumentPdf();
    setResult(null);
    setError('');
    clearLocalStorage();
  };

  return (
    <main style={{ background: 'var(--canvas)', padding: 'var(--sp-section) var(--sp-md)', fontFamily: 'var(--font-sans)', maxWidth: 'var(--max-width)', margin: '0 auto', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-h1)', lineHeight: 'var(--lh-h1)', color: 'var(--ink)', marginBottom: 'var(--sp-md)' }}>제출 요건 준수 검사.</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-body-lg)', fontWeight: 'var(--fw-body-lg)', lineHeight: 'var(--lh-body-lg)' }}>
        제출 요강과 제출물을 넣으면, 요강에서 요건을 뽑아내고 텍스트로 확인 가능한 항목만 판정해요.
        PDF를 올리면 브라우저에서 텍스트를 뽑아 초안으로 보여주고, 필요하면 직접 수정할 수 있어요.
        파일 형식, 페이지 수, 폰트처럼 텍스트만으로는 알 수 없는 항목은 직접 확인 체크리스트로 넘겨요.
      </p>

      <section style={{ marginTop: 'var(--sp-lg)' }}>
        <label style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)', display: 'block', marginBottom: 'var(--sp-xs)' }}>제출 요강 원문</label>
        <textarea
          value={guideline}
          onChange={(e) => handleGuidelineChange(e.target.value)}
          placeholder="제출 요강/모집공고 원문을 붙여넣으세요."
          style={{ width: '100%', minHeight: 180, padding: 'var(--sp-sm) var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)', color: 'var(--ink)', background: 'var(--field)', border: 'none', borderRadius: 'var(--rounded-sm)', boxSizing: 'border-box' }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
              type="button"
              onClick={handleClear}
              style={{ padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: 'pointer' }}
            >입력 초기화</button>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-muted)' }}>초안은 브라우저에만 저장돼요.</span>
        </div>
        <div style={{ marginTop: 'var(--sp-sm)', padding: 'var(--sp-lg)', border: '1px solid var(--hairline-soft)', borderRadius: 'var(--rounded-md)', background: 'var(--canvas)' }}>
          <div style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)', marginBottom: 'var(--sp-xs)' }}>PDF 업로드 - 제출 요강 (선택)</div>
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginBottom: 'var(--sp-sm)', lineHeight: 'var(--lh-caption)' }}>
            요강을 PDF로 올렸다면 여기서 텍스트를 뽑아 초안으로 바꿀 수 있어요.
          </p>
          {guidelinePdfFile && (
            <div style={{ marginBottom: 'var(--sp-sm)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
              업로드됨: <span style={{ fontWeight: 'var(--fw-label)', color: 'var(--ink)' }}>{guidelinePdfFile.name}</span>
            </div>
          )}
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) {
                setGuidelinePdfFile(file);
                setGuidelinePdfText('');
                setGuidelineExtractError('');
              }
            }}
          />
          <div style={{ marginTop: 'var(--sp-xs)', fontSize: 'var(--fs-caption)', color: 'var(--text-faint)' }}>.hwp 파일은 직접 읽을 수 없어요.</div>
          <button
              type="button"
              onClick={handleExtractGuidelinePdf}
              disabled={guidelineIsExtracting}
              style={{ marginTop: 'var(--sp-sm)', padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: guidelineIsExtracting ? 'var(--canvas-soft)' : 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: guidelineIsExtracting ? 'not-allowed' : 'pointer' }}
            >
              {guidelineIsExtracting ? '텍스트 추출 중...' : 'PDF 텍스트 추출'}
            </button>
          {guidelineIsExtracting && (
            <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--text-muted)', fontSize: 'var(--fs-caption)' }}>PDF 텍스트를 추출 중입니다.</div>
          )}
          {guidelineExtractError && (
            <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--ink)', fontSize: 'var(--fs-caption)' }}>텍스트 추출에 실패했어요: {guidelineExtractError}</div>
          )}
          {guidelinePdfText && (
            <div style={{ marginTop: 'var(--sp-sm)' }}>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginBottom: 'var(--sp-xs)' }}>추출한 요강 텍스트 (수정 가능):</div>
              <textarea
                value={guidelinePdfText}
                onChange={(e) => setGuidelinePdfText(e.target.value)}
                style={{ width: '100%', minHeight: 120, padding: 'var(--sp-sm) var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)', color: 'var(--ink)', background: 'var(--field)', border: 'none', borderRadius: 'var(--rounded-sm)', boxSizing: 'border-box' }}
              />
            </div>
          )}
          {guidelinePdfFile && !guidelineIsExtracting && !guidelinePdfText && !guidelineExtractError && (
            <button
              type="button"
              onClick={removeGuidelinePdf}
              style={{ marginTop: 'var(--sp-md)', padding: '0px var(--sp-sm) var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)', color: 'var(--ink)', background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: 'pointer' }}
            >
              업로드 제거
            </button>
          )}
        </div>
      </section>

      <section style={{ marginTop: 'var(--sp-lg)' }}>
        <label style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)', display: 'block', marginBottom: 'var(--sp-xs)' }}>제출할 결과물 본문</label>
        <textarea
          value={document}
          onChange={(e) => handleDocumentChange(e.target.value)}
          placeholder="제출할 결과물 본문을 붙여넣으세요. PDF를 올렸다가 텍스트로 바꿔 넣어도 돼요."
          style={{ width: '100%', minHeight: 220, padding: 'var(--sp-sm) var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)', color: 'var(--ink)', background: 'var(--field)', border: 'none', borderRadius: 'var(--rounded-sm)', boxSizing: 'border-box' }}
        />
        <div style={{ marginTop: 'var(--sp-sm)', padding: 'var(--sp-lg)', border: '1px solid var(--hairline-soft)', borderRadius: 'var(--rounded-md)', background: 'var(--canvas)' }}>
          <div style={{ fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', color: 'var(--ink)', marginBottom: 'var(--sp-xs)' }}>PDF 업로드 - 제출 결과물 (선택)</div>
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginBottom: 'var(--sp-sm)', lineHeight: 'var(--lh-caption)' }}>
            결과물이 PDF면 여기서 텍스트를 뽑아 초안으로 바꿀 수 있어요.
          </p>
          {documentPdfFile && (
            <div style={{ marginBottom: 'var(--sp-sm)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
              업로드됨: <span style={{ fontWeight: 'var(--fw-label)', color: 'var(--ink)' }}>{documentPdfFile.name}</span>
            </div>
          )}
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) {
                setDocumentPdfFile(file);
                setDocumentPdfText('');
                setDocumentExtractError('');
              }
            }}
          />
          <div style={{ marginTop: 'var(--sp-xs)', fontSize: 'var(--fs-caption)', color: 'var(--text-faint)' }}>.hwp 파일은 직접 읽을 수 없어요.</div>
          <button
              type="button"
              onClick={handleExtractDocumentPdf}
              disabled={documentIsExtracting}
              style={{ marginTop: 'var(--sp-sm)', padding: '0px var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-link)', fontWeight: 'var(--fw-link)', color: 'var(--ink)', background: documentIsExtracting ? 'var(--canvas-soft)' : 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: documentIsExtracting ? 'not-allowed' : 'pointer' }}
            >
              {documentIsExtracting ? '텍스트 추출 중...' : 'PDF 텍스트 추출'}
            </button>
          {documentIsExtracting && (
            <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--text-muted)', fontSize: 'var(--fs-caption)' }}>PDF 텍스트를 추출 중입니다.</div>
          )}
          {documentExtractError && (
            <div style={{ marginTop: 'var(--sp-xs)', color: 'var(--ink)', fontSize: 'var(--fs-caption)' }}>텍스트 추출에 실패했어요: {documentExtractError}</div>
          )}
          {documentPdfText && (
            <div style={{ marginTop: 'var(--sp-sm)' }}>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginBottom: 'var(--sp-xs)' }}>추출한 결과물 텍스트 (수정 가능):</div>
              <textarea
                value={documentPdfText}
                onChange={(e) => setDocumentPdfText(e.target.value)}
                style={{ width: '100%', minHeight: 120, padding: 'var(--sp-sm) var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)', color: 'var(--ink)', background: 'var(--field)', border: 'none', borderRadius: 'var(--rounded-sm)', boxSizing: 'border-box' }}
              />
            </div>
          )}
          {documentPdfFile && !documentIsExtracting && !documentPdfText && !documentExtractError && (
            <button
              type="button"
              onClick={removeDocumentPdf}
              style={{ marginTop: 'var(--sp-md)', padding: '0px var(--sp-sm) var(--sp-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)', color: 'var(--ink)', background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-full)', cursor: 'pointer' }}
            >
              업로드 제거
            </button>
          )}
        </div>
      </section>

      {error && (
        <div style={{ marginTop: 'var(--sp-sm)', padding: 'var(--sp-sm) var(--sp-md)', background: 'var(--canvas-soft)', border: '1px solid var(--hairline-soft)', borderRadius: 'var(--rounded-sm)', color: 'var(--ink)' }}>
          {error}
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
        <label style={{ fontSize: 'var(--fs-label)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mockMode}
            onChange={(e) => setMockMode(e.target.checked)}
          />
          키 없이 흐름만 확인(모의 응답)
        </label>
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
            <table style={{ width: '100%', minWidth: '470px', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--canvas-soft)' }}>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>번호</th>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>요건</th>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>요강 원문 인용</th>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>구분</th>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>강제성</th>
                </tr>
              </thead>
              <tbody>
              {result.requirements.map((r) => (
                 <tr key={r.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)' }}>{r.id}</td>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)' }}>{r.text}</td>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)' }}>{r.source}</td>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', textAlign: 'left' }}>
                     {r.type === 'A' ? <span style={{ color: 'var(--result-pass-text)', fontWeight: 'var(--fw-title)' }}>자동 확인 완료</span> : <span style={{ color: 'var(--text-muted)', fontWeight: 'var(--fw-label)' }}>직접 확인 필요</span>}
                   </td>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)' }}>{r.strength}</td>
                 </tr>
               ))}
               </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <h3 style={{ fontSize: 'var(--fs-h4)', fontWeight: 'var(--fw-h4)', lineHeight: 'var(--lh-h4)', color: 'var(--ink)', marginBottom: 'var(--sp-sm)' }}>2) 자동 점검 결과.</h3>
            <table style={{ width: '100%', minWidth: '410px', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-body-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--canvas-soft)' }}>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>번호</th>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>요건</th>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>결과물에서 찾은 부분(인용)</th>
                  <th style={{ textAlign: 'center', padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', whiteSpace: 'nowrap' }}>판정</th>
                </tr>
              </thead>
              <tbody>
              {result.aChecks.map((c) => (
                 <tr key={c.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)' }}>{c.id}</td>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)' }}>{c.requirement}</td>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)' }}>{c.quote || '관련 부분 없음'}</td>
                   <td style={{ padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--hairline)', textAlign: 'center', fontWeight: 'var(--fw-title)', fontSize: 'var(--fs-title)', background: c.result === '[충족]' ? 'var(--result-pass-bg)' : c.result === '[불충분]' ? 'var(--result-partial-bg)' : 'var(--result-fail-bg)', color: c.result === '[충족]' ? 'var(--result-pass-text)' : c.result === '[불충분]' ? 'var(--result-partial-text)' : 'var(--result-fail-text)' }}>{c.result}</td>
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
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '1px solid var(--ink)', borderRadius: 'var(--rounded-full)', flexShrink: 0, background: 'var(--canvas)' }} />
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
