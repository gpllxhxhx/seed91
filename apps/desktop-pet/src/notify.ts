export type NotificationLevel = "info" | "warn" | "error";

type NotifyOptions = {
  durationMs?: number;
};

export function createNotifier(container: HTMLElement) {
  let notificationCounter = 0;

  function show(
    level: NotificationLevel,
    message: string,
    options: NotifyOptions = {}
  ): void {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    const item = document.createElement("div");
    const notificationId = `notification-${notificationCounter += 1}`;
    const durationMs = options.durationMs ?? (level === "error" ? 4800 : 3200);

    item.className = `notification-card is-${level}`;
    item.dataset.notificationId = notificationId;
    item.setAttribute("role", level === "error" ? "alert" : "status");
    item.textContent = trimmedMessage;
    container.append(item);

    window.setTimeout(() => {
      item.classList.add("is-leaving");
      window.setTimeout(() => {
        item.remove();
      }, 180);
    }, durationMs);
  }

  return {
    info(message: string, options?: NotifyOptions) {
      show("info", message, options);
    },
    warn(message: string, options?: NotifyOptions) {
      show("warn", message, options);
    },
    error(message: string, options?: NotifyOptions) {
      show("error", message, options);
    }
  };
}
