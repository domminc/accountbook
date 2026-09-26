type Env = Record<string, string | undefined>;
export function projectRef(url: string): string | null;
export function resolveDatabaseUrl(env?: Env): { url: string | null; source: string };
export function resolveSessionSecret(env?: Env): { secret: string | null; source: string };
