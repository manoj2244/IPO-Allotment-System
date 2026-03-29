import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type BankApiResponse = {
  status: number;
  data?: {
    message?: string;
    list?: Array<{ bank?: string }>;
  };
};

type AddressApiResponse = {
  status: number;
  data?: {
    message?: string;
    list?: Array<{ id: number; province: string; district: string; nagarpalika: string }>;
  };
};

@Injectable()
export class PublicDataService {
  private readonly logger = new Logger(PublicDataService.name);

  private bankCache: { value: string[]; expiresAt: number } | null = null;
  private addressCache:
    | { value: Array<{ id: number; province: string; district: string; nagarpalika: string }>; expiresAt: number }
    | null = null;

  private readonly ttlMs = 1000 * 60 * 60 * 6;

  async getBanks() {
    if (this.bankCache && this.bankCache.expiresAt > Date.now()) {
      return this.bankCache.value;
    }

    try {
      const { data } = await axios.get<BankApiResponse>(
        'https://www.prabhucapital.com/adminapi/v1/public/bank-data',
        { timeout: 10000 },
      );

      const banks = (data?.data?.list || [])
        .map((item) => (item.bank || '').trim())
        .filter((item) => !!item)
        .sort((a, b) => a.localeCompare(b));

      this.bankCache = { value: banks, expiresAt: Date.now() + this.ttlMs };
      return banks;
    } catch (error) {
      this.logger.warn('Failed to fetch bank list from external API');
      return this.bankCache?.value || [];
    }
  }

  async getAddresses() {
    if (this.addressCache && this.addressCache.expiresAt > Date.now()) {
      return this.addressCache.value;
    }

    try {
      const { data } = await axios.get<AddressApiResponse>(
        'https://www.prabhucapital.com/adminapi/v1/public/address',
        { timeout: 10000 },
      );

      const addresses = data?.data?.list || [];
      this.addressCache = { value: addresses, expiresAt: Date.now() + this.ttlMs };
      return addresses;
    } catch (error) {
      this.logger.warn('Failed to fetch address list from external API');
      return this.addressCache?.value || [];
    }
  }
}
