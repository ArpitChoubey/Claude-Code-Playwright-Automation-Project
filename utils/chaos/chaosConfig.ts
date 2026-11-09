/**
 * Settings for the resilience suite, read from environment variables.
 *
 * Required (the suite is skipped if any is missing):
 *   CHAOS_BASE_URL       URL of the storefront running in the cluster
 *   CHAOS_KUBE_CONTEXT   kubectl context to use. Passed explicitly on every call,
 *                        so the suite never acts on whatever context is current.
 *   CHAOS_APP_SELECTOR   label selector for the app's pods, e.g. "app=storefront"
 *
 * Optional (defaults in brackets):
 *   CHAOS_NAMESPACE            namespace of the app and experiments [chaos-demo]
 *   CHAOS_READY_SELECTOR       CSS selector that proves the page rendered [body]
 *   CHAOS_MIN_REPLICAS         ready pods required for steady state [1]
 *   CHAOS_LOAD_BUDGET_MS       max page load time with no faults [5000]
 *   CHAOS_DEGRADED_BUDGET_MS   max page load time under network latency [15000]
 *   CHAOS_RECOVERY_TIMEOUT_MS  max time to recover after a fault is removed [120000]
 *   CHAOS_SAMPLE_WINDOW_MS     how long to sample availability during pod kill [30000]
 *   CHAOS_SAMPLE_INTERVAL_MS   gap between availability samples [2000]
 *   CHAOS_MIN_SUCCESS_RATE     share of samples that must succeed during pod kill [0.9]
 *   CHAOS_LATENCY              latency injected by the network test [500ms]
 *   CHAOS_ALLOW_PROD_CONTEXT   set to "true" to allow a context whose name contains "prod"
 */

export interface ChaosConfig {
    baseUrl: string;
    kubeContext: string;
    namespace: string;
    appSelector: string;
    appLabels: Record<string, string>;
    readySelector: string;
    minReplicas: number;
    loadBudgetMs: number;
    degradedBudgetMs: number;
    recoveryTimeoutMs: number;
    sampleWindowMs: number;
    sampleIntervalMs: number;
    minSuccessRate: number;
    latency: string;
}

const PROTECTED_NAMESPACES = ['kube-system', 'kube-public', 'kube-node-lease', 'chaos-mesh'];

function num(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} must be a non-negative number, got "${raw}"`);
    }
    return value;
}

/** Parses "app=storefront,tier=web" into { app: 'storefront', tier: 'web' }. */
export function parseLabelSelector(selector: string): Record<string, string> {
    const labels: Record<string, string> = {};
    for (const part of selector.split(',').map(p => p.trim()).filter(Boolean)) {
        const [key, value, ...rest] = part.split('=');
        if (!key || value === undefined || rest.length > 0) {
            throw new Error(
                `CHAOS_APP_SELECTOR only supports equality labels like "app=storefront", got "${part}"`);
        }
        labels[key.trim()] = value.trim();
    }
    if (Object.keys(labels).length === 0) {
        throw new Error('CHAOS_APP_SELECTOR must contain at least one label');
    }
    return labels;
}

/**
 * Returns the config, or a skip reason when the required variables are missing.
 * Throws (rather than skipping) when settings are present but unsafe or invalid,
 * so a misconfiguration fails loudly instead of being silently skipped.
 */
export function loadChaosConfig(): { config?: ChaosConfig; skipReason?: string } {
    const required = ['CHAOS_BASE_URL', 'CHAOS_KUBE_CONTEXT', 'CHAOS_APP_SELECTOR'];
    const missing = required.filter(name => !process.env[name]);
    if (missing.length > 0) {
        return { skipReason: `Resilience suite needs ${missing.join(', ')} (see utils/chaos/chaosConfig.ts)` };
    }

    const kubeContext = process.env.CHAOS_KUBE_CONTEXT!;
    const namespace = process.env.CHAOS_NAMESPACE || 'chaos-demo';

    if (PROTECTED_NAMESPACES.includes(namespace)) {
        throw new Error(`Refusing to inject faults into protected namespace "${namespace}"`);
    }
    if (/prod/i.test(kubeContext) && process.env.CHAOS_ALLOW_PROD_CONTEXT !== 'true') {
        throw new Error(
            `kubectl context "${kubeContext}" looks like production. ` +
            'Set CHAOS_ALLOW_PROD_CONTEXT=true only if you are sure.');
    }

    const minSuccessRate = num('CHAOS_MIN_SUCCESS_RATE', 0.9);
    if (minSuccessRate > 1) {
        throw new Error('CHAOS_MIN_SUCCESS_RATE must be between 0 and 1');
    }

    const appSelector = process.env.CHAOS_APP_SELECTOR!;

    return {
        config: {
            baseUrl: process.env.CHAOS_BASE_URL!,
            kubeContext,
            namespace,
            appSelector,
            appLabels: parseLabelSelector(appSelector),
            readySelector: process.env.CHAOS_READY_SELECTOR || 'body',
            minReplicas: num('CHAOS_MIN_REPLICAS', 1),
            loadBudgetMs: num('CHAOS_LOAD_BUDGET_MS', 5_000),
            degradedBudgetMs: num('CHAOS_DEGRADED_BUDGET_MS', 15_000),
            recoveryTimeoutMs: num('CHAOS_RECOVERY_TIMEOUT_MS', 120_000),
            sampleWindowMs: num('CHAOS_SAMPLE_WINDOW_MS', 30_000),
            sampleIntervalMs: num('CHAOS_SAMPLE_INTERVAL_MS', 2_000),
            minSuccessRate,
            latency: process.env.CHAOS_LATENCY || '500ms',
        },
    };
}
