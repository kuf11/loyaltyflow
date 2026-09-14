<!-- token-diet:begin -->
TOKEN-DIET MODE IS ACTIVE. Cut wasted words, never substance, correctness, or required detail.

- Lead with the answer; omit filler; report deltas, not narration.
- Keep docs and handoffs dense but complete; comment the non-obvious why.
- Tests must cover critical money, auth and data-loss paths.
- Code: concise, idiomatic, readable; no dead code; preserve exact identifiers and errors.
- Search before reading; read only relevant files; batch independent calls.
- Run targeted checks while iterating and a final relevant check before publishing.
<!-- token-diet:end -->

# Инструкция для агентов

## Перед любыми правками

1. Прочитать `AGENTS.md` и `README.md`.
2. Прочитать связанные HTML, CSS, JS, backend-файлы и тесты до изменения кода.
3. Работать в актуальной стабильной ветке `backup/pre-glass-redesign-20260915`.
4. Не переносить изменения из `main`: там находится отменённый glass-redesign.
5. Не запрашивать SSH и не писать команду `ssh`: пользователь уже открыт в терминале production-сервера.
6. Не запрашивать и не выводить `.env`, токены, пароли и приватные ключи.

## GitHub

Репозиторий: `kuf11/loyaltyflow`.

После проверки отправлять изменения в:

```text
backup/pre-glass-redesign-20260915
```

В финальном ответе указывать:

- что изменено;
- какие проверки выполнены;
- короткий SHA коммита;
- точную команду обновления production.

## Обновление production-сервера

Production-каталог:

```text
/opt/loyaltyflow
```

### 1. Сначала проверить локальные изменения

```bash
cd /opt/loyaltyflow
git status -sb
```

Если есть важные незакоммиченные изменения, не удалять их молча. Сначала сохранить патч:

```bash
git diff > /root/loyaltyflow-local-$(date +%Y%m%d-%H%M%S).patch
```

### 2. Статический frontend или документация

Для изменений в корневых `*.html`, `*.css`, браузерных `*.js`, изображениях и Markdown:

```bash
cd /opt/loyaltyflow
git fetch origin backup/pre-glass-redesign-20260915
git reset --hard FETCH_HEAD
git log -1 --oneline
```

Docker не пересобирать. Если менялся Telegram Mini App, попросить полностью закрыть его в Telegram и открыть заново. Для кабинета — `Ctrl + Shift + R`.

### 3. Backend, зависимости или Docker

Для изменений в `api/`, `api/package.json`, `api/Dockerfile`, `docker-compose.yml` или `deploy/`:

```bash
cd /opt/loyaltyflow
git fetch origin backup/pre-glass-redesign-20260915
git reset --hard FETCH_HEAD
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3100/api/health
```

Если health-check завершился ошибкой, запросить:

```bash
docker compose logs --tail=200
```

Не выполнять миграции с потерей данных, `git clean`, удаление volume или базы без явного подтверждения пользователя.

## Особенности архитектуры

- Карта файлов и подсистем находится в `README.md`.
- `miniapp.html` загружает несколько поколений runtime-скриптов. Порядок критичен.
- `miniapp-stock-fix-v2.js` должен идти после основных Mini App-скриптов.
- `miniapp-search-ui-fix.js` должен загружаться последним.
- Не возвращать `prompt()`, `alert()` и нативные окна в интерфейс рассылок.
- Расписание рассылок работает по Москве (`Europe/Moscow`, UTC+03:00).
- Оплата намеренно отключена в `api/security-preload.js` до подключения проверенной платёжной системы.

## Проверки

Для изменённых браузерных JS:

```bash
node --check путь/к/файлу.js
```

Для backend:

```bash
cd /opt/loyaltyflow/api
npm test
npm run check
```

Для UI проверить desktop и mobile, кликабельность, переполнение, скролл и отсутствие ошибок консоли. Для Mini App отдельно проверить запуск внутри Telegram, поиск, остатки, корзину и регистрацию.
