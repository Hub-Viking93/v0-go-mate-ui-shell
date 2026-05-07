import app from "./app";
import { logger } from "./lib/logger";
import { startNotificationsScheduler } from "./lib/notifications-scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Phase 6A — start the proactive notifications scheduler. Fires a
  // tick immediately + every NOTIFICATIONS_SCHEDULER_INTERVAL_MS (default
  // 30 min). Set the env to 0 to disable (e.g. in some test runs).
  startNotificationsScheduler();
});
