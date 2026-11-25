import type { Actor } from "./types.ts";

export type RawActor = { login: string; __typename: string } | null;
export const actor = (value: RawActor): Actor => value ? { login: value.login, typename: value.__typename } : null;
