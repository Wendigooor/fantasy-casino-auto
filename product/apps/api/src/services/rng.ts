export interface RNG {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
}

export class ProductionRNG implements RNG {
  nextInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  nextFloat(): number {
    return Math.random();
  }
}

export class DeterministicRNG implements RNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  static create(): DeterministicRNG {
    return new DeterministicRNG(Date.now());
  }

  nextInt(min: number, max: number): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    const value = (this.seed >>> 0) / 0x100000000;
    return Math.floor(value * (max - min + 1)) + min;
  }

  nextFloat(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return ((this.seed >>> 0) / 0x100000000);
  }
}
