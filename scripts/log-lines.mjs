/**
 * Puts a timestamp in front of every line a child process writes.
 *
 * The live server's log (`config/server.log`, `npm run start >> … 2>&1` from
 * Task Scheduler) had no dates at all: 655 lines by 2026-10-14, among them
 * a `/ask` TypeError and two missing Server Actions that could not be put
 * next to a deploy, an import or a visitor. `next start` prints no time of
 * its own, and the redirect cannot add one — so the launcher does, line by
 * line, when `LOG_TIMESTAMPS=1` (`with-proxy-env.mjs`). Opt-in, because
 * piping the child's output instead of inheriting it is a change to how the
 * live server is started, and the task's command line is the owner's to
 * change.
 *
 * ISO-8601 UTC, like `startedAt` in the task-runner log, so the two can be
 * read against each other. A blank line stays blank.
 */

/** @param {Date} now */
export function formatLogTimestamp(now) {
  return now.toISOString();
}

/**
 * A line-buffered stamper: feed it chunks, it writes whole lines with the
 * time in front, and `flush()` writes a trailing partial line on close.
 *
 * @param {(text: string) => void} write
 * @param {() => Date} [now]
 */
export function createLineStamper(write, now = () => new Date()) {
  let pending = "";

  /** @param {string} line */
  const emit = (line) => {
    write(line.length === 0 ? "\n" : `${formatLogTimestamp(now())} ${line}\n`);
  };

  return {
    /** @param {string} chunk */
    push(chunk) {
      pending += chunk;

      for (
        let newline = pending.indexOf("\n");
        newline !== -1;
        newline = pending.indexOf("\n")
      ) {
        emit(pending.slice(0, newline).replace(/\r$/, ""));
        pending = pending.slice(newline + 1);
      }
    },
    flush() {
      if (pending.length > 0) {
        emit(pending);
        pending = "";
      }
    }
  };
}

/**
 * Copies `source` to `target`, stamping each line; flushes a trailing partial
 * line when the source ends. The target is left open.
 *
 * @param {NodeJS.ReadableStream} source
 * @param {NodeJS.WritableStream} target
 * @param {() => Date} [now]
 */
export function pipeWithTimestamps(source, target, now) {
  const stamper = createLineStamper((text) => target.write(text), now);

  source.setEncoding("utf8");
  source.on("data", (chunk) => stamper.push(String(chunk)));
  source.on("end", () => stamper.flush());
}
