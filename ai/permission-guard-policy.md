# Permission Guard 정책

`.codex/hooks/guard_pre_tool_use.py`는 Logging Hook과 별도의 Codex `PreToolUse` handler다. 이것은 반복되는 명백한 실수를 줄이는 보조 통제이며, Codex 샌드박스·운영체제 권한·사람의 운영 승인 절차를 대체하지 않는다.

## 차단 정책

- `GIT_DESTRUCTIVE`: `git reset --hard`, `git clean -fd`, force push, 광범위한 `checkout`·`restore`
- `RECURSIVE_DELETE`: 저장소·상위·루트·홈·변수 또는 glob 대상 재귀 삭제
- `SECRET_FILE_WRITE`: `.env`, 개인키, 인증서 키, credential 파일 `apply_patch` 수정
- `PRODUCTION_DEPLOY`: production 배포, production Compose 재기동, production 컨테이너 제거
- `DATABASE_DESTRUCTIVE`: 데이터베이스 클라이언트의 `DROP`, `TRUNCATE`, `WHERE` 없는 전체 삭제
- `UNSCOPED_GIT_STAGE`: `git add .`, `git add -A`

차단 응답은 정책 ID만 포함한 짧은 이유를 반환한다. Guard는 승인 문구를 명령 문자열에서 추측하지 않고, bypass 파일·자동 우회·명령 재작성을 제공하지 않는다. 실제로 필요한 차단 작업은 정확한 대상과 의도를 사람이 확인한 뒤 Codex 밖에서 수행한다.

## 셸 토큰 정규화와 한계

Bash 정책은 검사 전에 Bash ANSI-C 인용인 `$'...'`을 실행 없이 해석한 뒤 `shlex.split`으로 유효한 셸 인용을 토큰화한다. 따라서 `git reset --h''ard`와 `git reset --h$'\\x61'rd`처럼 인용으로 쪼갠 옵션도 셸이 전달하는 `--hard` 토큰으로 판정한다. 입력을 실행하거나 명령을 재작성하지는 않는다.

이 방식은 셸 전체를 해석하지 않는다. 변수 확장, 명령 치환, alias·함수, `eval`, 인코딩된 명령처럼 실행 시점에 만들어지는 명령은 보장 범위 밖이다. Guard는 샌드박스, 운영체제 권한, 사람의 승인 절차를 대체하지 않는 보조 통제다.

## Codex CLI 검증

Hook 정의를 변경했으므로 DevChat 원래 저장소에서 Codex CLI를 열고 `/hooks`로 새 `PreToolUse` handler를 검토·신뢰한다. 그 후 다음을 별도 턴에서 요청한다.

1. 안전 사례: `git status --short` 실행 요청. 명령이 실행되고 Guard stdout은 없다.
2. 위험 사례: `git reset --h''ard` 실행 요청. 실행 전 `[GIT_DESTRUCTIVE]` deny가 표시되고 Git 상태는 바뀌지 않는다.
3. `ai/logs/`의 해당 세션 JSONL에서 `PreToolUse` 이벤트를 확인한다. matching command hooks는 병렬 시작하므로 위험 시도도 Logging Hook에 남을 수 있다.

검증 전에 다음 자동 회귀를 실행한다.

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v
```
