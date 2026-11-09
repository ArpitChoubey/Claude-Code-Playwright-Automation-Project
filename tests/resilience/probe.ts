import { Page, TestInfo } from '@playwright/test';
import { ChaosConfig } from '../../utils/chaos/chaosConfig';

export interface Sample {
    /** Milliseconds since sampling started. */
    at: number;
    ok: boolean;
    status?: number;
    ms: number;
    error?: string;
}

/** Loads the storefront once. Success means a status below 400 and the ready selector visible. */
export async function probe(page: Page, config: ChaosConfig, timeoutMs: number): Promise<Omit<Sample, 'at'>> {
    const start = Date.now();
    try {
        const response = await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        const status = response?.status();
        if (status === undefined || status >= 400) {
            return { ok: false, status, ms: Date.now() - start, error: `HTTP ${status ?? 'no response'}` };
        }
        const remaining = Math.max(1_000, timeoutMs - (Date.now() - start));
        await page.locator(config.readySelector).first().waitFor({ state: 'visible', timeout: remaining });
        return { ok: true, status, ms: Date.now() - start };
    } catch (error) {
        return { ok: false, ms: Date.now() - start, error: (error as Error).message.split('\n')[0] };
    }
}

/** Probes repeatedly for `windowMs`, waiting `config.sampleIntervalMs` between probes. */
export async function sampleFor(page: Page, config: ChaosConfig, windowMs: number): Promise<Sample[]> {
    const samples: Sample[] = [];
    const start = Date.now();
    while (Date.now() - start < windowMs) {
        const at = Date.now() - start;
        samples.push({ at, ...(await probe(page, config, config.loadBudgetMs)) });
        await page.waitForTimeout(config.sampleIntervalMs);
    }
    return samples;
}

/** Probes until the storefront succeeds. Returns ms until the first success, or null on timeout. */
export async function timeToRecovery(page: Page, config: ChaosConfig, timeoutMs: number): Promise<number | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const result = await probe(page, config, config.loadBudgetMs);
        if (result.ok) return Date.now() - start;
        await page.waitForTimeout(config.sampleIntervalMs);
    }
    return null;
}

export function successRate(samples: Sample[]): number {
    return samples.length === 0 ? 0 : samples.filter(s => s.ok).length / samples.length;
}

/** Attaches the raw samples to the HTML and Allure reports for later analysis. */
export async function attachSamples(testInfo: TestInfo, name: string, samples: Sample[]): Promise<void> {
    await testInfo.attach(name, {
        body: JSON.stringify(samples, null, 2),
        contentType: 'application/json',
    });
}
