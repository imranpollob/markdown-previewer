// localStorage can be missing or throw (private mode, blocked site data, quota),
// so every access is guarded and callers get a plain result instead.

const PREFIX = 'mdp:';

export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored. */
export function writeSetting(key: string, value: string): boolean {
  try {
    localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}
