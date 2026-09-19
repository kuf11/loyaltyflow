# LoyaltyFlow

LoyaltyFlow — SaaS-платформа программы лояльности: кабинет владельца, Telegram-бот, Telegram Mini App, каталог, бонусы, клиенты, аналитика и рассылки.

## Production

- Репозиторий: `kuf11/loyaltyflow`.
- Активная ветка: `backup/pre-glass-redesign-20260915`.
- Каталог сервера: `/opt/loyaltyflow`.
- Публичный адрес: `https://loyaltyflow.ru`.
- `main` не использовать: там отменённый glass-redesign.
- Точные команды и правила для агентов: `AGENTS.md`.

## Архитектура runtime

```text
Browser / Telegram
        |
   HTTPS Nginx (systemd, root=/opt/loyaltyflow)
        |-- static HTML/CSS/JS
        `-- /api/* -> 127.0.0.1:3100
                         |
                    Docker API
                         |
                    PostgreSQL
```

Admin API слушает только `127.0.0.1:3101`. Публичные API-порты наружу не открывать.

## Публичная главная и авторизация

| Страница | Активные файлы | Назначение |
|---|---|---|
| `/auth.html` | `auth-v2.css`, `auth-app.js`, `auth-actions.js`, `registration-ui-fixes.css`, `auth-runtime-fixes.css` | Главная, встроенная регистрация и вход |
| `/register.html` | `auth-pages.css`, `registration-ui-fixes.css`, `auth-runtime-fixes.css`, `register-page.js` | Отдельная регистрация |
| `/login.html` | `auth-pages.css`, `auth-runtime-fixes.css`, `auth-page.js` | Отдельный вход |

Регистрация на главной и отдельная регистрация используют один UI телефона на `intl-tel-input@29.2.3`:

- определение страны по locale;
- флаг и международный код;
- поиск страны;
- форматирование во время ввода;
- проверка номера;
- отправка номера в международном формате.

Turnstile применяется серверно и клиентски. Actions должны совпадать с backend: `register` для регистрации, `login` для входа. На узких экранах виджеты используют flexible size. `auth-runtime-fixes.css` отвечает за зазор между password и CAPTCHA и за отсутствие mobile overflow.

## Подтверждение email

Регистрация уже использует шестизначный код со сроком действия 15 минут. Production-доставка выполняется через Resend после верификации домена `loyaltyflow.ru` и настройки `RESEND_API_KEY` и `EMAIL_FROM=LoyaltyFlow <no-reply@mail.loyaltyflow.ru>`. Dev-код и auto-approve в production запрещены.

## Кабинет владельца

Точка входа: `index.html`.

- `admin.js` — профиль, навигация, конфигурация Mini App, предпросмотр.
- `admin.css`, `ui-fixes.css` — стили кабинета.
- `admin-save-fix.js` — актуальные исправления сохранения и статуса запуска.
- `clients-dashboard.js` — клиентская база.
- `catalog-admin.html`, `catalog-admin.js` — ассортимент, остатки, XLSX/XLS.
- `analytics.html`, `analytics-dashboard.js`, `loyalty-analytics.js` — аналитика.
- `loyalty-admin.html`, `loyalty-admin.js` — настройки бонусной программы.
- `broadcasts.html`, `broadcasts.js`, `broadcast-default-link.js`, `broadcast-edit-fix-v2.js` — рассылки.
- `platform-admin.html`, `platform-admin.js` — управление пользователями платформы.

Товары хранятся в `users.miniapp_design.products`. Основные поля: `id`, `name`, `category`, `price`, `bonus`, `stock`, `image`.

## Telegram Mini App

Точка входа: `miniapp.html`.

### Активный порядок CSS

1. `miniapp-v11.css`
2. `miniapp-v12.css`
3. `miniapp-v13.css`
4. `miniapp-v14.css`
5. `miniapp-v15.css`
6. `miniapp-phone.css`
7. `miniapp-fixes.css`

### Активный порядок JavaScript

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

Поздние файлы исправляют ранний runtime, поэтому порядок нельзя менять без полного regression-теста. `miniapp.js`, `miniapp-v9.js` и `miniapp-stock-flags-fix.js` текущей страницей не загружаются.

## Backend (`api/`)

| Файл | Ответственность |
|---|---|
| `server.js` | Express API, auth, профиль, public config, Mini App config |
| `loyalty.js` | Клиенты, бонусы, покупки и транзакции |
| `security.js` | Пароли, сессии, AES-GCM, origin и Telegram initData |
| `login-security-context.js` | Verified login context; блокирует обход CAPTCHA прямым запуском server.js |
| `security-preload.js` | Login CAPTCHA, verify rate limit и временное отключение оплаты |
| `registration-security.js` | Turnstile Siteverify, hostname/action, production guards |
| `test-mode-setup.js` | Запрет dev-флагов в production |
| `admin-security-preload.js` | Авторизация admin API |
| `admin-broadcast-server.js` | API рассылок |
| `broadcast-scheduler.js` | Исполнение расписания рассылок |
| `schedule-api-preload.js` | API операций расписания |
| `bot-menu-sync.js` | Синхронизация кнопки запуска Mini App |
| `init.sql` | Начальная схема PostgreSQL |
| `Dockerfile`, `package.json` | Сборка и проверки API |

Backend использует файл `api/schedule-api-preload.js`. Одноимённый файл в корне не является импортом API-контейнера.

## Docker и Nginx

`docker-compose.yml` содержит:

- `db` — PostgreSQL 16;
- `api` — основной API;
- `bot-menu-sync`;
- `admin-api`;
- `broadcast-scheduler`.

Nginx в compose отсутствует. Это системный сервис. Статические файлы читаются прямо из checkout, поэтому после frontend-изменений Docker не пересобирается.

`deploy/production.sh`:

- обновляет разрешённую ветку;
- поднимает контейнеры;
- настраивает TLS/Nginx;
- проксирует `/api/`;
- блокирует `.env`, `.git`, deployment и конфигурационные файлы;
- проверяет API health.

## Security baseline

- API: `127.0.0.1:3100`.
- Admin API: `127.0.0.1:3101`.
- Login и registration защищены Turnstile.
- Backend проверяет Turnstile hostname и action.
- Login fail-closed через `login-security-context.js`.
- Verification attempts ограничены по IP и email.
- Dev CAPTCHA/email code/auto-approve запрещены в production.
- Bot tokens шифруются отдельным `BOT_TOKEN_ENCRYPTION_KEY`.
- Endpoint оплаты намеренно возвращает `503` до подключения проверенного провайдера.

Не публиковать `TURNSTILE_SECRET_KEY`, `JWT_SECRET`, `ADMIN_KEY`, `BOT_TOKEN_ENCRYPTION_KEY`, `POSTGRES_PASSWORD` и Telegram tokens.

## Проверка frontend

```bash
node --check auth-app.js
node --check auth-page.js
node --check register-page.js
node --check miniapp-search-ui-fix.js
```

Обязательные ручные размеры: 320, 360, 390, 430, 768 и desktop. Проверить overflow, dropdown страны, экранную клавиатуру, CAPTCHA, submit, сообщения ошибок и повторное открытие Telegram Mini App.

## Проверка backend

```bash
cd api
npm test
npm run check
```

Health:

```bash
curl -fsS http://127.0.0.1:3100/api/health
```

## Обновление production

Frontend/документация:

```bash
cd /opt/loyaltyflow
git fetch origin refs/heads/backup/pre-glass-redesign-20260915
git reset --hard FETCH_HEAD
git log -1 --oneline
nginx -t
systemctl reload nginx
```

Backend:

```bash
cd /opt/loyaltyflow
git fetch origin refs/heads/backup/pre-glass-redesign-20260915
git reset --hard FETCH_HEAD
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3100/api/health
```

## Известные ограничения

- `package-lock.json` пока отсутствует.
- Реальная отправка email требует `RESEND_API_KEY` и `EMAIL_FROM`.
- Глобальная legacy CSP пока содержит `unsafe-inline`.
- `intl-tel-input` и QRCode загружаются с CDN.
- Оплата отключена намеренно.
