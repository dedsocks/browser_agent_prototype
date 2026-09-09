/**
 * Ephemeral Incremental State Cache
 * Caches verified redaction outputs by region fingerprint hash.
 * Implements Constitution Principle XI (Incremental State Processing).
 */

import { CachedRegionRedaction } from "../common/types.js";

export class IncrementalStateCache {
  private cache: Map<string, CachedRegionRedaction> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  public get(fingerprintHash: string): CachedRegionRedaction | undefined {
    const item = this.cache.get(fingerprintHash);
    if (item) {
      this.hits++;
      return item;
    }
    this.misses++;
    return undefined;
  }

  public set(fingerprintHash: string, result: CachedRegionRedaction): void {
    this.cache.set(fingerprintHash, result);
  }

  public has(fingerprintHash: string): boolean {
    return this.cache.has(fingerprintHash);
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public getHitRate(): { hits: number; misses: number; ratio: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      ratio: total > 0 ? this.hits / total : 0
    };
  }
}
