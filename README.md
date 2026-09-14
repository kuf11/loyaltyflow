# LoyaltyFlow

LoyaltyFlow — веб-кабинет и Telegram Mini App для запуска программ лояльности. Владелец бизнеса настраивает бренд, каталог, Telegram-бота и правила бонусов; клиент регистрируется через Telegram, показывает QR-код, просматривает каталог, баланс, уровни и историю операций.

## Архитектура

```text
Браузер владельца ──┐
Telegram Mini App ──┼── HTTP API (Node.js/Express) ── PostgreSQL
Telegram Bot API ───┘
```

Проект пока не использует frontend-фреймворк или сборщик: страницы, стили и клиентская логика лежат в корне и отдаются веб-сервером окружения. Backend находится в `api/` и запускается отдельно.

## Карта проекта

### Основные страницы владельца

| Файл | Назначение |
| --- | --- |
| `index.html` | Главный кабинет: обзор, настройка Mini App, клиенты и настройки |
| `admin.js` | Навигация кабинета, авторизация, загрузка и сохранение конфигурации |
| `admin.css` | Основные стили кабинета |
| `admin-enhancements.js/css` | Дополнительное поведение и улучшения админки |
| `catalog-admin.html/js` | Управление каталогом |
| `loyalty-admin.html/js` | Настройка бонусов, уровней и клиентов |
| `analytics.html` | Страница аналитики |
| `analytics-dashboard.js` | Загрузка и отображение аналитики |
| `clients-dashboard.js` | Список и управление клиентами |
| `broadcasts.html/js/css` | Интерфейс рассылок |
| `admin-approvals.html` | Одобрение новых владельцев платформенным администратором |
| `platform-admin.html/js/css` | Интерфейс платформенного администратора |

### Регистрация и вход

| Файл | Назначение |
| --- | --- |
| `auth.html`, `login.html`, `register.html` | Страницы авторизации и регистрации |
| `auth-app.js`, `auth-page.js`, `auth-actions.js` | Клиентская логика авторизации |
| `auth-pages.css`, `auth-v2.css` | Стили страниц авторизации |
| `registration-ui-fixes.css` | Исправления интерфейса регистрации |

### Telegram Mini App

| Файл | Назначение |
| --- | --- |
| `miniapp.html` | Точка входа клиентского Mini App |
| `miniapp.js` | Базовая логика Mini App |
| `miniapp-v9.js`, `miniapp-v11.js`, `miniapp-v12.js`, `miniapp-v13.js` | Последовательные слои функциональности Mini App |
| `miniapp-v9.css` … `miniapp-v15.css` | Последовательные слои оформления Mini App |
| `miniapp-qr.js` | Отрисовка QR-кода |
| `miniapp-registration-theme.js` | Оформление регистрации по номеру телефона |
| `miniapp-phone.css` | Стили телефонной регистрации |

> Перед правкой Mini App сначала откройте `miniapp.html`: подключённые там версии определяют фактически используемые JS/CSS. Не читайте все версии без необходимости.

### Backend (`api/`)

| Файл | Назначение |
| --- | --- |
| `api/server.js` | Express-приложение: регистрация, вход, кабинет владельца, конфигурация Mini App, CORS и admin endpoints |
| `api/security.js` | Пароли, подпись сессий, шифрование токенов и проверка Telegram `initData` |
| `api/registration-security.js` | Cloudflare Turnstile и отправка email-кодов через Resend |
| `api/loyalty.js` | Клиенты, бонусные уровни, покупки, ручные корректировки и история |
| `api/admin-broadcast-server.js` | Административные рассылки и связанные endpoints |
| `api/bot-menu-sync.js` | Периодическая синхронизация меню Telegram-бота |
| `api/init.sql` | Начальная схема `businesses` и `mini_app_configs` |
| `api/security.test.js` | Тесты security helpers |
| `api/package.json` | Backend-зависимости и команды |
| `api/Dockerfile` | Образ backend-сервиса |

### Инфраструктура

| Файл/каталог | Назначение |
| --- | --- |
| `docker-compose.yml` | PostgreSQL, основной API, синхронизация бота и admin API |
| `deploy/` | Файлы развёртывания |
| `.claude/`, `.cursor/`, `.windsurf/`, `.clinerules/` | Инструкции для кодинг-агентов; не являются runtime-кодом |
| `AGENTS.md` | Краткая карта и правила работы AI-агентов с репозиторием |

## Данные

PostgreSQL хранит:

- `users` — владельцев, статусы регистрации/trial, зашифрованный токен Telegram и JSON-конфигурацию Mini App;
- `verification_codes` — временные коды подтверждения email;
- `businesses`, `mini_app_configs` — базовую конфигурацию программы;
- `loyalty_customers` — Telegram-клиентов, телефон, баланс, расходы и блокировку;
- `loyalty_transactions` — начисления, списания, покупки и метаданные операций.

Постоянный volume: `postgres_data`. Секреты должны передаваться только через переменные окружения и не коммититься.

## Запуск

Минимально необходимы:

```bash
POSTGRES_PASSWORD=...
SYNC_SECRET=...
ADMIN_KEY=...
JWT_SECRET=...
PUBLIC_APP_URL=https://example.com
```

Дополнительно используются `TELEGRAM_BOT_TOKEN`, `CORS_ORIGINS`, ключи Turnstile, Resend и список платформенных администраторов. Полный список и безопасные значения описаны в `SECURITY.md` и `api/registration.env.example`.

```bash
docker compose up --build
```

API доступен локально на `127.0.0.1:3100`, admin API — на `127.0.0.1:3101`.

## Проверки

```bash
cd api
npm test
npm run check
```

Перед релизом также выполнить аудит зависимостей и проверить production-конфигурацию согласно `SECURITY.md`.
