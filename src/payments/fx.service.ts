import Stripe from 'stripe';

export type FxSource = 'frankfurter' | 'manual' | 'identity';

export interface FxSnapshot {
  /** USD amount in cents (smallest unit). Always set after snapshot. */
  amountUsdCents: number;
  /** Foreign-currency-per-1-USD. 1.0 for USD. Decimal as string for precision. */
  fxRate: string;
  /** When the rate was captured. */
  fxAsOf: Date;
  /** Origin of the rate. */
  fxSource: FxSource;
}

/**
 * FX snapshot service.
 *
 * Captures the USD-equivalent value of a price at the moment it's published,
 * along with the FX rate that produced it. The snapshot is immutable: the
 * same row will read back the same USD value months later, regardless of
 * current FX rates.
 *
 * Convention:
 *   - amountCents is the smallest unit of the original currency
 *     (cents for USD/EUR/GBP, paise for INR, sen for MYR, etc.)
 *   - fxRate is foreign-per-1-USD (e.g. 83.50 means 1 USD = 83.50 INR)
 *   - amountUsdCents = round((amountCents / fxRate))
 *
 * Source: Frankfurter (https://www.frankfurter.app) — ECB reference rates,
 * free, no API key. Used because Stripe removed its public FX API.
 * The Stripe SDK is kept around as a placeholder for future sources.
 */
export class FxService {
  private stripe: Stripe | null = null;
  private readonly frankfurterUrl =
    process.env.FX_API_URL ?? 'https://api.frankfurter.dev/v1/latest';

  constructor(secretKey?: string) {
    const key = secretKey ?? process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, {
        apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
      });
    }
  }

  /**
   * Snapshot an amount (in original-currency cents) into USD cents.
   *
   * USD short-circuits to identity. Other currencies hit Frankfurter:
   * GET /latest?from=INR&to=USD → { rates: { USD: 0.012 } } (USD per 1 INR).
   */
  async snapshot(amountCents: number, currency: string): Promise<FxSnapshot> {
    const currencyUpper = currency.toUpperCase();

    if (currencyUpper === 'USD') {
      return {
        amountUsdCents: amountCents,
        fxRate: '1.00000000',
        fxAsOf: new Date(),
        fxSource: 'identity',
      };
    }

    const url = `${this.frankfurterUrl}?from=${currencyUpper}&to=USD`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(
        `FX API returned ${res.status} for ${currencyUpper}: ${await res.text()}`,
      );
    }
    const data = (await res.json()) as {
      rates?: Record<string, number>;
      date?: string;
    };

    const usdPerForeign = data.rates?.['USD'];
    if (usdPerForeign === undefined) {
      throw new Error(
        `FX API did not return a USD rate for ${currencyUpper}. ` +
          `Response: ${JSON.stringify(data)}`,
      );
    }

    // USD cents = amountCents × (USD-per-foreign)
    // e.g. 29900 paise × 0.012 = 358.8 → 359 cents
    const amountUsdCents = Math.round(amountCents * usdPerForeign);

    // Display fxRate as foreign-per-1-USD (the more familiar convention),
    // so users see "1 USD ≈ 83.50 INR" rather than "1 INR ≈ 0.012 USD".
    const fxRatePerUsd = 1 / usdPerForeign;

    return {
      amountUsdCents,
      fxRate: this.normalizeRate(fxRatePerUsd),
      fxAsOf: new Date(),
      fxSource: 'frankfurter',
    };
  }

  private normalizeRate(rate: number): string {
    // Pad to 8 decimal places to match Decimal(18, 8) schema precision.
    return rate.toFixed(8);
  }
}

export const fxService = new FxService();