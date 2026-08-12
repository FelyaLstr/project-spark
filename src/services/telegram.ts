type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  colorScheme?: string;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

export type TelegramProfile = { name: string; isTelegram: boolean };

const MAX_NAME_LENGTH = 32;

// initDataUnsafe is unverified client-supplied data per Telegram's docs: usable
// for cosmetics only, never for identity or authorization, and only after control
// characters are stripped and the length is clamped.
function sanitizeName(value: string | undefined): string {
  return (value ?? "")
    .replace(/[\p{C}]/gu, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/** Safe no-op in a normal browser so local testing never needs Telegram. */
export function initTelegram(): TelegramProfile {
  const wa = getWebApp();
  if (!wa) return { name: "Guest Vanguard", isTelegram: false };
  try {
    wa.ready();
    wa.expand();
    wa.setHeaderColor?.("#07080f");
    wa.setBackgroundColor?.("#07080f");
  } catch {
    /* ignore */
  }
  const u = wa.initDataUnsafe?.user;
  const name = sanitizeName(u?.first_name) || sanitizeName(u?.username);
  return { name: name || "Telegram Player", isTelegram: true };
}
