# Translate Action

마인디 앱의 번역을 책임지는 액션입니다. 기본적으로 flutter easy_localization 의
번역 파일을 번역하도록 설계되어 있으므로 범용적인 구조가 아닐 수 있습니다.

## 기능

- OpenAI의 GPT 모델을 사용하여 JSON/YAML 번역 파일을 자동으로 생성
- 소스 언어 파일의 변경사항을 감지하여 타겟 언어 파일 업데이트
- Git 커밋 및 푸시 자동화
- JSON과 YAML 형식 모두 지원

## 사용법

워크플로우 파일에 다음과 같이 설정하세요:

```yaml
name: Test Translation Action

permissions:
  contents: write

on:
  pull_request:
    branches: [main]

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      # 번역 액션 실행
      - name: Run translation action
        uses: mindylog/translate-action@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_HEAD_REF: ${{ github.head_ref }}
        with:
          translations-dir: 'test/translations'
          source-lang: 'ko'
          target-lang: 'en'
          file-format: 'json'
          model: 'gpt-4o'
          git-user-name: 'github-actions[bot]'
          git-user-email: 'github-actions[bot]@users.noreply.github.com'
          temperature: 0.7
          max-tokens: 2000
```

만약 복수개의 locale에 대해 번역을 진행하고 싶다면 다음과 같이 설정하세요:

```yaml
name: Test Translation Action

permissions:
  contents: write

on:
  pull_request:
    branches: [main]

jobs:
  translate:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        locale: [ko, en, ja]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      # 번역 액션 실행
      - name: Run translation action
        uses: mindylog/translate-action@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_HEAD_REF: ${{ github.head_ref }}
        with:
          translations-dir: 'test/translations'
          source-lang: 'ko'
          target-lang: ${{ matrix.locale }}
          file-format: 'json'
          model: 'gpt-4o'
          git-user-name: 'github-actions[bot]'
          git-user-email: 'github-actions[bot]@users.noreply.github.com'
          temperature: 0.7
          max-tokens: 2000
```

## 입력 파라미터

| 파라미터         | 필수 | 설명                             | 기본값 |
| ---------------- | ---- | -------------------------------- | ------ |
| translations-dir | ✅   | 번역 파일이 위치한 디렉토리 경로 | -      |
| source-lang      | ✅   | 소스 언어 코드 (예: ko, en, ja)  | -      |
| target-lang      | ✅   | 타겟 언어 코드 (예: ko, en, ja)  | -      |
| file-format      | ❌   | 파일 형식 (json 또는 yaml)       | json   |
| model            | ❌   | 사용할 OpenAI 모델               | gpt-4  |
| git-user-name    | ❌   | 커밋에 사용할 Git 사용자 이름    | GitHub Action |
| git-user-email   | ❌   | 커밋에 사용할 Git 이메일         | action@github.com |
| temperature      | ❌   | GPT 모델의 temperature 값        | 0.5    |
| max-tokens       | ❌   | GPT 모델의 최대 토큰 수          | 1000   |
| system-message   | ❌   | GPT 모델에 전달할 시스템 메시지  | -      |

## 환경 변수 설정

이 액션을 사용하기 위해서는 다음 환경 변수가 필요합니다:

- `OPENAI_API_KEY`: OpenAI API 키
- `GITHUB_TOKEN`: GitHub 토큰 (자동으로 제공됨)

## 주의사항

1. **Checkout Depth 설정**

   - `actions/checkout` 단계에서 반드시 `fetch-depth: 2`로 설정해야 합니다.
   - 이는 이전 커밋의 번역 파일 내용을 비교하기 위해 필요합니다.

   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 2
   ```

2. **권한 설정**

   - 워크플로우에 `permissions: contents: write` 설정이 필요합니다.
   - 이는 번역된 파일을 커밋하고 푸시하기 위해 필요합니다.

3. **파일 구조**

   - 번역 파일은 JSON 또는 YAML 형식을 지원합니다.
   - 파일명은 언어 코드와 확장자를 사용해야 합니다 (예: ko.json, en.json 또는 ko.yml, en.yml).
   - `file-format` 파라미터로 원하는 형식을 지정할 수 있습니다.

4. **API 키 보안**
   - OpenAI API 키는 반드시 GitHub Secrets에 저장하여 사용하세요.
   - 절대로 워크플로우 파일에 직접 API 키를 입력하지 마세요.

## 예제

### JSON 형식

`test/translations` 디렉토리의 구조:

```
test/translations/
├── ko.json # 소스 언어 파일 (한국어)
└── en.json # 타겟 언어 파일 (영어)
```

```json
{
  "common": {
    "hello": "안녕하세요",
    "welcome": "환영합니다"
  }
}
```

### YAML 형식

`test/translations` 디렉토리의 구조:

```
test/translations/
├── ko.yml # 소스 언어 파일 (한국어)
└── en.yml # 타겟 언어 파일 (영어)
```

```yaml
common:
  hello: "안녕하세요"
  welcome: "환영합니다"
```

YAML 형식을 사용하려면 `file-format: 'yaml'` 파라미터를 추가하세요:

```yaml
- name: Run translation action
  uses: mindylog/translate-action@main
  with:
    translations-dir: 'test/translations'
    source-lang: 'ko'
    target-lang: 'en'
    file-format: 'yaml'
    # ... 기타 설정
```
