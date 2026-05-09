# Fantasy Casino

Casino product — Fastify + React + TypeScript + PostgreSQL.  
Features delivered autonomously by Hermes Agent.

## Features

### 🏆 Tournament Podium Moment
- ATM run: `tournament-podium-moment`
- Podium popup on rank ≤ 3, glassmorphism + gold gradient + confetti
- Codex review cycle: reject → fix-response → re-review approve
- Demo: [demo-tournament-podium-moment.html](demo-tournament-podium-moment.html)

### 🏁 Tournament Mini-League
- Input: [ORIGINAL_CONTRACT_TOURNAMENT.md](ORIGINAL_CONTRACT_TOURNAMENT.md)
- Output: live at `/tournaments`, E2E: join → rank 13→2, 3100pts

### 🎯 Missions & Quests (Casino-Grade)
- Input: [ORIGINAL_BRIEF_MISSIONS.md](ORIGINAL_BRIEF_MISSIONS.md)
- Output: live at `/missions`, 6 missions, campaign hub, reward modal

### ⚔️ PvP Arena Season 1
- Output: live at `/duels`, duel/accept/spin/settle flow

### 💰 Wallet
- Fixed: `data-page`, `data-ready`, valid ledger dates (no more Invalid Date)

## Routes
`/`, `/missions`, `/tournaments`, `/duels`, `/duels/:id`, `/player`, `/leaderboard`, `/wallet`, `/bonus`, `/achievements`, `/game/:gameId`, `/roulette`, `/kyc`, `/admin`, `/login`, `/health`
