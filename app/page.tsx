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

  const handleInspect = async () => {
    if (!guideline.trim() || !document.trim()) {
      setError('요강과 결과물을 모두 입력해 주세요.');
      return;
    }
    setError('');
    setResult(null);
    setIsInspecting(true);
    try {
      const body: Record<string, unknown> = {
        guideline,
        document,
        mockMode,
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
    setResult(null);
    setError('');
    clearLocalStorage();
  };

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>제출 요건 준수 검사</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        제출 요강과 제출물을 넣으면, 요강에서 요건을 뽑아내고 텍스트로 확인 가능한 항목만 판정해요.
        파일 형식, 페이지 수, 폰트처럼 텍스트만으로는 알 수 없는 항목은 직접 확인 체크리스트로 넘겨요.
      </p>

      <section style={{ marginTop: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>제출 요강 원문</label>
        <textarea
          value={guideline}
          onChange={(e) => handleGuidelineChange(e.target.value)}
          placeholder="제출 요강/모집공고 원문을 붙여넣으세요."
          style={{ width: '100%', minHeight: 180, padding: '10px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" onClick={handleClear} style={{ color: '#a00' }}>입력 초기화</button>
          <span style={{ fontSize: 12, color: '#888' }}>초안은 브라우저에만 저장돼요.</span>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>제출할 결과물 본문</label>
        <textarea
          value={document}
          onChange={(e) => handleDocumentChange(e.target.value)}
          placeholder="제출할 결과물 본문을 붙여넣으세요."
          style={{ width: '100%', minHeight: 220, padding: '10px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
        />
      </section>

      {error && (
        <div style={{ marginTop: 16, padding: '12px', background: '#fdecec', border: '1px solid #e6b0b0', borderRadius: 8, color: '#a00' }}>
          {error}
        </div>
      )}

      <section style={{ marginTop: 24, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleInspect}
          disabled={isInspecting}
          style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: !isInspecting ? 'pointer' : 'not-allowed' }}
        >
          {isInspecting ? '검사 중...' : '검사 실행'}
        </button>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mockMode}
            onChange={(e) => setMockMode(e.target.checked)}
          />
          키 없이 흐름만 확인(모의 응답)
        </label>
      </section>

      {result && (
        <section style={{ marginTop: 28, borderTop: '1px solid #ddd', paddingTop: 20 }}>
          <h2>검사 결과</h2>

          {result.warning && (
            <div style={{ marginBottom: 16, padding: '10px 12px', background: '#fff8e6', border: '1px solid #e6c98a', borderRadius: 8, color: '#7a5a00' }}>
              <strong>요강 확인 필요</strong>
              <div style={{ marginTop: 4 }}>{result.warning}</div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>1) 추출된 제출 요건</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>번호</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>요건</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>요강 원문 인용</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>구분</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>강제성</th>
                </tr>
              </thead>
              <tbody>
                {result.requirements.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{r.id}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{r.text}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{r.source}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>
                      {r.type === 'A' ? '자동 확인 완료' : '직접 확인 필요'}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{r.strength}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>2) 자동 점검 결과</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>번호</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>요건</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>결과물에서 찾은 부분(인용)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ddd' }}>판정</th>
                </tr>
              </thead>
              <tbody>
                {result.aChecks.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{c.id}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{c.requirement}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{c.quote || '관련 부분 없음'}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{c.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>3) 직접 확인이 필요한 항목</h3>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 14 }}>
              {result.bChecks.map((b) => (
                <li key={b.id} style={{ marginBottom: 8, paddingLeft: 22, textIndent: -22, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '1px solid #666', borderRadius: 2, flexShrink: 0 }} />
                  <span>{b.question}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 20, padding: '14px', borderRadius: 8, background: result.finalMessage.includes('아직 제출하지') ? '#fdecec' : '#eafaf1', border: `1px solid ${result.finalMessage.includes('아직 제출하지') ? '#e6b0b0' : '#b6e6c4'}` }}>
            {result.finalMessage}
          </div>
        </section>
      )}
    </main>
  );
}
