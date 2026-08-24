const EVENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

type SseMessageOptions = {
  id?: string;
  retry?: number;
};

function singleLine(value: string) {
  return value.replace(/[\r\n\0]/g, "").slice(0, 200);
}

export function formatSseEvent(event: string, data: unknown, options: SseMessageOptions = {}) {
  if (!EVENT_NAME_PATTERN.test(event)) throw new Error("Invalid SSE event name");

  const lines: string[] = [];
  const id = options.id ? singleLine(options.id) : "";
  if (id) lines.push(`id: ${id}`);

  if (options.retry !== undefined) {
    if (!Number.isInteger(options.retry) || options.retry < 1_000 || options.retry > 60_000) {
      throw new Error("Invalid SSE retry interval");
    }
    lines.push(`retry: ${options.retry}`);
  }

  lines.push(`event: ${event}`);
  const serialized = JSON.stringify(data) ?? "null";
  for (const line of serialized.split(/\r?\n/)) lines.push(`data: ${line}`);
  return `${lines.join("\n")}\n\n`;
}

export function formatSseComment(comment: string) {
  return `: ${singleLine(comment)}\n\n`;
}
