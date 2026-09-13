# submission-check

제출 요강과 제출물을 받아, 텍스트로 확인 가능한 요건만 판정하고 확인 불가 항목은 직접 확인 체크리스트로 넘기는 제출 직전 점검 도구.

## 로컬 실행

### 사전 준비
- Node.js >= 20 권장 (현재 프로젝트는 Node 18에서도 일부 기능으로 동작 가능)
- npm install

### 환경변수 설정
1. `.env.example`을 복사해 `.env.local`을 만듭니다.
   ```bash
   cp .env.example .env.local
   ```
2. `.env.local`의 `UPSTAGE_API_KEY`에 본인 계정의 키를 넣습니다.
3. `.env.local`은 **절대 커밋하지 마세요.** `.gitignore`에 이미 제외되어 있습니다.

### 개발 서버 실행
```bash
npm run dev
```

### 모의 응답 확인 (키 없이 흐름만 볼 때)
- 브라우저에서 "키 없이 흐름만 확인(모의 응답)" 체크를 켜면 mock 응답을 반환합니다.
- 이 상태에서는 실제 Solar Pro 4 호출이 일어나지 않습니다.
- 실제 판정 결과를 보려면 본인 키가 필요합니다.

### 민감한 정보
- 실제 키는 `.env.local`에만 넣고, `.env.example`이나 커밋에는 넣지 않습니다.
- 키는 GitHub 저장소에 포함되지 않습니다.
- 팀원 공유가 필요한 경우 키는 GitHub가 아닌 별도 채널로 전달하세요.
EOF
echo "README.md 업데이트 완료"