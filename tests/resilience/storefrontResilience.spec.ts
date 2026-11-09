import { test, expect } from './chaosFixture';
import { loadChaosConfig } from '../../utils/chaos/chaosConfig';
import { networkDelay, podFailure, podKill } from '../../utils/chaos/experiments';
import { attachSamples, probe, sampleFor, successRate, timeToRecovery } from './probe';

// Experiments in this file act on a shared cluster, so they must never overlap:
// one file, serial mode. Serial mode also skips the remaining tests if steady state
// fails, so faults are never injected into an app that was already broken.
test.describe('Storefront resilience under chaos @chaos', () => {
    test.describe.configure({ mode: 'serial', retries: 0, timeout: 5 * 60_000 });

    const { config, skipReason } = loadChaosConfig();
    test.skip(!config, skipReason);

    test('steady state: storefront is healthy before any fault', async ({ page, chaos, chaosConfig }) => {
        await chaos.waitForReadyPods(chaosConfig.appSelector, chaosConfig.minReplicas, 60_000);

        const result = await probe(page, chaosConfig, chaosConfig.loadBudgetMs);

        expect(result.ok, result.error).toBe(true);
        expect(result.ms).toBeLessThan(chaosConfig.loadBudgetMs);
    });

    test('pod kill: storefront stays available while a pod is killed', async ({ page, chaos, chaosConfig }, testInfo) => {
        chaos.apply(podKill(chaosConfig.namespace, chaosConfig.appLabels));

        const samples = await sampleFor(page, chaosConfig, chaosConfig.sampleWindowMs);
        await attachSamples(testInfo, 'pod-kill availability samples', samples);

        const rate = successRate(samples);
        const failures = samples.filter(s => !s.ok).map(s => `${s.at}ms: ${s.error}`).join('\n');
        expect(rate, `Success rate ${(rate * 100).toFixed(0)}% during pod kill. Failures:\n${failures}`)
            .toBeGreaterThanOrEqual(chaosConfig.minSuccessRate);
    });

    test('network latency: storefront still renders within the degraded budget', async ({ page, chaos, chaosConfig }) => {
        // Long duration on purpose: the fixture deletes the experiment when the test ends.
        chaos.apply(networkDelay(chaosConfig.namespace, chaosConfig.appLabels, chaosConfig.latency, '10m'));

        const result = await probe(page, chaosConfig, chaosConfig.degradedBudgetMs);

        expect(result.ok, `Storefront failed under ${chaosConfig.latency} latency: ${result.error}`).toBe(true);
        expect(result.ms).toBeLessThan(chaosConfig.degradedBudgetMs);
    });

    test('full outage: storefront recovers after every pod fails', async ({ page, chaos, chaosConfig }, testInfo) => {
        const outage = podFailure(chaosConfig.namespace, chaosConfig.appLabels, '10m');
        chaos.apply(outage);

        // Confirm the fault actually took the storefront down; otherwise the selector
        // is probably targeting the wrong pods and the recovery check would prove nothing.
        await expect.poll(
            async () => (await probe(page, chaosConfig, 5_000)).ok,
            { message: 'Storefront stayed up during the outage. Does CHAOS_APP_SELECTOR match the pods serving it?', timeout: 60_000 },
        ).toBe(false);

        chaos.remove(outage);

        const recoveryMs = await timeToRecovery(page, chaosConfig, chaosConfig.recoveryTimeoutMs);
        await testInfo.attach('recovery time', { body: `${recoveryMs ?? 'did not recover'} ms`, contentType: 'text/plain' });

        expect(recoveryMs, `Storefront did not recover within ${chaosConfig.recoveryTimeoutMs}ms`).not.toBeNull();
    });
});
