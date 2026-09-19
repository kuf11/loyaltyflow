# LoyaltyFlow для Эвотор

Нативное Android-приложение `LoyaltyFlow` для сценария бонусной скидки на экране оплаты Эвотор.

## Текущее состояние

- отдельный Android-проект находится в `evotor-app/`;
- зарегистрирован `ReceiptDiscountEvent` для продажи;
- приложение получает управление с экрана оплаты Эвотор;
- добавлен экран QR/кода клиента, номера телефона, суммы покупки и применения скидки;
- сумма текущего чека автоматически читается из кассы Эвотор;
- добавлена безопасная отмена операции и возврат callback Эвотор;
- текущая ветка: `feat/loyaltyflow-evotor-apk-20260918`;
- production-ветка сайта: `backup/pre-glass-redesign-20260915`.

Это **debug APK для тестирования**. Серверные маршруты quote/reserve/commit/release добавлены в этой ветке, но перед production нужны настройка секретов, pairing приложения с кабинетом владельца, release-подпись и тест на реальном терминале.

## Важное разделение каталогов

На сервере:

- `/opt/loyaltyflow` — рабочий веб-проект и production-код;
- `/opt/loyaltyflow-evotor-app` — отдельный worktree Android-приложения.

Не переключать `/opt/loyaltyflow` на Android-ветку и не запускать `docker compose` из `/opt/loyaltyflow-evotor-app`.

## Получение ветки на сервере

Команда безопасно добавляет приложение отдельным worktree и не меняет сайт. Важно явно создать remote-tracking ссылку: `FETCH_HEAD` внутри отдельного worktree недоступен.

```bash
cd /opt/loyaltyflow && \
 BRANCH=feat/loyaltyflow-evotor-apk-20260918 && \
 git fetch --prune origin "$BRANCH:refs/remotes/origin/$BRANCH" && \
 if [ -e /opt/loyaltyflow-evotor-app/.git ]; then \
   git -C /opt/loyaltyflow-evotor-app reset --hard "origin/$BRANCH"; \
 elif [ -d /opt/loyaltyflow-evotor-app ] && [ -n "$(find /opt/loyaltyflow-evotor-app -mindepth 1 -maxdepth 1 -print -quit)" ]; then \
   echo "Остановлено: каталог уже существует и не пустой"; exit 1; \
 else \
   git worktree add /opt/loyaltyflow-evotor-app "origin/$BRANCH"; \
 fi && \
 git -C /opt/loyaltyflow-evotor-app status --short
```

Эта команда обновляет только Android-worktree и не меняет `/opt/loyaltyflow`.

## Сборка debug APK через Docker

На сервере нужны только Docker и доступ к интернету. Команда не запускает веб-проект, не перезапускает production и монтирует только Android-каталог:

```bash
cd /opt/loyaltyflow-evotor-app && \
 docker run --rm \
   -v "$PWD:/workspace" \
   -w /workspace/evotor-app \
   ghcr.io/cirruslabs/android-sdk:35 \
   bash -lc '''
     set -e
     export ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}
     export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

     SDKMANAGER=$(command -v sdkmanager || find /opt -name sdkmanager -type f 2>/dev/null | head -n 1)
     "$SDKMANAGER" "platforms;android-35" "build-tools;35.0.0"

     mkdir -p /tmp/gradle
     curl -fsSL https://services.gradle.org/distributions/gradle-8.9-bin.zip -o /tmp/gradle.zip
     unzip -q /tmp/gradle.zip -d /tmp
     export PATH="/tmp/gradle-8.9/bin:$PATH"

     gradle --no-daemon --max-workers=1 --console=plain -Dorg.gradle.jvmargs="-Xmx768m -XX:MaxMetaspaceSize=256m -Dfile.encoding=UTF-8" -Dorg.gradle.vfs.watch=false --stacktrace :app:assembleDebug
   '''
```

Результат:

```text
/opt/loyaltyflow-evotor-app/evotor-app/app/build/outputs/apk/debug/app-debug.apk
```

Если появляется `BUILD SUCCESSFUL`, APK собран. Сборка настроена для сервера с 2 ГБ ОЗУ: один worker, heap 768 МБ и ограничение Metaspace 256 МБ. Если Docker не может скачать образ или Gradle — проверить доступ к реестру и интернет, не менять production-конфигурацию.

## Скачать APK

С сервера на компьютер через SSH/SCP:

```bash
scp root@SERVER_IP:/opt/loyaltyflow-evotor-app/evotor-app/app/build/outputs/apk/debug/app-debug.apk .
```

Далее APK можно передать на телефон любым безопасным способом. Не публиковать APK и токены в открытом доступе.

## Ограничения debug APK

- debug APK предназначен для просмотра интерфейса;
- URL и токен backend передаются в APK через Gradle properties; значения по умолчанию являются placeholder и не дают доступа;
- реальные QR, поиск по телефону, баланс, резерв, подтверждение и возврат бонусов ещё должны быть подключены через защищённые endpoint-ы;
- для установки на реальный терминал Эвотор потребуется release-сборка, подпись и проверка совместимости SDK.

## Сумма покупки из кассы Эвотор

`ReceiptDiscountEvent` передаёт приложению идентификатор текущего чека, а не готовую сумму. Поэтому `LoyaltyDiscountService` получает чек через `ReceiptApi.getReceipt(...)`, суммирует позиции по цене с учётом скидки (с резервным использованием базовой цены) и умножает цену на количество.

Итог передаётся в `LoyaltyFlowActivity` как `EXTRA_RECEIPT_TOTAL`. В интерфейсе сумма показывается автоматически и недоступна для ручного редактирования. При проверке клиента она также выводится в статусе. Вводить сумму покупки вручную не нужно.

Это сумма именно текущего чека, который Эвотор передал в событие скидки. Если чек не передан или в нём нет позиций, приложение показывает ошибку и не должно самостоятельно придумывать сумму.

## Поиск клиента: QR и номер телефона

На терминале кассир сможет выбрать один из двух способов:

- отсканировать или передать QR-код LoyaltyFlow;
- ввести номер телефона клиента в формате `+7...`.

QR сохраняется как основной быстрый способ. Номер телефона добавляется по аналогии с приложениями лояльности в Эвотор.

В Telegram Mini App клиент сначала делится контактом через Telegram. Backend сохраняет номер в `loyalty_customers.phone` и отмечает его как подтверждённый через `phone_verified`. Терминал не должен получать Telegram-токен или лишние данные клиента: он передаёт на защищённый backend только QR/телефон и сумму текущего чека, а получает минимальные данные для расчёта скидки.

Для завершения интеграции нужны защищённые методы:

- `POST /api/v1/evotor/app/customer` — поиск по QR или телефону и расчёт доступной скидки;
- `POST /api/v1/evotor/app/discount/reserve` — атомарный резерв бонусов;
- `POST /api/v1/evotor/app/discount/commit` — подтверждение после успешной продажи;
- `POST /api/v1/evotor/app/discount/release` — возврат резерва при отмене.

Номер телефона является персональными данными: его можно сохранять только с уведомлением клиента и в рамках опубликованной политики обработки персональных данных.

## Настройка Evotor API

Серверные маршруты защищены отдельным токеном приложения и привязаны к одному владельцу через переменные окружения. Секреты не добавлять в Git:

```bash
export EVOTOR_OWNER_ID="UUID-пользователя-владельца"
export EVOTOR_APP_TOKEN="случайный-длинный-секрет"
```

`EVOTOR_OWNER_ID` — это `users.id` владельца программы. `EVOTOR_APP_TOKEN` должен быть одинаковым на сервере и только в секретах сборки APK. Перезапустите API после изменения переменных окружения.

Для сборки APK с настройками API используйте Gradle properties или секреты CI:

```bash
gradle --no-daemon \
  -PloyaltyflowBaseUrl="https://ВАШ-ДОМЕН" \
  -PloyaltyflowAppToken="$EVOTOR_APP_TOKEN" \
  :app:assembleDebug
```

Не встраивайте токен в README, исходный код, скриншоты или публичные артефакты. Для GitHub Actions добавьте secrets `LOYALTYFLOW_BASE_URL` и `LOYALTYFLOW_APP_TOKEN` в репозитории. Workflow автоматически передаст их в debug-сборку; если secrets не заданы, APK соберётся только как демонстрационный интерфейс без доступа к API.

Сценарий резерва: APK вызывает `customer`, затем `reserve`; после возврата скидки в чек событие `RECEIPT_CLOSED` вызывает `commit`, а событие `CLEARED` вызывает `release`. Резерв живёт 10 минут и идемпотентен по `requestId`. Обработчик событий использует совместимые с SDK v0.4.10 Java-события `ReceiptClosedEvent` и `ReceiptClearedEvent`.

## Требуемый backend-контракт

Нужны отдельные endpoint-ы приложения:

- `POST /api/v1/evotor/app/customer` — QR/телефон + сумма, ответ: клиент, баланс, уровень, maxDiscount;
- `POST /api/v1/evotor/app/discount/reserve` — атомарный резерв бонусов;
- `POST /api/v1/evotor/app/discount/commit` — подтверждение после успешного чека;
- `POST /api/v1/evotor/app/discount/release` — возврат резерва при отмене;
- pairing, отзыв токена и проверка владельца приложения.

Баланс из QR нельзя считать достоверным. Окончательное решение должно приниматься сервером, а операции должны быть идемпотентными.

## Правила для других агентов

1. Не работать напрямую в production-ветке для Android-задач.
2. Не публиковать `EVOTOR_APP_TOKEN` и не собирать production APK с токеном в открытом репозитории.
3. Не удалять `/opt/loyaltyflow` и не выполнять `git reset` в нём без явного подтверждения.
4. Сначала обновить отдельный worktree `/opt/loyaltyflow-evotor-app` через remote-tracking ветку `origin/feat/loyaltyflow-evotor-apk-20260918`.
5. Не хранить в репозитории токены Эвотор, JWT, ключи подписи APK и пароли.
6. Не считать debug APK готовым для публикации.
7. Перед merge проверить сборку, backend-контракт и реальный терминал.


## GitHub Actions: ошибка `Failed to find package tools`

Если `android-actions/setup-android@v3` завершается ошибкой `Failed to find package tools`, в workflow нужно явно указать поддерживаемые SDK-пакеты и не запрашивать устаревший пакет `tools`:

```yaml
- name: Android SDK
  uses: android-actions/setup-android@v3
  with:
    packages: "platform-tools platforms;android-35 build-tools;35.0.0"
```

Для Java использовать `actions/setup-java@v5`.


## Manifest merger: конфликт `allowBackup`

Если сборка сообщает, что `android:allowBackup` задан одновременно приложением и `com.github.evotor:integration-library`, в корневом `AndroidManifest.xml` должны быть подключены tools и override:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

<application
    android:allowBackup="false"
    tools:replace="android:allowBackup">
```

Это явно оставляет безопасное значение приложения и разрешает Android manifest merger объединить манифест библиотеки Эвотор.


## Duplicate classes: AndroidX и старый Support Library

Если Gradle сообщает о дублирующихся классах между `androidx.core` и `com.android.support:support-compat`, включи Jetifier в `evotor-app/gradle.properties`:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

Jetifier преобразует старую Support Library, которую использует версия интеграционной библиотеки Эвотор, в AndroidX. Не добавляй одновременно ручные исключения для `support-compat`, пока Jetifier не проверен.


## Компиляция `LoyaltyDiscountService` и SDK v0.4.10

Версия `com.github.evotor:integration-library:v0.4.10` использует вложенный тип `ActionProcessor.Callback`, поэтому callback нужно объявлять как `ActionProcessor.Callback`. В этой версии `ReceiptDiscountEventResult` принимает три аргумента:

```java
new ReceiptDiscountEventResult(
    BigDecimal.valueOf(discount),
    null,
    changes
);
```

Не использовать четырёхаргументный конструктор из более новой версии SDK: он не существует в `v0.4.10`.
