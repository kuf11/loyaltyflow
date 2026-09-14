# Аудит безопасности LoyaltyFlow — 2026-09-15

## Назначение документа

Этот файл — передача контекста следующему агенту. Он описывает обнаруженные уязвимости, ошибки форм, возможные пути злоупотребления, приоритет исправлений и обязательные проверки.

**Проверенная ветка:** `backup/pre-glass-redesign-20260915`  
**Проверенный коммит:** `db708c71bc5978185de33160625de05ef8368cde`  
**Тип проверки:** статический анализ исходного кода. Активный destructive pentest production, массовая отправка форм, подбор кодов и создание реальных аккаунтов не выполнялись.

## Краткий итог

Проект использует параметризованные SQL-запросы, `scrypt`, AES-256-GCM, HMAC-проверку Telegram `initData`, Turnstile на сервере и Bearer-аутентификацию. Очевидной SQL-инъекции в проверенных маршрутах не найдено.

При этом обнаружены критические риски:

1. Stored XSS через поля регистрации в странице одобрения заявок.
2. Тестовая CAPTCHA и автоподстановка кода `000000` подключены на production-странице регистрации.
3. Опасный email суперадминистратора задан по умолчанию.
4. CSP отключена, а токены хранятся в `localStorage`.
5. Production-скрипты развёртывания возвращают проект на неправильную ветку `main`.
6. Серверная проверка и атомарное списание остатков отсутствуют.
7. Планировщик рассылок может повторно отправить одно задание.
8. Frontend и Docker-версия API редактирования рассылок рассинхронизированы.

---

# Критические проблемы

## SEC-001 — Stored XSS через форму регистрации и страницу одобрений

**Severity:** Critical  
**Файлы:** `admin-approvals.html`, `api/server.js`

Регистрация сохраняет `fullName`, `company`, `city`, `email` и `phone` в базе. Страница `admin-approvals.html` получает эти поля и вставляет их в `list.innerHTML` без escaping:

```js
list.innerHTML=x.users.map(u=>'<div>...'+u.full_name+' ... '+u.company+' ... '+u.email+' ...</div>').join('')
```

Злоумышленник может отправить HTML в одном из текстовых полей регистрации. Когда администратор откроет список заявок, payload выполнится в origin LoyaltyFlow. В этот момент на странице находится поле `#key` с административным ключом.

Безопасный демонстрационный payload для локальной проверки:

```html
<img src=x onerror="document.body.dataset.xss='confirmed'">
```

Не использовать payload с отправкой данных наружу.

**Возможные последствия:**

- чтение `key.value` после ввода администратором;
- выполнение запросов approve от имени администратора;
- доступ к `localStorage` того же origin;
- изменение интерфейса и фишинг администратора;
- захват кабинета, если в origin уже находится Bearer-токен.

**Исправление:**

- полностью отказаться от HTML-конкатенации для пользовательских данных;
- строить элементы через `document.createElement` и заполнять `textContent`;
- как минимум применять общий `escapeHtml` ко всем полям;
- добавить серверные ограничения длины и формата;
- после исправления протестировать все поля регистрации XSS-payload;
- административный ключ лучше заменить обычной сессией суперадминистратора.

## SEC-002 — Тестовая CAPTCHA подключена на production-странице

**Severity:** Critical при включённых dev-флагах; High как ошибка конфигурации  
**Файлы:** `register.html`, `test-captcha.js`, `test-email-code.js`, `api/registration-security.js`, `api/test-mode-setup.js`

`register.html` всегда загружает:

```html
<script src="/test-captcha.js"></script>
<script src="/test-email-code.js"></script>
```

`test-captcha.js` создаёт поддельный `window.turnstile` и выдаёт фиксированный токен:

```text
test-human-confirmed
```

`test-email-code.js` автоматически вводит код:

```text
000000
```

На сервере обход активируется переменными:

```text
ALLOW_DEV_CAPTCHA=true
ALLOW_DEV_EMAIL_CODE=true
```

`test-mode-setup.js` при `ALLOW_DEV_EMAIL_CODE=true` создаёт триггер PostgreSQL, который заменяет любой verification code на `000000`.

Если dev-флаги случайно включены на production, CAPTCHA и подтверждение email полностью обходятся. Если dev-флаги выключены, страница всё равно не загружает официальный Cloudflare Turnstile и регистрация может не работать.

**Исправление:**

- удалить тестовые скрипты из production HTML;
- загружать официальный Turnstile script с Cloudflare;
- тестовый режим разрешать только при `NODE_ENV !== 'production'`;
- завершать запуск API с ошибкой, если dev-флаги включены вместе с production domain;
- удалить/запретить DB trigger с фиксированным кодом на production;
- добавить startup log без секретов, показывающий, что dev-режим выключен.

## SEC-003 — Опасный суперадминистратор по умолчанию

**Severity:** Critical  
**Файл:** `docker-compose.yml`

Текущее значение:

```yaml
PLATFORM_ADMIN_EMAILS: ${PLATFORM_ADMIN_EMAILS:-kuf454647@gmail.com}
```

Если переменная окружения отсутствует, указанный адрес получает platform-доступ. Адрес отличается от известного адреса владельца проекта.

**Возможные последствия:** заморозка, удаление пользователей, сброс паролей и управление тарифами.

**Исправление:**

```yaml
PLATFORM_ADMIN_EMAILS: ${PLATFORM_ADMIN_EMAILS:?PLATFORM_ADMIN_EMAILS is required}
```

Также:

- проверять переменную при старте;
- не хранить персональный email как fallback в репозитории;
- проверить фактическое значение на сервере, не выводя остальные секреты;
- добавить аудит действий platform admin.

---

# Высокий риск

## SEC-004 — CSP отключена, сессионный токен доступен JavaScript

**Severity:** High  
**Файлы:** `api/server.js`, `api/admin-broadcast-server.js`, `deploy/production.sh`, frontend JS

Оба Express-приложения используют:

```js
helmet({contentSecurityPolicy:false})
```

Production Nginx не устанавливает полноценную `Content-Security-Policy`. Bearer-токен хранится в `localStorage` под ключом `LF_TOKEN`.

При любом XSS токен можно прочитать и использовать до истечения срока действия.

**Дополнительный риск:** внешние скрипты `jsdelivr` и `cdnjs` загружаются без Subresource Integrity. Excel parser выполняется в origin кабинета и обрабатывает недоверенные файлы.

**Исправление:**

- ввести CSP с nonce или вынести inline scripts;
- минимум: `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'`;
- отдельно разрешить только необходимые Telegram, Cloudflare, jsdelivr/cdnjs endpoints;
- добавить SRI или хранить pinned библиотеки локально;
- рассмотреть HttpOnly Secure SameSite cookie вместо `localStorage`;
- добавить `Strict-Transport-Security`, `Permissions-Policy`, `X-Content-Type-Options`, `Referrer-Policy`.

## SEC-005 — Несогласованные production-скрипты

**Severity:** High operational/security  
**Файлы:** `deploy/production.sh`, `deploy/bootstrap.sh`

Оба скрипта выполняют reset на `origin/main`, хотя текущая production-ветка:

```text
backup/pre-glass-redesign-20260915
```

Это может вернуть отменённый код, убрать исправления безопасности и создать непредсказуемую смесь frontend/backend.

**Исправление:** использовать одну переменную `DEPLOY_BRANCH`, по умолчанию равную стабильной ветке, и сверять SHA после deploy.

## SEC-006 — Секрет синхронизации передаётся в URL

**Severity:** High  
**Файл:** `api/server.js`

Маршрут:

```text
POST /api/v1/sync/:secret
```

Секрет попадает в access logs, reverse proxy logs, APM и shell history.

**Исправление:** передавать секрет в заголовке `Authorization` или `X-Sync-Secret`, сравнивать через `timingSafeEqual`, ротировать текущий секрет после миграции.

## SEC-007 — Нет серверного контроля остатков

**Severity:** High; Critical перед включением оплаты  
**Файл:** `api/loyalty.js`

`/api/v1/public/:tenant/loyalty/purchase` проверяет наличие product id, но не сравнивает quantity с `stock` и не уменьшает stock атомарно. Клиентское ограничение обходится прямым HTTP-запросом.

**Исправление:**

- хранить остатки в отдельной таблице, не только в JSON;
- транзакция + `SELECT ... FOR UPDATE`;
- проверить все quantities;
- выполнить условное уменьшение `stock >= requested`;
- отклонять всю покупку при недостаточном остатке;
- добавить idempotency key заказа;
- не включать оплату до исправления.

## SEC-008 — Возможна двойная отправка рассылки

**Severity:** High  
**Файл:** `api/broadcast-scheduler.js`

`FOR UPDATE SKIP LOCKED` выполняется без явной транзакции. В autocommit блокировка снимается сразу после SELECT. Два процесса или пересекающихся запуска могут получить одну задачу.

**Исправление:** атомарно забирать задачу в транзакции, менять статус на `processing`, фиксировать lease/locked_at, затем отправлять. Добавить idempotency и recovery зависших задач.

## SEC-009 — Frontend и Docker backend рассылок расходятся

**Severity:** High bug/integrity  
**Файлы:** `broadcast-edit-fix-v2.js`, `api/schedule-api-preload.js`, `api/admin-broadcast-server.js`, корневой `schedule-api-preload.js`

Frontend вызывает endpoint редактирования scheduled broadcast. Docker копирует `api/schedule-api-preload.js`, где нужный маршрут отсутствует или неполон. History endpoint `admin-broadcast-server.js` также не возвращает все schedule-поля.

**Исправление:** оставить один канонический файл в `api/`, удалить дубликат из корня, покрыть integration tests create/edit/history/run.

---

# Проверка форм и злоупотреблений

## Регистрация

**Файлы:** `register.html`, `auth-page.js`, `api/server.js`

### Найдено

- Клиент проверяет email, возраст 14–100 и телефон, но сервер не повторяет все проверки.
- Сервер проверяет только наличие полей, возраст `<14` и пароль.
- Нет строгой проверки email, phone, максимального возраста и допустимых символов.
- `fullName`, `company`, `city`, `phone` становятся источником stored XSS в `admin-approvals.html`.
- Ответ `409 Email уже зарегистрирован` позволяет перечислять зарегистрированные email.
- Нет ограничения количества заявок на один email/телефон кроме IP rate limit.
- CAPTCHA и email verification имеют опасный тестовый режим, описанный в SEC-002.

### Возможные атаки

- stored XSS через поля анкеты;
- регистрационный спам с распределённых IP;
- email enumeration;
- мусорные/очень большие числовые значения возраста прямым API-запросом;
- обход клиентской проверки телефона;
- полная автоматическая регистрация при включённых dev-флагах.

### Исправление

Создать серверную schema validation:

- `fullName`: 2–120, нормализованные пробелы;
- `company`: 2–120;
- `age`: integer 14–100;
- `city`: 2–80;
- `email`: нормализовать и проверить библиотекой;
- `phone`: E.164;
- password: ограничить максимальную длину, например 128–256 символов, чтобы снизить CPU DoS на `scrypt`;
- одинаковый внешний ответ для существующего и нового email, если допустимо продуктом;
- rate limit по IP + email + device signal.

## Подтверждение email

**Маршрут:** `/api/v1/auth/verify`

### Найдено

- Код действует 15 минут и удаляется после успешной проверки — хорошо.
- Есть общий auth rate limit — хорошо.
- Нет счётчика попыток конкретного кода/аккаунта.
- Код хранится как обычный SHA-256 шестизначного числа без server-side pepper. При утечке БД его легко перебрать офлайн.
- Нет endpoint безопасной повторной отправки с cooldown.

### Исправление

- HMAC кода с отдельным secret/pepper;
- attempts counter, блокировка после 5 попыток;
- one-time nonce;
- resend cooldown и инвалидирование старого кода.

## Вход

**Файлы:** `login.html`, `auth-page.js`, `api/server.js`

### Найдено

- Ответ для неправильного email/пароля общий — хорошо.
- Rate limit 20 запросов за 15 минут — хорошо.
- Нет rate limit по аккаунту; распределённый brute force остаётся возможным.
- Нет MFA для platform admin.
- Токен нельзя принудительно отозвать после сброса пароля; он живёт до `exp`.
- Токен хранится в `localStorage`.

### Исправление

- account-level throttle/backoff;
- session version в БД и отзыв токенов;
- MFA/WebAuthn для platform admin;
- безопасная cookie-session.

## Вывод сообщений авторизации

**Файлы:** `auth-app.js`, `auth-page.js`

Оба файла используют `innerHTML` для сообщений сервера. Сейчас большинство серверных ошибок фиксированы, но сам sink небезопасен и превращает любую будущую отражённую ошибку в XSS.

**Исправление:** `textContent`; для форматированных сообщений создавать DOM-узлы вручную.

## Одобрение заявок

**Файл:** `admin-approvals.html`

Кроме critical stored XSS:

- административный ключ хранится в DOM input;
- нет отдельного rate limit для admin-key маршрутов;
- сравнение ключа обычной строкой;
- используется `alert()`;
- нет журнала кто и когда одобрил заявку.

Перевести страницу на platform-admin session и удалить X-Admin-Key из браузерного UI.

## Настройка Mini App

**Маршрут:** `/api/v1/owner/miniapp`

### Найдено

- Принимается произвольный `design` без JSON schema.
- Нет строгих ограничений количества товаров, строк, цветов и URL.
- Можно отправить отрицательные цены, отрицательные остатки, `NaN`-подобные строки и огромные значения прямым запросом.
- Product image URL не ограничен HTTPS; возможны tracking pixels и нежелательные внешние источники.
- Bot token проверяется только через фиксированный Telegram endpoint; SSRF здесь не обнаружен.

### Исправление

Whitelist всех полей, строгие типы/лимиты, HTTPS для изображений, лимит товаров, нормализация чисел, запрет неизвестных ключей.

## Excel-импорт каталога

**Файлы:** `catalog-admin.html`, `catalog-admin.js`

### Найдено

- Размер файла проверяется до парсинга — хорошо.
- Лимит строк проверяется после распаковки XLSX. Небольшой compressed zip-bomb может потребить много памяти до проверки строк.
- XLSX parser загружается с внешнего CDN без SRI.
- Импорт выполняется в том же origin, где хранится `LF_TOKEN`.
- После импорта сервер всё равно не валидирует массив products.
- Формулы Excel при импорте читаются как значения; при будущем экспорте пользовательские строки, начинающиеся с `=`, `+`, `-`, `@`, могут создать formula injection при открытии файла в Excel.

### Исправление

- парсить на изолированном worker или сервере с лимитами CPU/memory;
- pin + self-host проверенной библиотеки;
- перед экспортом экранировать formula-leading cells апострофом;
- серверная schema validation;
- ограничить worksheet count, range и uncompressed size.

## Рассылки

**Файлы:** `broadcasts.js`, `broadcast-edit-fix-v2.js`, backend broadcast files

### Найдено

- Backend sanitizes Telegram HTML через whitelist — хорошо.
- URL кнопки ограничивается протоколами для немедленной отправки и HTTPS для scheduled — хорошо, но правила расходятся.
- Предпросмотр использует `editor.innerHTML`; это self-XSS surface.
- `addLink` всё ещё использует `prompt()` и принимает произвольную схему до отправки.
- Отправка all segment не ограничивает число получателей на сервере.
- Один HTTP request может долго отправлять сообщения последовательно.
- Нет idempotency key, поэтому повтор POST может повторить рассылку.

### Исправление

Единый sanitizer/URL validator, отдельная очередь, idempotency key, server-side recipient cap/batch, normal modal вместо prompt.

## Управление клиентом

**Файлы:** `clients-dashboard.js`, `api/loyalty.js`

### Найдено

- Данные клиента экранируются — хорошо.
- SQL параметризован и owner isolation присутствует — хорошо.
- Amount не имеет разумного максимума. Очень большие числа могут вызвать DB overflow/ошибки.
- Нет audit log администратора для начислений, списаний и блокировки.
- Нет idempotency key: двойной клик/повтор запроса может дважды изменить баланс.

### Исправление

Максимальная сумма операции, idempotency key, обязательная причина, audit log, подтверждение крупных списаний.

## Platform admin

**Файлы:** `platform-admin.js`, `api/admin-broadcast-server.js`

### Найдено

- Поля пользователей в интерфейсе экранируются — хорошо.
- Сервер повторно проверяет platform email — хорошо.
- Права зависят только от email из env.
- Нет MFA, audit log и повторного подтверждения destructive actions.
- Reset password возвращает временный пароль в браузер; он может попасть в clipboard history/скриншоты.
- Старые сессии пользователя после reset password не отзываются.

### Исправление

MFA, role table вместо env email, audit log, re-auth для delete/reset, одноразовая reset-ссылка, session revocation.

---

# Инфраструктура и заголовки

`deploy/production.sh` устанавливает только часть заголовков. Добавить:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options SAMEORIGIN always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

CSP должна учитывать Telegram Mini App, Turnstile и реально необходимые CDN. Не копировать пример без проверки, иначе можно сломать приложение.

Express находится за Nginx, но `trust proxy` явно не настроен. Проверить фактическое поведение `express-rate-limit`: неверная настройка может считать всех пользователей одним IP либо неправильно доверять forwarded headers.

Порты PostgreSQL не опубликованы наружу — хорошо. API/admin API слушают localhost на хосте — хорошо.

---

# Что не обнаружено в статическом анализе

- очевидная SQL injection;
- command injection из пользовательских полей;
- произвольный SSRF через product image URL на backend;
- небезопасное хранение паролей в открытом виде;
- подделка Telegram `initData` без bot token;
- CSRF через cookie, поскольку текущая авторизация Bearer-based.

Это не доказывает отсутствие уязвимостей. Нужны dependency audit, DAST и проверка реальной конфигурации production.

---

# План исправления

## P0 — до публичного запуска

- [ ] Исправить stored XSS в `admin-approvals.html`.
- [ ] Удалить production-подключение `test-captcha.js` и `test-email-code.js`.
- [ ] Запретить dev auth flags в production.
- [ ] Удалить fallback platform-admin email.
- [ ] Исправить deploy branch.
- [ ] Ввести минимальную CSP и безопасные security headers.

## P1 — до включения оплаты и массовых рассылок

- [ ] Серверная schema validation всех форм.
- [ ] Атомарный stock decrement + idempotency purchase.
- [ ] Транзакционное получение scheduled jobs.
- [ ] Синхронизировать broadcast edit API.
- [ ] Перенести sync secret из URL.
- [ ] Idempotency для балансных операций и рассылок.

## P2

- [ ] Cookie session/session revocation.
- [ ] MFA и audit log platform admin.
- [ ] Self-host/SRI third-party libraries.
- [ ] Изолированный XLSX parser и защита от formula injection.
- [ ] Dedicated rate limits по маршрутам и аккаунтам.

---

# Обязательные проверки после исправлений

## Код

```bash
cd api
npm test
npm run check
```

```bash
node --check auth-page.js
node --check catalog-admin.js
node --check broadcasts.js
node --check clients-dashboard.js
node --check platform-admin.js
```

## Безопасные локальные сценарии

1. Все registration text fields с HTML должны отображаться как обычный текст в approvals.
2. Production registration page не должна содержать `test-captcha.js` и `test-email-code.js`.
3. API должен отказываться стартовать с production URL и любым `ALLOW_DEV_*=true`.
4. Невалидные email, age 13/101, невалидный E.164 phone должны возвращать 400.
5. Design с отрицательной ценой/остатком и неизвестными ключами должен возвращать 400.
6. Повтор purchase с одинаковым idempotency key не должен повторно списывать stock.
7. Два scheduler процесса не должны отправить одну job дважды.
8. После password reset старый session token должен стать недействительным.
9. Проверить CSP в DevTools без ошибок, не добавляя `unsafe-inline`/`unsafe-eval` без обоснования.
10. Проверить, что production SHA совпадает с веткой `backup/pre-glass-redesign-20260915`.

## Dynamic audit

После P0 провести отдельный авторизованный тест на staging:

- OWASP ZAP baseline;
- XSS во всех формах и query parameters;
- brute-force/rate-limit тесты с безопасными лимитами;
- IDOR между двумя тестовыми владельцами;
- race tests purchase/scheduler/balance adjustment;
- malicious XLSX corpus;
- проверка security headers и TLS.

Не проводить destructive DAST на production без резервной копии, staging и согласованных лимитов.
