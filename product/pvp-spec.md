# Fantasy Casino — PvP Arena MVP

## Mission
Сделать PvP-арену, где игроки вызывают друг друга на дуэль, крутят слоты, 
и победитель забирает пот. Должно выглядеть как настоящий продакшн-сервис.

## Что уже есть (не трогать)
- API: POST/GET duels, accept, spin, cancel
- DuelService: create, accept, spin, settle, cancel (с валидацией wallet, ledger, транзакции)
- DB: duels table, duel_events, migration 006
- Frontend: DuelsPage (лобби), DuelPage (live duel)
- SSE: broadcastUser для real-time обновлений
- Wallet: интеграция с балансом, резервирование ставок

## Что нужно сделать

### 1. Backend

#### 1.1 Duel expiry cron
- Каждые 30 секунд чистить expired open duels: refund creator, mark cancelled
- Endpoint: `POST /api/v1/duels/expire` (internal)

#### 1.2 Player duel stats
- `GET /api/v1/players/:id/duel-stats`
- Response: { totalDuels, wins, losses, ties, biggestWin, totalWagered, winRate }
- Считается из duels таблицы (settled дуэли, где player участвовал)

#### 1.3 Leaderboard
- `GET /api/v1/leaderboard/duels`
- Топ-20 игроков по winRate (минимум 5 дуэлей)

### 2. Frontend — Дизайн

#### 2.1 Duel Arena (главная страница дуэли)
- Анимированный баннер статуса с иконками
- Player avatars с анимацией pulse когда их ход
- VS divider с анимированным свечением
- Slot reels с CSS анимацией вращения при spin
- Результат: победитель подсвечен золотом, проигравший затемнён
- Confetti-эффект при победе (CSS-only, без библиотек)

#### 2.2 Duel Lobby (список открытых дуэлей)
- Карточки дуэлей с мини-превью (game type icon, bet amount, player avatar)
- Create duel форма с пресетами ставок (100, 500, 1000, 5000)
- Счётчик активных дуэлей
- Tab: Open | My Duels | History

#### 2.3 Player Profile (страница игрока)
- Win/Loss record с прогресс-баром
- Recent duels list
- Total won/lost

### 3. Тесты
- Duel expiry: создал → подождал → проверил refund
- Duel settlement: оба спина → проверил payout
- Leaderboard: создал 5+ дуэлей → проверил топ

### 4. Что НЕ делать
- Realtime чат (потом)
- Лобби с фильтрами по game type (потом)
- Боты/AI противники (потом)
- Турниры (потом)
