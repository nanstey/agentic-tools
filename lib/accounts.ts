export interface Account {
  login: string;
  owners: string[];
  repos: string[];
}

export const NAME = /^[A-Za-z0-9_.-]+$/;

export function strings(value: unknown, where: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string"))
    throw new Error(`${where} must be an array of strings`);
  return value as string[];
}

/** Parse accounts with the validation and diagnostics used by prflow config. */
export function parseAccounts(value: unknown, fail: (msg: string) => never): Account[] {
  const accounts = (value as unknown[]).map((account, i): Account => {
    const where = `accounts[${i}]`;
    if (typeof account !== "object" || account === null) return fail(`${where} must be an object`);
    const record = account as Record<string, unknown>;
    for (const key of Object.keys(record))
      if (!["$comment", "login", "owners", "repos"].includes(key)) fail(`${where}: unknown key "${key}"`);
    if (typeof record.login !== "string" || !NAME.test(record.login)) fail(`${where}.login must be a GitHub login`);
    let owners: string[] = [];
    let repos: string[] = [];
    try {
      owners = strings(record.owners, `${where}.owners`);
      repos = strings(record.repos, `${where}.repos`);
    } catch (e) {
      fail((e as Error).message);
    }
    for (const owner of owners) if (!NAME.test(owner)) fail(`${where}.owners entry "${owner}" must be a GitHub owner`);
    for (const repo of repos) {
      const parts = repo.split("/");
      if (parts.length !== 2 || !parts.every((part) => NAME.test(part))) fail(`${where}.repos entry "${repo}" must be owner/repo`);
    }
    return { login: record.login as string, owners, repos };
  });
  const logins = accounts.map((account) => account.login.toLowerCase());
  const duplicate = logins.find((login, i) => logins.indexOf(login) !== i);
  if (duplicate) fail(`account "${duplicate}" is listed twice`);
  if (accounts.filter(isUnscoped).length > 1) fail("at most one account may have no owners and no repos");
  const claimed = new Map<string, string>();
  for (const account of accounts)
    for (const assignment of [...account.owners.map((owner) => `owner ${owner.toLowerCase()}`), ...account.repos.map((repo) => `repo ${repo.toLowerCase()}`)]) {
      const previous = claimed.get(assignment);
      if (previous && previous !== account.login) fail(`${assignment} is assigned to both ${previous} and ${account.login}`);
      claimed.set(assignment, account.login);
    }
  return accounts;
}

export function isUnscoped(account: Account): boolean {
  return account.owners.length === 0 && account.repos.length === 0;
}

/** Exact repo assignment, then owner assignment, then the first unscoped account. */
export function accountFor(accounts: Account[], slug: string | null): Account | null {
  const unscoped = accounts.find(isUnscoped) ?? null;
  if (!slug) return unscoped;
  const normalized = slug.toLowerCase();
  const owner = normalized.split("/")[0] ?? "";
  return accounts.find((account) => account.repos.some((repo) => repo.toLowerCase() === normalized)) ??
    accounts.find((account) => account.owners.some((name) => name.toLowerCase() === owner)) ??
    unscoped;
}
