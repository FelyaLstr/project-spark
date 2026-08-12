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

/** Safe no-op in a normal browser so local testing never needs Telegram. */
export function initTelegram(): TelegramProfile {
  const wa = getWebApp();
  if (!wa) return { name: "Guest Vanguard", isTelegram: false };
  try {
    wa.ready();
    wa.expand();
    wa.setHeaderColor?.("#07080f");
    wa.setBackgroundColor?.("#07080f");
  } catch (error) {
    // A failing host bridge must not block the game, but it should be visible:
    // the theming/expand calls are what break first inside Telegram clients.
    console.warn("Telegram WebApp initialization failed; continuing without host chrome", error);
  }
  const u = wa.initDataUnsafe?.user;
  return { name: u?.first_name || u?.username || "Telegram Player", isTelegram: true };
}
