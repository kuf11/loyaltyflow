# LoyaltyFlow

LoyaltyFlow — SaaS-платформа программы лояльности с кабинетом владельца, Telegram-ботом, Telegram Mini App, каталогом товаров, бонусами, клиентами, аналитикой и рассылками.

## Важно: актуальная production-ветка

Production сейчас обновляется из ветки:

```text
backup/pre-glass-redesign-20260915
```

Не использовать `git pull main`: ветка `main` содержит отменённый glass-redesign. Точная инструкция обновления находится в `AGENTS.md`.

## Карта проекта

### Кабинет владельца

- `index.html` — основной кабинет: дашборд, настройка Mini App, клиенты и настройки.
- `admin.js` — загрузка состояния кабинета, навигация, настройки Mini App и предпросмотр.
- `admin.css`, `ui-fixes.css` — основные стили кабинета.
- `admin-save-fix.js` — актуальные исправления сохранения, статуса запуска и закрепления предпросмотра.
- `clients-dashboard.js` — список клиентов и операции с выбранным клиентом.
- `catalog-admin.html`, `catalog-admin.js` — ассортимент, остатки, импорт/экспорт Excel.
- `analytics.html`, `analytics-dashboard.js`, `loyalty-analytics.js` — аналитика.
- `loyalty-admin.html`, `loyalty-admin.js` — настройки программы лояльности.
- `broadcasts.html`, `broadcasts.js`, `broadcast-default-link.js`, `broadcast-edit-fix-v2.js` — создание, расписание и редактирование рассылок.
- `platform-admin.html`, `platform-admin.js` — управление пользователями платформы.

### Telegram Mini App

Точка входа — `miniapp.html`. Порядок скриптов важен: более поздние файлы дополняют или исправляют ранний runtime.

- `miniapp-fast-start.js` — быстрый первый экран.
- `miniapp-v11.js` — базовое приложение, каталог, корзина и навигация.
- `miniapp-v12.js` — улучшения карточек и модальных окон.
- `miniapp-v13.js` — серверная программа лояльности и регистрация по телефону.
- `miniapp-payment-errors.js` — сообщения об ошибках оплаты.
- `miniapp-qr.js` — QR-код.
- `miniapp-registration-theme.js` — тема регистрации.
- `miniapp-stock-fix-v2.js` — клиентские ограничения по остаткам; должен загружаться после основных Mini App-скриптов.
- `miniapp-search-ui-fix.js` — живой поиск и финальная верстка блока популярных товаров; загружается последним.
- `miniapp-v11.css` … `miniapp-v15.css`, `miniapp-phone.css`, `miniapp-fixes.css` — стили приложения.

При изменении порядка скриптов обязательно повторно проверить поиск, остатки, корзину, регистрацию и оплату.

### Backend

Каталог `api/`:

- `server.js` — основной Express API, авторизация, профиль и конфигурация Mini App.
- `loyalty.js` — клиенты, бонусы, покупки и транзакции.
- `security.js`, `security-preload.js`, `registration-security.js` — безопасность и ограничения регистрации/оплаты.
- `admin-broadcast-server.js` — API рассылок.
- `broadcast-scheduler.js`, `schedule-api-preload.js` — расписание и редактирование отложенных рассылок.
- `bot-menu-sync.js` — синхронизация кнопки запуска Mini App в Telegram.
- `init.sql` — начальная схема PostgreSQL.
- `Dockerfile`, `package.json` — сборка API.

`security-preload.js` сейчас намеренно отключает endpoint оплаты до подключения проверенной платёжной системы. Не удалять это ограничение без отдельного решения по платежам.

### Инфраструктура

- `docker-compose.yml` — API, PostgreSQL и связанные сервисы.
- `deploy/` — конфигурация production-развёртывания.
- Production-каталог: `/opt/loyaltyflow`.
- Production-хост: `31.77.207.38.nip.io`.

## Данные каталога

Товары хранятся в `users.miniapp_design.products`. Основные поля:

```text
id, name, category, price, bonus, stock, image
```

Excel-импорт находится в `catalog-admin.js`. Он принимает XLSX/XLS, проверяет строки и обновляет совпадения по паре `название + категория`.

## Минимальные проверки перед коммитом

```bash
node --check изменённый-файл.js
cd api && npm test
```

Для UI дополнительно проверить desktop/mobile, отсутствие горизонтального overflow и фактическое поведение внутри Telegram Mini App.

## Обновление production

Не придумывать команды и не использовать SSH: пользователь уже находится на сервере. Следовать разделу «Обновление production-сервера» в `AGENTS.md`.
