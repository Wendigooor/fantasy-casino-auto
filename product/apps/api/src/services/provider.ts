export interface GameProvider {
  readonly id: string;
  readonly name: string;

  spin(
    userId: string,
    walletId: string,
    gameId: string,
    betAmount: number,
    currency: string
  ): Promise<{
    roundId: string;
    reels?: number[];
    winAmount: number;
    metadata?: Record<string, unknown>;
  }>;
}

export class InternalSlotProvider implements GameProvider {
  readonly id = "internal";
  readonly name = "Internal Slot Engine";

  private rng: () => number;

  constructor(seed?: number) {
    if (seed !== undefined) {
      let s = seed;
      this.rng = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    } else {
      this.rng = Math.random;
    }
  }

  setRngFunction(fn: () => number): void {
    this.rng = fn;
  }

  async spin(
    _userId: string,
    _walletId: string,
    _gameId: string,
    betAmount: number,
    _currency: string
  ) {
    const reels = [0, 1, 2, 3, 4].map(() => Math.floor(this.rng() * 7));
    const winAmount = this.calculateWin(reels, betAmount);

    return {
      roundId: "",
      reels,
      winAmount,
    };
  }

  private calculateWin(reels: number[], betAmount: number): number {
    const counts: Record<number, number> = {};
    for (const symbol of reels) {
      counts[symbol] = (counts[symbol] || 0) + 1;
    }
    const maxMatch = Math.max(...Object.values(counts));
    if (maxMatch >= 3) {
      const multipliers: Record<number, number> = { 0: 0.5, 1: 1, 2: 1.5, 3: 2, 4: 3, 5: 5, 6: 10 };
      const matchingSymbol = Object.entries(counts).find(([, c]) => c === maxMatch)?.[0];
      if (matchingSymbol !== undefined) {
        return Math.floor(betAmount * (multipliers[parseInt(matchingSymbol)] || 1));
      }
    }
    return 0;
  }
}

export class ProviderRegistry {
  private providers = new Map<string, GameProvider>();

  register(provider: GameProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): GameProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): GameProvider[] {
    return [...this.providers.values()];
  }
}
