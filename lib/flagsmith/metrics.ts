/** Metric and event names configured in the Flagsmith environment. */
export const METRIC_NAMES = {
  submitted: process.env.NEXT_PUBLIC_METRIC_TASK_SUBMITTED || 'priority_task_submitted',
  success: process.env.NEXT_PUBLIC_METRIC_TASK_SUCCESS || 'priority_task_success',
  duration: process.env.NEXT_PUBLIC_METRIC_TASK_DURATION || 'task_duration_seconds',
} as const;

export const METRIC_DEFINITIONS = [
  { name: 'priority_task_submitted', aggregation: 'Mean', direction: 'higher is better', event: 'priority_task_submitted', value: 'consequence_capture in 0..1' },
  { name: 'priority_task_success', aggregation: 'Occurrence', direction: 'higher is better', event: 'priority_task_success', value: 'event emitted when 2+ of 3 picks match the benchmark' },
  { name: 'task_duration_seconds', aggregation: 'Mean', direction: 'lower is better', event: 'task_duration_seconds', value: 'server measured elapsed seconds' },
] as const;
