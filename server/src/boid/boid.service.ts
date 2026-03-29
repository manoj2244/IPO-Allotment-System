import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type BoidVerificationResult = {
  verified: boolean;
  capitalCode?: string;
  capitalName?: string;
  source: 'api' | 'cache' | 'fallback';
};

type CapitalItem = {
  code: string;
  id: number;
  name: string;
};

@Injectable()
export class BoidService {
  private readonly logger = new Logger(BoidService.name);
  private readonly cache = new Map<string, { data: BoidVerificationResult; expiresAt: number }>();
  private capitalListCache: { data: CapitalItem[]; expiresAt: number } | null = null;
  private readonly ttlMs = 1000 * 60 * 60 * 6;

  private async fetchCapitals() {
    if (this.capitalListCache && this.capitalListCache.expiresAt > Date.now()) {
      return this.capitalListCache.data;
    }

    try {
      const { data } = await axios.get<CapitalItem[]>(
        'https://webbackend.cdsc.com.np/api/meroShare/capital/',
        { timeout: 10000 },
      );

      const list = Array.isArray(data) ? data : [];
      this.capitalListCache = {
        data: list,
        expiresAt: Date.now() + this.ttlMs,
      };
      return list;
    } catch (error) {
      this.logger.warn('Failed to fetch capital list from CDSC API');
      return this.capitalListCache?.data || [];
    }
  }

  async getCapitalList() {
    return this.fetchCapitals();
  }

  async verify(boid: string): Promise<BoidVerificationResult> {
    const prefix = boid.slice(0, 5);
    const cached = this.cache.get(prefix);

    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.data, source: 'cache' };
    }

    try {
      const capitals = await this.fetchCapitals();
      const found = capitals.find((item) => item.code === prefix);

      const response: BoidVerificationResult = {
        verified: !!found,
        capitalCode: found?.code,
        capitalName: found?.name,
        source: 'api',
      };

      this.cache.set(prefix, { data: response, expiresAt: Date.now() + this.ttlMs });
      return response;
    } catch (error) {
      this.logger.warn(`BOID verification failed for prefix ${prefix}`);
      const fallback = { verified: false, source: 'fallback' } as BoidVerificationResult;
      this.cache.set(prefix, { data: fallback, expiresAt: Date.now() + this.ttlMs });
      return fallback;
    }
  }
}
