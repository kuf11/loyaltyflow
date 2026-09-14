<!-- token-diet:begin -->
TOKEN-DIET MODE IS ACTIVE. Cut wasted words, never substance, correctness, or required detail.

- Lead with the answer; omit filler and request restatement; report deltas, not narration.
- Keep docs, plans, comments, and handoffs dense but complete; comment the non-obvious why.
- Tests: cover key and critical edge paths; never skip money/auth/data-loss coverage.
- Code: YAGNI; concise, idiomatic, readable; no dead code; preserve exact identifiers, commands, and errors.
- Context: search before reading; read only relevant ranges; batch independent calls; reuse current context; minimize turns; stop when there is enough evidence to act.
- Verification: targeted checks while iterating, full suite once at the end.
- Sub-agents: delegate bounded exploration cheaply; retain correctness-sensitive verification.

Concision applies to output, never to reasoning needed for correctness. Claude-specific full rules: .claude/skills/token-diet/SKILL.md.
<!-- token-diet:end -->

## Обновление production-сервера

Сервер уже открыт пользователем в терминале и находится в `/opt/loyaltyflow`. Не добавлять команду `ssh` и не запрашивать SSH-доступ. После успешной отправки проверенных правок в ветку `main` всегда дать пользователю подходящую команду обновления.

### Только статический frontend или документация

Для изменений в `*.html`, `*.css`, браузерных `*.js`, изображениях и Markdown:

```bash
cd /opt/loyaltyflow && git pull --ff-only
```

Docker не пересобирать. Попросить полностью закрыть и заново открыть Telegram Mini App, если изменялся его frontend.

### Backend, зависимости или Docker

Для изменений в `api/`, `api/package.json`, `api/Dockerfile` или `docker-compose.yml`:

```bash
cd /opt/loyaltyflow && git pull --ff-only && docker compose up -d --build
```

Затем проверить:

```bash
docker compose ps && curl -fsS http://127.0.0.1:3100/api/health
```

### Правила безопасности обновления

- Перед отправкой изменений прочитать `AGENTS.md`, связанные файлы и тесты.
- Не запускать `git reset --hard`, `git clean`, удаление данных или миграции с потерей данных без явного подтверждения пользователя.
- Если `git pull --ff-only` сообщает о расхождении веток или конфликте, остановиться и запросить вывод `git status -sb` и `git log --oneline --decorate -8`; не советовать `rebase --skip`.
- Production-сервер должен оставаться на ветке `main`, отслеживающей `origin/main`.
- Не показывать и не запрашивать содержимое `.env`, токены, пароли или приватные ключи.
- В финальном сообщении перечислить изменённые области, проверки, короткий SHA последнего коммита и точную команду обновления сервера.
