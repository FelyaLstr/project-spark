import { afterEach, describe, expect, it, vi } from "vitest";
import { initTelegram } from "./telegram";

type WebAppStub = {
  ready: ReturnType<typeof vi.fn>;
  expand: ReturnType<typeof vi.fn>;
  setHeaderColor?: ReturnType<typeof vi.fn>;
  setBackgroundColor?: ReturnType<typeof vi.fn>;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
};

function stubWebApp(webApp: unknown) {
  vi.stubGlobal("window", { Telegram: webApp === undefined ? undefined : { WebApp: webApp } });
}

function makeWebApp(over: Partial<WebAppStub> = {}): WebAppStub {
  return {
    ready: vi.fn(),
    expand: vi.fn(),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    ...over,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("initTelegram", () => {
  it("falls back to a guest profile outside a browser", () => {
    expect(initTelegram()).toEqual({ name: "Guest Vanguard", isTelegram: false });
  });

  it("falls back to a guest profile when the Telegram bridge is absent", () => {
    stubWebApp(undefined);
    expect(initTelegram()).toEqual({ name: "Guest Vanguard", isTelegram: false });
  });

  it("initializes the mini app and themes the chrome", () => {
    const wa = makeWebApp();
    stubWebApp(wa);
    expect(initTelegram().isTelegram).toBe(true);
    expect(wa.ready).toHaveBeenCalled();
    expect(wa.expand).toHaveBeenCalled();
    expect(wa.setHeaderColor).toHaveBeenCalledWith("#07080f");
    expect(wa.setBackgroundColor).toHaveBeenCalledWith("#07080f");
  });

  it("prefers the first name, then the username, then a generic label", () => {
    stubWebApp(
      makeWebApp({ initDataUnsafe: { user: { id: 1, first_name: "Ada", username: "ada99" } } }),
    );
    expect(initTelegram().name).toBe("Ada");

    stubWebApp(makeWebApp({ initDataUnsafe: { user: { id: 1, username: "ada99" } } }));
    expect(initTelegram().name).toBe("ada99");

    stubWebApp(makeWebApp({ initDataUnsafe: { user: { id: 1 } } }));
    expect(initTelegram().name).toBe("Telegram Player");

    stubWebApp(makeWebApp());
    expect(initTelegram().name).toBe("Telegram Player");
  });

  it("still reports a Telegram profile when the bridge throws", () => {
    const wa = makeWebApp({
      ready: vi.fn(() => {
        throw new Error("bridge exploded");
      }),
      initDataUnsafe: { user: { id: 7, first_name: "Grace" } },
    });
    stubWebApp(wa);
    expect(initTelegram()).toEqual({ name: "Grace", isTelegram: true });
  });

  it("tolerates a bridge without the optional theme setters", () => {
    const wa = makeWebApp();
    delete wa.setHeaderColor;
    delete wa.setBackgroundColor;
    stubWebApp(wa);
    expect(initTelegram().isTelegram).toBe(true);
    expect(wa.expand).toHaveBeenCalled();
  });
});
