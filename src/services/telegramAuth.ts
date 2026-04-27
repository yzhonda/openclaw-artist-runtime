export function getTelegramOwnerUserIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env.TELEGRAM_OWNER_USER_IDS?.trim();
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export function assertOwner(userId: string | number, env: NodeJS.ProcessEnv = process.env): boolean {
  const owners = getTelegramOwnerUserIds(env);
  if (owners.size === 0) {
    return false;
  }
  return owners.has(String(userId));
}
