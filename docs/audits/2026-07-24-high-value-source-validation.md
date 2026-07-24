# 우선순위 기업 공식 채용 소스 검증 기록

검증 시각: 2026-07-24 21:43 KST

검증 원칙: 기업이 직접 운영하거나 공식 채용 서비스로 연결한 공개 엔드포인트만
확인했다. 아래 공고 수는 검증 순간의 관찰값이며 앞으로 유지된다는 뜻이 아니다.
응답 본문과 지원자 개인정보는 저장하지 않고, 성공 여부·배열 구조·기업 식별값만
확인했다.

## 채택한 소스

### SK AX

- 회사 홈페이지: <https://www.skax.co.kr>
- 공식 채용 서비스: <https://www.skcareers.com/>
- 목록 엔드포인트: `POST https://www.skcareers.com/Recruit/GetRecruitList#sk-ax`
- 요청 형식: `application/json` (`application/x-www-form-urlencoded` 응답도 같은
  계약임을 별도로 확인)
- 요청 본문:

```text
sort=2
searchText=
corpCode=10018
jobRole=0
recruitType=
workingType=
workingRegion=
```

- 기업 식별 경계: SK Careers의 `corpCode=10018`. 카탈로그 URL의 `#sk-ax`
  조각은 같은 공식 엔드포인트를 쓰는 다른 SK 계열사 소스와 저장 키를 분리한다.
- 응답 계약: 최상위 `success`, `list`, `totalCount`; 검증 당시 `success=true`이고
  `list`는 배열이었다.
- 관찰값: 2건. 데이터센터 기계·공조설비 1건과 AX 사업개발 영업 1건이었으며,
  둘 다 시설·영업 전용 공고이므로 기술 공고 필터에서 제외하는 것이 맞다.
- 결정: 채택. 회사별 공식 목록을 수집한 뒤 소프트웨어·데이터·보안·기술
  인프라처럼 명시적인 기술 직무만 반영한다.

### kt cloud

- 회사 홈페이지: <https://www.ktcloud.com>
- 공식 채용 서비스: <https://recruit.kt.com/>
- 목록 엔드포인트:
  `GET https://recruit.kt.com/api/recruit?isPost=1&isInprogress=1&isContainsContents=0#kt-cloud`
- 요청 본문: 없음
- 기업 식별 경계: 각 행의 `company` 값을 공백과 대소문자 차이를 정규화한 뒤
  정확히 `kt cloud`인 행만 허용한다. 기존 `kt` 소스는 정확히 `KT`인 행만
  허용해 KT그룹 계열사 공고가 섞이지 않게 한다.
- 응답 계약: 최상위 `data`, `errorMessage`, `isSuccess`; 검증 당시
  `isSuccess=true`이고 `data`는 배열이었다.
- 관찰값: 전체 KT그룹 43건 중 `kt cloud` 4건. 네 건 모두 데이터센터
  시공관리·전기·기계 공고라 기술 공고 예상값은 0건이었다.
- 결정: 채택. 빈 기술 결과도 정상 수집으로 기록하며, 시공·전기·기계·BIM·안전
  직무는 강한 소프트웨어·데이터·보안 신호가 함께 있을 때만 허용한다.

### LIG넥스원

- 회사 홈페이지: <https://www.lignex1.com>
- 공식 채용 서비스: <https://ligdna.recruiter.co.kr/app/jobnotice/list>
- 목록 엔드포인트:
  `POST https://ligdna.recruiter.co.kr/app/jobnotice/list.json`
- 요청 형식: `application/x-www-form-urlencoded`
- 요청 본문:

```text
recruitClassSn=
recruitClassName=
jobnoticeStateCode=10
pageSize=100
searchByNameOnly=true
currentPage=1
```

- 기업 식별 경계: 공식 `ligdna.recruiter.co.kr` 호스트와 목록·상세 응답의
  `jobnoticeSn`, `systemKindCode`를 사용한다.
- 응답 계약: 최상위 `list`, `pageUtil`; 검증 당시 `list`는 배열이었고
  `pageUtil`은 `currentPage=1`, `lastPage=1`, `recordCount=10`인 완전한 한
  페이지를 보고했다.
- 관찰값: 10건 중 제목에 SW·AI·사이버보안을 명시한
  `LIG D&A SW(AI/사이버보안) 상시채용` 1건이 기술 필터 대상이었다. 인재DB,
  소방안전관리, 포괄적인 기술직 공고는 제외한다.
- 결정: 채택. 제목만으로 기술 범위를 확인할 수 있는 공고만 반영하고 인재DB는
  별도로 제외한다.

## 보류한 후보

### 롯데이노베이트

- 공식 확인 위치: <https://recruit.lotte.co.kr/>
- 2026-07-24 확인 시 롯데그룹 공식 채용 상세에는 롯데이노베이트 공고가 있었지만,
  현재 공고만 완전하게 가져오고 계열사를 안정적으로 고정할 수 있는 공개 목록
  계약을 검증하지 못했다.
- 결정: 안정적인 공식 목록 피드와 계열사 필터를 재현할 수 있을 때까지 보류한다.

### 한국신용데이터

- 공식 확인 위치: <https://www.kcd.co.kr/recruit/>
- 2026-07-24 확인 시 공식 채용 화면은 `검색 결과가 없어요` 상태였고, 빈 결과와
  장애를 구분할 수 있는 안정적인 공개 채용 피드를 확인하지 못했다.
- 결정: 공개 목록 계약이 확인될 때까지 보류한다. 제3자 채용 사이트로 대체하지
  않는다.
