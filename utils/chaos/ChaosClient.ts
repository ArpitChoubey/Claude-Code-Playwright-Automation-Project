import { execFileSync } from 'child_process';
import { ChaosManifest, MANAGED_BY_LABEL, MANAGED_BY_VALUE } from './experiments';

export interface PodState {
    name: string;
    ready: boolean;
    terminating: boolean;
}

/**
 * Thin wrapper around kubectl for applying and removing Chaos Mesh experiments.
 * Every call passes --context explicitly, and arguments are passed as an array
 * (no shell), so config values can't be interpreted as shell syntax.
 */
export class ChaosClient {
    private readonly applied: ChaosManifest[] = [];

    constructor(private readonly context: string, private readonly namespace: string) {}

    private kubectl(args: string[], input?: string, timeoutMs = 90_000): string {
        try {
            return execFileSync('kubectl', ['--context', this.context, ...args], {
                input,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: timeoutMs,
            });
        } catch (error) {
            const err = error as { stderr?: string; message: string };
            const detail = (err.stderr || err.message).trim();
            throw new Error(`kubectl ${args.join(' ')} failed: ${detail}`);
        }
    }

    /** Fails fast with a clear message if the cluster or Chaos Mesh isn't reachable. */
    verifyPrerequisites(): void {
        this.kubectl(['get', 'namespace', this.namespace]);
        try {
            this.kubectl(['get', 'crd', 'podchaos.chaos-mesh.org', 'networkchaos.chaos-mesh.org']);
        } catch {
            throw new Error(
                'Chaos Mesh CRDs not found. Install Chaos Mesh first: https://chaos-mesh.org/docs/production-installation-using-helm/');
        }
    }

    /** Removes experiments left behind by an earlier run that crashed before cleanup. */
    removeLeftovers(): void {
        this.kubectl([
            'delete', 'podchaos,networkchaos', '-n', this.namespace,
            '-l', `${MANAGED_BY_LABEL}=${MANAGED_BY_VALUE}`, '--ignore-not-found', '--wait=true',
        ]);
    }

    /** Applies an experiment and waits until Chaos Mesh reports it injected. */
    apply(experiment: ChaosManifest): void {
        this.kubectl(['apply', '-f', '-'], JSON.stringify(experiment));
        this.applied.push(experiment);
        this.kubectl([
            'wait', `${experiment.kind.toLowerCase()}/${experiment.metadata.name}`,
            '-n', this.namespace, '--for=condition=AllInjected', '--timeout=60s',
        ]);
    }

    remove(experiment: ChaosManifest): void {
        this.kubectl([
            'delete', experiment.kind.toLowerCase(), experiment.metadata.name,
            '-n', this.namespace, '--ignore-not-found', '--wait=true',
        ]);
        const index = this.applied.indexOf(experiment);
        if (index >= 0) this.applied.splice(index, 1);
    }

    /** Removes every experiment this client applied. Collects errors so one failure doesn't leave the rest running. */
    removeAll(): void {
        const errors: string[] = [];
        for (const experiment of [...this.applied].reverse()) {
            try {
                this.remove(experiment);
            } catch (error) {
                errors.push((error as Error).message);
            }
        }
        if (errors.length > 0) {
            throw new Error(`Failed to remove chaos experiments:\n${errors.join('\n')}`);
        }
    }

    getPods(labelSelector: string): PodState[] {
        const json = JSON.parse(this.kubectl(['get', 'pods', '-n', this.namespace, '-l', labelSelector, '-o', 'json']));
        return (json.items ?? []).map((pod: any) => ({
            name: pod.metadata.name,
            terminating: Boolean(pod.metadata.deletionTimestamp),
            ready: (pod.status?.conditions ?? []).some((c: any) => c.type === 'Ready' && c.status === 'True'),
        }));
    }

    /** Polls until at least `minReady` non-terminating pods are Ready. */
    async waitForReadyPods(labelSelector: string, minReady: number, timeoutMs: number): Promise<void> {
        const deadline = Date.now() + timeoutMs;
        let pods: PodState[] = [];
        while (Date.now() < deadline) {
            pods = this.getPods(labelSelector);
            if (pods.filter(p => p.ready && !p.terminating).length >= minReady) return;
            await new Promise(resolve => setTimeout(resolve, 2_000));
        }
        const summary = pods.map(p => `${p.name} ready=${p.ready} terminating=${p.terminating}`).join(', ') || 'no pods';
        throw new Error(`Fewer than ${minReady} ready pods for "${labelSelector}" after ${timeoutMs}ms: ${summary}`);
    }
}
