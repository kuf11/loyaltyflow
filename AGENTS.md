<!-- token-diet:begin -->
TOKEN-DIET MODE IS ACTIVE. Cut wasted words, never substance, correctness, or required detail.
- Lead with the answer; report deltas, not narration.
- Keep handoffs dense and complete.
- Tests must cover auth, money, data loss and mobile layout.
- No dead code or guessed file ownership.
<!-- token-diet:end -->

# LoyaltyFlow: обязательные инструкции для агентов

## 1. Источник истины

- Репозиторий: `kuf11/loyaltyflow`.
- Единственная production-ветка: `backup/pre-glass-redesign-20260915`.
- `main` содержит отменённый glass-redesign. Не merge, не cherry-pick и не `git pull main`.
- Production-каталог: `/opt/loyaltyflow`.
- Публичный хост: `https://loyaltyflow.ru`.
- Пользователь уже работает в терминале сервера: не просить SSH и не писать команду `ssh`.
- Не запрашивать и не выводить `.env`, токены, пароли, API-ключи и приватные ключи.

Перед изменением прочитать `AGENTS.md`, `README.md`, затем точку входа и все реально подключённые к ней CSS/JS/backend-файлы. Не считать файл актуальным только по названию.

## 2. Как определить актуальные файлы

### Главная и авторизация

- `auth.html` — публичная главная со встроенными регистрацией и входом.
- `auth-v2.css` — стили главной.
- `auth-app.js` — регистрация/вход на главной, Turnstile, выбор страны и нормализация телефона.
- `auth-actions.js` — переходы с CTA главной на отдельные страницы.
- `register.html` + `register-page.js` — отдельная регистрация.
- `login.html` + `auth-page.js` — отдельный вход.
- `auth-pages.css` — общая раскладка отдельных auth-страниц.
- `registration-ui-fixes.css` — единый внешний вид списка стран и телефонной маски.
- `auth-runtime-fixes.css` — мобильные исправления CAPTCHA и auth-форм.

Обе формы регистрации используют `intl-tel-input@29.2.3`. Main и standalone должны сохранять одинаковые флаг, код страны, поиск, форматирование и проверку номера. CAPTCHA actions: `register` и `login`; не менять их без одновременной серверной правки.

### Кабинет владельца

- `index.html` — точка входа кабинета.
- `admin.js` — загрузка профиля, навигация, Mini App и предпросмотр.
- `admin.css`, `ui-fixes.css` — стили.
- `admin-save-fix.js` — актуальные исправления сохранения и статуса запуска.
- `clients-dashboard.js` — клиенты.
- `catalog-admin.html`, `catalog-admin.js` — каталог и Excel.
- `analytics.html`, `analytics-dashboard.js`, `loyalty-analytics.js` — аналитика.
- `loyalty-admin.html`, `loyalty-admin.js` — правила лояльности.
- `broadcasts.html`, `broadcasts.js`, `broadcast-default-link.js`, `broadcast-edit-fix-v2.js` — рассылки.
- `platform-admin.html`, `platform-admin.js` — платформенное администрирование.

### Telegram Mini App

Точка входа: `miniapp.html`. Текущий порядок runtime-скриптов является контрактом:

1. `miniapp-fast-start.js`
2. Telegram WebApp SDK
3. `miniapp-v11.js`
4. `miniapp-v12.js`
5. `miniapp-v13.js`
6. `miniapp-payment-errors.js`
7. QRCode library
8. `miniapp-qr.js`
9. `miniapp-registration-theme.js`
10. `miniapp-stock-fix-v2.js`
11. `miniapp-search-ui-fix.js`
12. `miniapp-security.js`

`miniapp.js`, `miniapp-v9.js`, `miniapp-stock-flags-fix.js` и старые fix-файлы не подключены текущим `miniapp.html`; не редактировать их вместо активного runtime. После изменения порядка проверить запуск в Telegram, регистрацию, поиск, остатки, корзину, QR и навигацию.

### Backend

Рабочий backend находится только в `api/`:

- `server.js` — Express API, auth, профиль и публичная конфигурация.
- `loyalty.js` — клиенты, бонусы, покупки, транзакции.
- `security.js` — хеши, сессии, шифрование, Telegram initData.
- `login-security-context.js` — fail-closed контекст входа после CAPTCHA.
- `security-preload.js` — login CAPTCHA, rate limits и отключение оплаты.
- `registration-security.js` — Turnstile Siteverify, hostname/action и production guards.
- `test-mode-setup.js` — запрет dev-флагов в production.
- `admin-security-preload.js` — защита admin API.
- `admin-broadcast-server.js`, `broadcast-scheduler.js`, `schedule-api-preload.js` — рассылки.
- `bot-menu-sync.js` — Telegram menu button.
- `init.sql` — начальная PostgreSQL-схема.

Корневой `schedule-api-preload.js` не является файлом, импортируемым API-контейнером; backend использует `api/schedule-api-preload.js`.

## 3. Инфраструктура

- `docker-compose.yml`: `db`, `api`, `bot-menu-sync`, `admin-api`, `broadcast-scheduler`.
- Nginx не является compose-сервисом. Это системный Nginx, который читает статические файлы прямо из `/opt/loyaltyflow`.
- API: `127.0.0.1:3100 -> container:3000`.
- Admin API: `127.0.0.1:3101 -> container:3001`.
- Наружу сервисы доступны только через Nginx/HTTPS.
- `deploy/production.sh` создаёт production Nginx-конфигурацию и проверяет закрытие чувствительных путей.

Оплата намеренно отвечает `503` через `api/security-preload.js` до подключения проверенной платёжной системы. Не включать оплату макетом или клиентским кодом.

## 4. Безопасность авторизации

- Turnstile secret существует только на backend.
- Сервер проверяет hostname и action токена.
- Login fail-closed: `passwordOk()` в production требует verified login context.
- Verification code ограничен по IP и нормализованному email.
- Не возвращать dev CAPTCHA, код `000000` и auto-approve.
- Не выводить текст API через `innerHTML`; использовать `textContent`/DOM.
- Обязательные production-флаги: `NODE_ENV=production`, `ALLOW_DEV_CAPTCHA=false`, `ALLOW_DEV_EMAIL_CODE=false`, `AUTO_APPROVE_REGISTRATIONS=false`.

## 5. Mobile/UI checklist

Для ширин 320, 360, 390, 430, 768 и desktop проверить:

- нет горизонтального overflow;
- CAPTCHA не перекрывает password/input/button;
- Turnstile использует flexible size на узких экранах;
- список стран помещается в viewport, имеет поиск и доступный скролл;
- системная клавиатура не закрывает активное поле;
- кнопки имеют минимум 44 px;
- формы отправляются один раз;
- виджеты сбрасываются после ошибки;
- `prefers-reduced-motion` не ломает доступ к контенту.

## 6. Проверки

Изменённый браузерный JS:

```bash
node --check auth-app.js
node --check auth-page.js
node --check register-page.js
```

Backend:

```bash
cd api
npm test
npm run check
```

Перед публикацией UI проверить реальные страницы, а не только синтаксис:

```text
/auth.html
/register.html
/login.html
/miniapp.html?tenant=main
```

## 7. Production deployment

Сначала сохранить важные локальные изменения:

```bash
cd /opt/loyaltyflow
git status -sb
git diff > /root/loyaltyflow-local-$(date +%Y%m%d-%H%M%S).patch
```

Не применять `git clean`, если пользователь явно не подтвердил удаление untracked-файлов.

Статический frontend и Markdown — Docker не пересобирать:

```bash
cd /opt/loyaltyflow
git fetch origin refs/heads/backup/pre-glass-redesign-20260915
git reset --hard FETCH_HEAD
git log -1 --oneline
nginx -t
systemctl reload nginx
```

Backend/Docker/dependencies:

```bash
cd /opt/loyaltyflow
git fetch origin refs/heads/backup/pre-glass-redesign-20260915
git reset --hard FETCH_HEAD
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3100/api/health
```

Важно: при явном fetch ветки сбрасываться на `FETCH_HEAD`, а не на потенциально устаревший локальный `origin/...`.

## 8. Известные ограничения

- `package-lock.json` пока отсутствует; Docker использует `npm ci`, когда lock-файл есть, иначе безопасный fallback `npm install --ignore-scripts`.
- Реальная отправка email требует `RESEND_API_KEY` и `EMAIL_FROM`.
- Глобальная legacy CSP всё ещё допускает `unsafe-inline`; не удалять вслепую без миграции inline-обработчиков.
- CDN `intl-tel-input` и QRCode пока не vendored.

В финальном ответе всегда указать изменения, проверки, короткий SHA и точную production-команду.
