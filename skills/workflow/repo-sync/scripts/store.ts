/** State files under `${XDG_STATE_HOME:-~/.local/state}/repo-sync/`. */
import { appendFileSync, closeSync, linkSync, mkdirSync, openSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Event, LastRun } from "./types.ts";
import { defaultStateDir as sharedStateDir, pidAlive, readOrNull } from "../../../../lib/runtime.ts";
export { pidAlive, readOrNull } from "../../../../lib/runtime.ts";
export type { Read } from "../../../../lib/runtime.ts";

/** Maximum age before an unreadable lock can be taken over. */
export const LOCK_STALE_MS = 30 * 60 * 1000;

export function defaultStateDir(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return sharedStateDir("repo-sync", env, home);
}

/** Write via a temp file and rename, so a crash never leaves a truncated file. */
function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

export class Store {
  readonly dir: string;
  private lockContent: string | null = null;
  constructor(dir: string) {
    this.dir = dir;
  }

  private file(name: string): string {
    return join(this.dir, name);
  }

  ensureDir(): void {
    mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Take the run lock. `false` when another live run holds it. A lock whose
   * process is gone, or unreadable and older than `LOCK_STALE_MS`, is taken over.
   */
  tryLock(now: number, alive: (pid: number) => boolean = pidAlive): boolean {
    const path = this.file("lock");
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = openSync(path, "wx");
        const content = JSON.stringify({ pid: process.pid, at: new Date(now).toISOString() });
        writeSync(fd, content);
        closeSync(fd);
        this.lockContent = content;
        return true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        let mtime: number;
        try {
          mtime = statSync(path).mtimeMs;
        } catch {
          continue; // Released between open and stat; retry.
        }
        const content = readOrNull(path);
        let pid = 0;
        try {
          pid = Number((JSON.parse(content ?? "{}") as { pid?: unknown }).pid) || 0;
        } catch {
          // Unreadable lock: judged by age alone.
        }
        const isAlive = pid > 0 && alive(pid);
        const stale = pid > 0 ? !isAlive : now - mtime >= LOCK_STALE_MS;
        if (!stale) return false;
        const renamed = `${path}.stale.${process.pid}`;
        try {
          renameSync(path, renamed);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw e;
        }
        // If the renamed lock is not the one judged stale (or cannot be read), put it back.
        let ours = false;
        try {
          ours = readOrNull(renamed) === content;
        } finally {
          if (!ours) {
            try {
              linkSync(renamed, path);
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== "EEXIST") renameSync(renamed, path);
            }
          }
          rmSync(renamed, { force: true });
        }
        if (ours) continue;
        return false;
      }
    }
    return false;
  }

  unlock(): void {
    if (this.lockContent !== null && readOrNull(this.file("lock")) === this.lockContent) rmSync(this.file("lock"), { force: true });
    this.lockContent = null;
  }

  /** Pause reason (`""` when none was given), or `null` when not paused. */
  paused(): string | null {
    const text = readOrNull(this.file("paused"));
    return text === null ? null : text.trim();
  }

  pause(reason: string): void {
    this.ensureDir();
    writeAtomic(this.file("paused"), `${reason}\n`);
  }

  /** `false` when it was not paused. */
  resume(): boolean {
    const was = this.paused() !== null;
    rmSync(this.file("paused"), { force: true });
    return was;
  }

  readLast(): LastRun | null {
    const text = readOrNull(this.file("last-run.json"));
    if (text === null) return null;
    try {
      const v = JSON.parse(text) as LastRun;
      return v && v.version === 1 && typeof v.repos === "object" ? v : null;
    } catch {
      return null;
    }
  }

  writeLast(state: LastRun): void {
    writeAtomic(this.file("last-run.json"), `${JSON.stringify(state, null, 2)}\n`);
  }

  appendEvents(events: Event[]): void {
    if (events.length) appendFileSync(this.file("events.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  }

  /** Last good `orca-ide repo list --json` output, used when Orca cannot answer. */
  readRepoCache(): string | null {
    return readOrNull(this.file("repos.json"));
  }

  writeRepoCache(text: string): void {
    writeAtomic(this.file("repos.json"), text);
  }
}
