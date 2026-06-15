# Сайт колледжа — GitHub Pages + Firebase

Статический сайт колледжа на чистом HTML/CSS/JS с админ-панелью и бэкендом Firebase (Firestore + Auth).

## Структура проекта

```
index.html              — Главная страница
admin/index.html        — Админ-панель
assets/css/style.css    — Стили
js/main.js              — Логика публичного сайта
js/admin.js             — Логика админ-панели
js/firebase-config.js   — Конфигурация Firebase
images/                 — Изображения и favicon
firestore.rules         — Правила безопасности Firestore
404.html                — Редирект для GitHub Pages
```

## Быстрый старт

### 1. Настройка Firebase

1. Перейдите в [Firebase Console](https://console.firebase.google.com/) и создайте проект.
2. Добавьте веб-приложение (иконка `</>`) и скопируйте конфигурацию.
3. Откройте `js/firebase-config.js` и замените значения-заглушки:

```javascript
export const firebaseConfig = {
  apiKey: "ваш-api-key",
  authDomain: "ваш-проект.firebaseapp.com",
  projectId: "ваш-проект",
  storageBucket: "ваш-проект.appspot.com",
  messagingSenderId: "123456789",
  appId: "ваш-app-id"
};
```

4. **Authentication** → Sign-in method → включите **Email/Password**.
5. **Authentication** → Users → **Add user** — создайте учётную запись администратора.
6. **Firestore Database** → Create database → выберите регион (например, `eur3`).
7. Разверните правила безопасности:

```bash
firebase login
firebase init firestore   # выберите существующий проект, укажите firestore.rules и firestore.indexes.json
firebase deploy --only firestore,storage
```

8. **(Рекомендуется)** Включите **Firebase Storage** для загрузки фото в галерею.
   Без Storage фото сохраняются как base64 (лимит ~2 МБ на файл).

### 2. Создание индексов Firestore

При первом использовании Firebase может запросить составные индексы. Перейдите по ссылке из ошибки в консоли браузера или создайте вручную:

| Коллекция | Поля | Порядок |
|-----------|------|---------|
| `news` | `published` ASC, `date` DESC | Составной |
| `comments` | `ip` ASC, `createdAt` DESC | Составной |

### 3. Начальные данные (необязательно)

В Firestore создайте документ `settings/site` с полями:

```json
{
  "collegeName": "Алматинский Технический Колледж",
  "tagline": "Качественное образование для вашего будущего",
  "aboutText": "Описание колледжа...",
  "yearFounded": 2010,
  "studentCount": 1200,
  "teacherCount": 85,
  "specCount": 12,
  "address": "г. Алматы, ул. Абая, 150",
  "phone": "+7 (727) 123-45-67",
  "email": "info@college.kz",
  "socials": {
    "instagram": "https://instagram.com/...",
    "facebook": "https://facebook.com/...",
    "telegram": "https://t.me/..."
  }
}
```

Все остальные данные (новости, специальности, галерея) добавляются через админ-панель.

### 4. Локальный запуск

Для ES-модулей нужен локальный сервер (не открывайте файлы напрямую через `file://`):

```bash
# Python
python -m http.server 8080

# или Node.js
npx serve .
```

Откройте `http://localhost:8080` — сайт, `http://localhost:8080/admin/` — админ-панель.

## Деплой на GitHub Pages

1. Создайте репозиторий на GitHub и загрузите файлы проекта.
2. **Settings** → **Pages** → Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`.
4. Сохраните. Сайт будет доступен по адресу `https://ваш-логин.github.io/имя-репо/`.

> Все пути в проекте относительные — дополнительная настройка не требуется.

Файл `404.html` обеспечивает корректную работу при прямых ссылках на несуществующие страницы (SPA-редирект на главную).

## Подключение собственного домена

1. В настройках GitHub Pages укажите ваш домен (например, `college.kz`).
2. У регистратора домена создайте DNS-записи:
   - **A-записи** → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - или **CNAME** → `ваш-логин.github.io`
3. Включите **Enforce HTTPS** в настройках Pages.
4. Добавьте домен в Firebase Console → **Authentication** → **Authorized domains**.

## Коллекции Firestore

| Коллекция | Описание | Публичный доступ |
|-----------|----------|------------------|
| `settings` | Настройки сайта | Чтение |
| `news` | Новости | Чтение |
| `specializations` | Специальности | Чтение |
| `gallery` | Фотогалерея | Чтение |
| `comments` | Отзывы посетителей | Чтение + создание |
| `applications` | Заявки на поступление | Только создание |

Запись во все коллекции (кроме `comments` и `applications`) — только для авторизованного администратора.

## Админ-панель

URL: `/admin/`

Функции:
- Настройки сайта (название, контакты, соцсети)
- Управление новостями (добавление, редактирование, публикация)
- Управление специальностями (с сортировкой)
- Загрузка фото в галерею
- Просмотр и экспорт заявок (CSV)
- Модерация комментариев

## Производительность

- Критический CSS встроен в `<head>`
- Основной CSS и JS загружаются с `defer`
- Firebase SDK подключается модульно (только используемые модули)
- Изображения галереи с `loading="lazy"`
- Целевой показатель Lighthouse Performance: 90+

## Лицензия

MIT
