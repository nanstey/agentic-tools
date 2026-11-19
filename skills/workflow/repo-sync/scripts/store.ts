/** State files under `${XDG_STATE_HOME:-~/.local/state}/repo-sync/`. */
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Event, LastRun } from "./types.ts";

/** A lock older than this belongs to a crashed or hung run. */
export const LOCK_STALE_MS = 30 * 60 * 1000;

export function defaultStateDir(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return join(env.XDG_STATE_HOME || join(home, ".local", "state"), "repo-sync");
}

export type Read = (path: string) => string | null;

export const readOrNull: Read = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Write via a temp file and rename, so a crash never leaves a truncated file. */
function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

/** Whether a process with this pid exists. */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
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
   * process is gone, or that is older than `LOCK_STALE_MS`, is taken over.
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
        const stale = now - mtime >= LOCK_STALE_MS || (pid > 0 && !alive(pid));
        if (!stale) return false;
        // Remove only the lock judged stale: if another run replaced it meanwhile, back off.
        try {
          if (statSync(path).mtimeMs !== mtime || readOrNull(path) !== content) return false;
        } catch {
          continue;
        }
        rmSync(path, { force: true });
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
