import { test as base } from '@playwright/test';
import { ChaosConfig, loadChaosConfig } from '../../utils/chaos/chaosConfig';
import { ChaosClient } from '../../utils/chaos/ChaosClient';

type ChaosFixtures = {
    chaosConfig: ChaosConfig;
    chaos: ChaosClient;
};

export const test = base.extend<ChaosFixtures>({
    chaosConfig: async ({}, use, testInfo) => {
        const { config, skipReason } = loadChaosConfig();
        testInfo.skip(!config, skipReason);
        await use(config!);
    },

    // Teardown always removes the experiments a test applied, even when the test fails,
    // then waits for the app to be healthy again so the next test starts from steady state.
    chaos: async ({ chaosConfig }, use) => {
        const client = new ChaosClient(chaosConfig.kubeContext, chaosConfig.namespace);
        client.verifyPrerequisites();
        client.removeLeftovers();

        await use(client);

        client.removeAll();
        await client.waitForReadyPods(
            chaosConfig.appSelector, chaosConfig.minReplicas, chaosConfig.recoveryTimeoutMs);
    },
});

export { expect } from '@playwright/test';
