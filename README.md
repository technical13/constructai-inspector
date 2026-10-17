# ConstructAI Inspector

`MVP0 + V2` цифрового стройконтроля: мобильный web-интерфейс для запуска инспекционной сессии, фиксации дефектов с фото, AI-подсказки по типу дефекта и генерации акта на основе сохранённых данных. Для трещин приложение поддерживает сравнение нескольких CV-моделей; самый визуальный контур сейчас строится в pipeline `DeepCrack/Grounding DINO seed -> SAM 2 refine`.

## Honest public demo

Публичная web-демонстрация не маскируется под production inference-service.

- `Demo Mode` использует **предрассчитанные результаты реального CV-pipeline** на заранее подобранных изображениях трещин.
- эти маски были получены локально через настоящий inference pipeline и затем сохранены для стабильного публичного показа
- загрузка **своих** фотографий с реальным анализом доступна только в **локальном full mode**, когда запущен CV-service и подключены веса

Это сделано сознательно: публичная demo-версия показывает UX, логику документов и визуальную подачу CV, но не выдаётся за открытый online inference для любых пользовательских фото.

Публичная версия: [constructai-inspector.vercel.app](https://constructai-inspector.vercel.app)

## Quick start

Требование: Node.js `24.x`.

Самый простой путь для нового пользователя после `git clone`:

```bash
npm run quickstart
```

Что делает эта команда:

- устанавливает Node dependencies
- подготавливает локальные директории runtime
- запускает web-приложение в **demo mode**

После запуска откройте:

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

Если нужен максимально быстрый просмотр без CV-моделей, этого достаточно.

## Quick start: full local mode

Если пользователь хочет воспроизвести именно локальный inference на своих фото:

1. положить checkpoint `DeepCrack` в:

```text
services/cv_inference/models/deepcrack_ct260.pth
```

2. выполнить:

```bash
npm run quickstart:full
```

Эта команда:

- ставит Node dependencies
- создаёт `.venv-cv`
- ставит Python dependencies для CV-service
- запускает web UI
- запускает локальный inference-service на `127.0.0.1:8001`

Если checkpoint отсутствует, full mode честно не поднимет inference и останется в demo-парадигме.

## Что реализовано

- создание проекта
- запуск инспекционной сессии
- фиксация дефекта с фотографией
- структурированная подсказка формулировки по типу дефекта
- `V2`: AI-подсказка типа дефекта с обязательным подтверждением человеком
- визуальная подсветка дефекта поверх фото и внутри акта
- `Grounded SAM 2`: уточнение mask-overlay внутри seed-зон от `DeepCrack` или `Grounding DINO`
- `Demo Mode`: заранее подготовленные фото и сохранённые SAM 2 маски для публичного показа без локального Python inference
- генерация HTML-акта из сохранённого snapshot сессии
- два режима хранения:
  - локальный filesystem для разработки
  - `Postgres`-режим для Vercel/serverless-деплоя
- fallback-хранение изображений и HTML-актов внутри `Postgres`, если `Vercel Blob` не настроен

## Локальный запуск вручную

```bash
npm start
```

После запуска откройте [http://localhost:3000](http://localhost:3000).

По умолчанию без env-переменных используется локальное хранение:

- `data/store.json` содержит проекты, сессии, дефекты и акты
- `data/uploads/` хранит изображения дефектов
- `data/reports/` хранит сгенерированные HTML-акты

Для одновременного запуска web UI:

```bash
npm run dev
```

Это поднимает только web UI и ориентировано на demo mode.

## Локальный запуск CV-service вручную

Для реальной геометрии трещины и сравнения с zero-shot detector нужен отдельный Python inference-service:

```bash
python3.11 -m venv .venv-cv
.venv-cv/bin/pip install -r services/cv_inference/requirements.txt
```

Checkpoint `DeepCrack` не хранится в git. Для локального запуска положите файл весов сюда:

```text
services/cv_inference/models/deepcrack_ct260.pth
```

```bash
npm run cv:start
```

По умолчанию web-приложение будет обращаться к `http://127.0.0.1:8001`. В текущей конфигурации этот сервис умеет:

- `DeepCrack`
- `Grounding DINO`
- `Grounded SAM 2`
- `Florence-2`

Опциональные переменные:

```bash
CV_INFERENCE_MODE=external
CV_INFERENCE_URL=http://127.0.0.1:8001
CV_MODEL_DEFAULT=grounded-sam2
FLORENCE2_MODEL_ID=florence-community/Florence-2-base-ft
```

Режимы AI:

- `external` — использовать реальный inference-service
- `mock` — использовать встроенный mock-адаптер для разработки и тестов
- `auto` — пробовать реальный сервис и падать обратно в mock только если он недоступен

## Выбор моделей

В интерфейсе теперь есть явный селектор AI-модели:

- `DeepCrack` — реальная crack-segmentation модель
- `Grounding DINO` — реальный zero-shot detector с более жёсткой фильтрацией и дедупликацией box-ов
- `Grounded SAM 2` — pipeline `seed -> SAM 2`, который сначала использует зоны `DeepCrack`, а если их нет, откатывается на `Grounding DINO`
- `Florence-2` — реальная foundation-модель, подключённая в тот же inference-service
- `Universal CV Adapter` — унифицированный контракт под любую внешнюю предобученную модель

После загрузки одного фото приложение сравнивает все подключённые модели на одном и том же изображении. Для новых фото и для `Переанализировать` у сохранённого дефекта используется выбранная основная модель.

## Воспроизводимый CV benchmark

В репозитории зафиксирован benchmark `benchmarks/cv/manifest.json` с тремя уникальными
фотографиями и сохранёнными mask-reference. Сначала проверьте его контракт:

```bash
npm run benchmark:cv:validate
```

Для реального прогона запустите CV-service и в другом терминале выполните:

```bash
npm run benchmark:cv
```

Команда считает `Dice`, `IoU`, precision, recall и точность типа дефекта для каждой
модели. Строгий режим возвращает ненулевой exit code при нарушении quality gate:

```bash
npm run benchmark:cv:enforce
```

Текущие reference-маски являются одобренными результатами прежнего Grounded SAM 2
inference. Они позволяют обнаруживать регрессии, но **не являются независимой ручной
разметкой и не доказывают точность модели**. Для сравнительных заявлений о точности
нужен отдельный набор human-annotated масок.

## Demo Mode

Для публичного MVP в интерфейсе есть блок `Demo Mode`. Он использует статические файлы из `public/demo/`:

- `public/demo/images/` — заранее подобранные фото трещин
- `public/demo/scenarios.json` — сохранённый результат `Grounded SAM 2`, включая `visualEvidence.maskDataUrl`

Такой сценарий работает на Vercel без локального Python-сервиса: пользователь выбирает демо-фото, нажимает `Проверить демо`, и приложение сразу показывает подготовленную маску. Свои фото по-прежнему можно загружать локально, но для реального анализа нужен запущенный CV-service.

Добавление и удаление demo-кейсов доступно только в локальном writable-режиме. На Vercel demo-библиотека автоматически работает только на чтение: публичный пользователь может запускать примеры, но не менять содержимое `public/demo/`.

Workflow публикации нового удачного примера:

1. запустить локальный full mode и проанализировать фотографию
2. нажать `Отправить в демо` / `Add to demo`
3. проверить изменения в `public/demo/scenarios.json` и `public/demo/images/`
4. выполнить `npm run verify`, commit и production redeploy

Публичный набор обновляется только вместе с новой версией кода. Это сохраняет воспроизводимость и не позволяет посетителям менять curated demo-набор.

Именно это разделение важно с точки зрения честной публикации:

- публичный режим = предрассчитанная demo на curated examples
- локальный full mode = реальный inference на пользовательских фото

По умолчанию `DeepCrack`, `Grounding DINO`, `Grounded SAM 2` и `Florence-2` могут работать через один локальный endpoint `http://127.0.0.1:8001`. Если нужно развести модели по разным сервисам, задайте отдельные endpoint'ы:

```bash
DEEPCRACK_INFERENCE_URL=http://127.0.0.1:8001
GROUNDING_DINO_INFERENCE_URL=http://127.0.0.1:8001
GROUNDED_SAM2_INFERENCE_URL=http://127.0.0.1:8001
FLORENCE2_INFERENCE_URL=http://127.0.0.1:8001
GENERAL_CV_INFERENCE_URL=http://127.0.0.1:8004
```

Для `Grounding DINO` дополнительно доступны жёсткие пороги post-processing через env, например `GROUNDING_DINO_MIN_CONFIDENCE` и `GROUNDING_DINO_MAX_BOXES_PER_TYPE`. Для `Grounded SAM 2` можно менять `SAM2_MODEL_ID`, `GROUNDED_SAM2_MAX_BOXES` и другие `SAM2_*` переменные.

## Проверка

Решение человека хранится отдельно от совпадения типа с AI-подсказкой.
`Keep manual` сохраняет ручной выбор; `Accept type` явно принимает предложенный
тип. Любой новый анализ снова требует решения. Старые неоднозначные записи
помечаются как `Review not recorded (legacy)` без изменения исходных данных.

Публичное демо и акты обозначают предрассчитанные результаты. `Model score`
является исходной оценкой модели, а не независимо подтверждённой точностью
или калиброванной вероятностью. Mock-адаптер предназначен только для тестов.

```bash
npm test
```

Тесты принудительно запускаются в `mock`-режиме, чтобы не зависеть от Python-сервиса.

Полный verify baseline:

```bash
npm run verify
```

Он последовательно выполняет `lint`, `typecheck`, `test`, `build`, `hygiene` и `audit`.

Проверка с отдельным локальным PostgreSQL описана в `docs/testing.md`.
Для воспроизводимой демонстрации без доступа к пользовательским данным:

```bash
npm run evidence:serve
```

Команда создаёт новое изолированное хранилище в `logs/evidence-*/runtime`,
отключает live inference и запускает приложение на `http://127.0.0.1:3100`.
Сценарий съёмки и manifest: [docs/evidence-capture.md](docs/evidence-capture.md).

Отдельный технический аудит:

```bash
npm run audit
```

Он проверяет достижимость модулей, DOM/i18n-контракты, demo-ассеты, связи локальных сущностей и доступность media/report-файлов. Осиротевшие runtime-файлы выводятся как предупреждения и никогда не удаляются автоматически.

Дополнительная проверка гигиены репозитория:

```bash
npm run hygiene
```

Она проверяет, что в рабочей зоне исходников нет `.DS_Store` и Python cache-файлов. Runtime-данные в `data/`, `.venv-cv/`, `node_modules/` и веса моделей считаются локальными артефактами и не должны попадать в git.

## Режим для Vercel

Текущий production: [https://constructai-inspector.vercel.app](https://constructai-inspector.vercel.app).

Приложение больше не завязано на постоянно включённый ноутбук. Текущий деплой использует:

1. Vercel Functions и статику из `public/`
2. бесплатный Neon Postgres для проектов, сессий, дефектов и актов
3. checked-in read-only demo-сценарии без online CV inference

Минимальная конфигурация:

```bash
STORAGE_BACKEND=postgres
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
```

Опционально можно добавить:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```

Если `BLOB_READ_WRITE_TOKEN` не задан, изображения и HTML-акты будут храниться в `Postgres` и отдаваться через `/api/media/:id` и `/api/reports/:id/document`. Это медленнее, но подходит для бесплатного предварительного этапа.

### Что нужно сделать в Vercel

1. Импортировать репозиторий в `Vercel`
2. Добавить `DATABASE_URL` в Environment Variables
3. При желании подключить `Vercel Blob` и добавить `BLOB_READ_WRITE_TOKEN`
4. Задеплоить проект

Статика из `public/` будет раздаваться Vercel напрямую, а API будет работать через `api/index.js` и `vercel.json`.

`.vercelignore` обязательно исключает локальные `.env`, `.venv-cv`, веса моделей и `data/`. `npm run build` проверяет этот барьер, чтобы пользовательские фото и многогигабайтное ML-окружение не попали в deployment bundle.

## Архитектурные решения

- `MVP0` не зависит от `AI` и полностью закрывает детерминированный workflow
- `V2 skeleton` добавляет отдельный inference-слой и не делает AI источником истины
- реальная пиксельная маска хранится как часть `visualEvidence` и воспроизводится в UI и в акте
- отчёт формируется только из уже сохранённых данных, а не из временного состояния UI
- у дефекта сохраняется AI-предложение вместе с признаком, было ли оно принято или исправлено оператором
- backend теперь отделён от локального сервера: одна и та же API-логика работает и в `npm start`, и в `Vercel Function`

## Репозиторная гигиена

Не коммитить:

- `.venv-cv/`
- `node_modules/`
- `services/cv_inference/models/`
- `data/store.json`
- `data/uploads/`
- `data/reports/`
- `.env`

Эти файлы являются локальным runtime-состоянием или потенциально содержат пользовательские данные. Перед публикацией на GitHub держите в репозитории только исходники, документацию, конфигурацию и `services/cv_inference/requirements.txt`.
