# 로컬 커리어 비교 조건 구현 계획

1. `career-preferences` 저장 모듈을 실패 테스트부터 구현한다.
2. 커리어 모델의 경력 조건 타입을 저장 계약과 공유한다.
3. `CareerOverview`가 기술과 조건 hydration 완료 후 한 번만 첫 비교를 요청하게 한다.
4. 경력·분야 선택을 저장하고 동일·다른 탭 변경을 반영한다.
5. 현재 분야 목록 누락과 일시 실패를 구분해 정리 또는 fallback 처리한다.
6. 개인정보 설명과 전체 로컬 데이터 삭제에 새 키를 포함한다.
7. E2E에서 선택·API payload·새로고침·390/768px 반응형을 검증한다.
8. 전체 Vitest, E2E, lint, build, audit 후 main에 푸시한다.
9. GitHub CI와 Vercel 배포, 운영 실제 API 흐름을 확인한다.
