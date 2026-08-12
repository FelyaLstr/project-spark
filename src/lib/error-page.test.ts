import { describe, expect, it } from "vitest";
import { renderErrorPage } from "./error-page";

describe("renderErrorPage", () => {
  const html = renderErrorPage();

  it("returns a standalone html document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
    expect(html).toContain('<meta charset="utf-8" />');
    expect(html).toContain("viewport");
  });

  it("offers a retry and a way home", () => {
    expect(html).toContain("location.reload()");
    expect(html).toContain('href="/"');
    expect(html).toContain("This page didn't load");
  });

  it("inlines its styles so it never needs assets", () => {
    expect(html).toContain("<style>");
    expect(html).not.toContain("<script src");
    expect(html).not.toContain("<link");
  });
});
