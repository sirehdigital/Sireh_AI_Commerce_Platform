export type MetricLabels = Readonly<Record<string, string>>;

export interface DurationSummary {
  readonly count: number;
  readonly totalMs: number;
  readonly averageMs: number;
  readonly minMs: number;
  readonly maxMs: number;
}

export interface MetricSample<TValue> {
  readonly name: string;
  readonly labels: MetricLabels;
  readonly value: TValue;
}

export interface MetricsSnapshot {
  readonly generatedAt: string;
  readonly storageMode: "process-local";
  readonly persistent: false;
  readonly counters: readonly MetricSample<number>[];
  readonly gauges: readonly MetricSample<number>[];
  readonly durations: readonly MetricSample<DurationSummary>[];
  readonly limitations: readonly string[];
}

interface DurationAccumulator {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
}

const MAX_LABEL_LENGTH = 80;
const SAFE_LABEL_PATTERN = /^[a-zA-Z0-9:._/\-\s]+$/u;

export class ProcessLocalMetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly durations = new Map<string, DurationAccumulator>();

  public constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  public incrementCounter(name: string, labels: MetricLabels = {}, amount = 1): void {
    const key = this.createKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + amount);
  }

  public setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    this.gauges.set(this.createKey(name, labels), value);
  }

  public observeDuration(name: string, durationMs: number, labels: MetricLabels = {}): void {
    const boundedDuration = Math.max(0, durationMs);
    const key = this.createKey(name, labels);
    const current = this.durations.get(key);

    if (current === undefined) {
      this.durations.set(key, {
        count: 1,
        totalMs: boundedDuration,
        minMs: boundedDuration,
        maxMs: boundedDuration,
      });
      return;
    }

    current.count += 1;
    current.totalMs += boundedDuration;
    current.minMs = Math.min(current.minMs, boundedDuration);
    current.maxMs = Math.max(current.maxMs, boundedDuration);
  }

  public snapshot(): MetricsSnapshot {
    return {
      generatedAt: this.now(),
      storageMode: "process-local",
      persistent: false,
      counters: [...this.counters.entries()].map(([key, value]) => this.toSample(key, value)),
      gauges: [...this.gauges.entries()].map(([key, value]) => this.toSample(key, value)),
      durations: [...this.durations.entries()].map(([key, value]) =>
        this.toSample(key, {
          count: value.count,
          totalMs: value.totalMs,
          averageMs: value.count === 0 ? 0 : value.totalMs / value.count,
          minMs: value.minMs,
          maxMs: value.maxMs,
        }),
      ),
      limitations: [
        "Process-local metrics only.",
        "Metrics reset when the process restarts.",
        "No external telemetry or persistent storage is configured.",
      ],
    };
  }

  private createKey(name: string, labels: MetricLabels): string {
    const safeLabels = Object.entries(labels)
      .map(([labelName, labelValue]) => [this.safeLabel(labelName), this.safeLabel(labelValue)] as const)
      .sort(([left], [right]) => left.localeCompare(right));

    return JSON.stringify({ name: this.safeMetricName(name), labels: safeLabels });
  }

  private toSample<TValue>(key: string, value: TValue): MetricSample<TValue> {
    const parsed = JSON.parse(key) as { readonly name: string; readonly labels: readonly (readonly [string, string])[] };

    return {
      name: parsed.name,
      labels: Object.fromEntries(parsed.labels),
      value,
    };
  }

  private safeMetricName(value: string): string {
    return this.safeLabel(value);
  }

  private safeLabel(value: string): string {
    const trimmed = value.trim().slice(0, MAX_LABEL_LENGTH);

    if (trimmed.length === 0 || !SAFE_LABEL_PATTERN.test(trimmed)) {
      return "invalid";
    }

    return trimmed;
  }
}
