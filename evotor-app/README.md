# LoyaltyFlow для Эвотор

Нативное Android-приложение `LoyaltyFlow` для сценария бонусной скидки на экране оплаты Эвотор.

## Текущее состояние

- отдельный Android-проект находится в `evotor-app/`;
- зарегистрирован `ReceiptDiscountEvent` для продажи;
- приложение получает управление с экрана оплаты Эвотор;
- добавлен экран QR/кода клиента, суммы покупки и применения скидки;
- добавлена безопасная отмена операции и возврат callback Эвотор;
- текущая ветка: `feat/loyaltyflow-evotor-apk-20260918`;
- production-ветка сайта: `backup/pre-glass-redesign-20260915`.

Это **не готовый production APK**. Для рабочего списания бонусов необходимо подключить backend quote/reserve/commit/release, pairing приложения с кабинетом владельца, release-подпись и тест на реальном терминале.

## Важное разделение каталогов

На сервере:

- `/opt/loyaltyflow` — рабочий веб-проект и production-код;
- `/opt/loyaltyflow-evotor-app` — отдельный worktree Android-приложения.

Не переключать `/opt/loyaltyflow` на Android-ветку и не запускать `docker compose` из `/opt/loyaltyflow-evotor-app`.

## Получение ветки на сервере

Команда безопасно добавляет приложение отдельным worktree и не меняет сайт:

```bash
cd /opt/loyaltyflow && \
 git fetch --prune origin feat/loyaltyflow-evotor-apk-20260918 && \
 if [ -e /opt/loyaltyflow-evotor-app/.git ]; then \
   git -C /opt/loyaltyflow-evotor-app reset --hard FETCH_HEAD; \
 elif [ -d /opt/loyaltyflow-evotor-app ] && [ -n "$(find /opt/loyaltyflow-evotor-app -mindepth 1 -maxdepth 1 -print -quit)" ]; then \
   echo "Остановлено: каталог уже существует и не пустой"; exit 1; \
 else \
   git worktree add /opt/loyaltyflow-evotor-app FETCH_HEAD; \
 fi && \
 git -C /opt/loyaltyflow-evotor-app status --short
```

Используется явная remote-tracking ссылка, чтобы отдельный worktree всегда получал точную версию ветки.

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

     gradle --no-daemon --stacktrace :app:assembleDebug
   '''
```

Результат:

```text
/opt/loyaltyflow-evotor-app/evotor-app/app/build/outputs/apk/debug/app-debug.apk
```

Если появляется `BUILD SUCCESSFUL`, APK собран. Если Docker не может скачать образ или Gradle — проверить доступ к реестру и интернет, не менять production-конфигурацию.

## Скачать APK

С сервера на компьютер через SSH/SCP:

```bash
scp root@SERVER_IP:/opt/loyaltyflow-evotor-app/evotor-app/app/build/outputs/apk/debug/app-debug.apk .
```

Далее APK можно передать на телефон любым безопасным способом. Не публиковать APK и токены в открытом доступе.

## Ограничения debug APK

- debug APK предназначен для просмотра интерфейса;
- URL backend пока является placeholder и не даёт production-доступа;
- реальные QR, баланс, резерв, подтверждение и возврат бонусов ещё должны быть подключены через защищённые endpoint-ы;
- для установки на реальный терминал Эвотор потребуется release-сборка, подпись и проверка совместимости SDK.

## Требуемый backend-контракт

Нужны отдельные endpoint-ы приложения:

- `POST /api/v1/evotor/app/customer` — QR + сумма, ответ: клиент, баланс, уровень, maxDiscount;
- `POST /api/v1/evotor/app/discount/reserve` — атомарный резерв бонусов;
- `POST /api/v1/evotor/app/discount/commit` — подтверждение после успешного чека;
- `POST /api/v1/evotor/app/discount/release` — возврат резерва при отмене;
- pairing, отзыв токена и проверка владельца приложения.

Баланс из QR нельзя считать достоверным. Окончательное решение должно приниматься сервером, а операции должны быть идемпотентными.

## Правила для других агентов

1. Не работать напрямую в production-ветке для Android-задач.
2. Не удалять `/opt/loyaltyflow` и не выполнять `git reset` в нём без явного подтверждения.
3. Сначала обновить отдельный worktree `/opt/loyaltyflow-evotor-app` через `FETCH_HEAD`.
4. Не хранить в репозитории токены Эвотор, JWT, ключи подписи APK и пароли.
5. Не считать debug APK готовым для публикации.
6. Перед merge проверить сборку, backend-контракт и реальный терминал.
