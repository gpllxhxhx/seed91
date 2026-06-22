import { appendLogEntry } from "./desktop-client";

export type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY_PATTERN =
  /token|cookie|password|secret|authorization|account|session|credential/i;

function sanitizeLogValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown {
  if (depth > 4) {
    return "[truncated]";
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeLogValue(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);
    const sanitizedEntries = Object.entries(value).map(([key, entryValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, "[redacted]"] as const;
      }

      return [key, sanitizeLogValue(entryValue, depth + 1, seen)] as const;
    });

    return Object.fromEntries(sanitizedEntries);
  }

  return String(value);
}

export function createLogger(source: string) {
  async function write(
    level: LogLevel,
    message: string,
    context?: unknown
  ): Promise<void> {
    const sanitizedContext =
      context === undefined ? undefined : sanitizeLogValue(context);
    const consoleMethod =
      level === "error" ? console.error : level === "warn" ? console.warn : console.info;

    if (sanitizedContext === undefined) {
      consoleMethod(`[${source}] ${message}`);
    } else {
      consoleMethod(`[${source}] ${message}`, sanitizedContext);
    }

    try {
      await appendLogEntry(level, message, {
        source,
        context: sanitizedContext ?? null
      });
    } catch (error) {
      console.error("[desktop-pet] log write failed", sanitizeLogValue(error));
    }
  }

  return {
    info(message: string, context?: unknown) {
      return write("info", message, context);
    },
    warn(message: string, context?: unknown) {
      return write("warn", message, context);
    },
    error(message: string, context?: unknown) {
      return write("error", message, context);
    }
  };
}
