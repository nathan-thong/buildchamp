import { z } from 'zod';

const PREFERENCES_STORAGE_KEY = 'buildchamp.preferences.v1';

const PreferencesSchema = z
  .object({
    version: z.literal(1),
    muted: z.boolean(),
  })
  .strict();

export type Preferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  version: 1,
  muted: false,
};

function getBrowserStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readPreferences(storage: Storage | undefined = getBrowserStorage()): Preferences {
  if (!storage) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const rawValue = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = PreferencesSchema.safeParse(JSON.parse(rawValue));
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(
  preferences: Preferences,
  storage: Storage | undefined = getBrowserStorage(),
): void {
  if (!storage) {
    return;
  }

  try {
    const validated = PreferencesSchema.parse(preferences);
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(validated));
  } catch {
    // A storage quota or privacy-mode failure should never prevent the UI from loading.
  }
}

export { PREFERENCES_STORAGE_KEY };
