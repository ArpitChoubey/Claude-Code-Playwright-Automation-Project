/**
 * Chaos Mesh experiment manifests (https://chaos-mesh.org/docs/).
 * Built in code rather than YAML so namespace, labels and durations come from the config.
 */

export const MANAGED_BY_LABEL = 'app.kubernetes.io/managed-by';
export const MANAGED_BY_VALUE = 'playwright-resilience';

export interface ChaosManifest {
    apiVersion: string;
    kind: 'PodChaos' | 'NetworkChaos';
    metadata: { name: string; namespace: string; labels: Record<string, string> };
    spec: Record<string, unknown>;
}

const API_VERSION = 'chaos-mesh.org/v1alpha1';

function manifest(
    kind: ChaosManifest['kind'], prefix: string, namespace: string, spec: Record<string, unknown>,
): ChaosManifest {
    return {
        apiVersion: API_VERSION,
        kind,
        metadata: {
            // Unique per run; Kubernetes names must be lowercase alphanumerics and '-'.
            name: `${prefix}-${Date.now().toString(36)}`,
            namespace,
            labels: { [MANAGED_BY_LABEL]: MANAGED_BY_VALUE },
        },
        spec,
    };
}

function selector(namespace: string, labels: Record<string, string>) {
    return { namespaces: [namespace], labelSelectors: labels };
}

/** Kills one matching pod. The Deployment/ReplicaSet is expected to replace it. */
export function podKill(namespace: string, labels: Record<string, string>): ChaosManifest {
    return manifest('PodChaos', 'pw-pod-kill', namespace, {
        action: 'pod-kill',
        mode: 'one',
        selector: selector(namespace, labels),
    });
}

/** Makes every matching pod unavailable until the experiment is deleted or the duration ends. */
export function podFailure(
    namespace: string, labels: Record<string, string>, duration: string,
): ChaosManifest {
    return manifest('PodChaos', 'pw-pod-failure', namespace, {
        action: 'pod-failure',
        mode: 'all',
        duration,
        selector: selector(namespace, labels),
    });
}

/** Adds latency to traffic leaving every matching pod. */
export function networkDelay(
    namespace: string, labels: Record<string, string>, latency: string, duration: string,
): ChaosManifest {
    return manifest('NetworkChaos', 'pw-net-delay', namespace, {
        action: 'delay',
        mode: 'all',
        duration,
        selector: selector(namespace, labels),
        direction: 'to',
        delay: { latency, jitter: '50ms', correlation: '0' },
    });
}
