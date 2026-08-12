import { afterEach, describe, expect, it, vi } from "vitest";
import { reportLovableError } from "./lovable-error-reporting";

function stubWindow(over: Record<string, unknown> = {}) {
  const captureException = vi.fn();
  const reportRuntimeError = vi.fn();
  vi.stubGlobal("window", {
    location: { pathname: "/arena" },
    __lovableEvents: { captureException },
    __lovableReportRuntimeError: reportRuntimeError,
    ...over,
  });
  return { captureException, reportRuntimeError };
}

afterEach(() => vi.unstubAllGlobals());

describe("reportLovableError", () => {
  it("does nothing outside a browser", () => {
    expect(() => reportLovableError(new Error("ssr"))).not.toThrow();
  });

  it("reports to both editor hooks with boundary metadata", () => {
    const { captureException, reportRuntimeError } = stubWindow();
    const error = new Error("render failed");
    reportLovableError(error, { component: "ArenaScreen" });

    expect(captureException).toHaveBeenCalledWith(
      error,
      { source: "react_error_boundary", route: "/arena", component: "ArenaScreen" },
      { mechanism: "react_error_boundary", handled: false, severity: "error" },
    );
    expect(reportRuntimeError).toHaveBeenCalledWith({
      message: "render failed",
      stack: error.stack,
      filename: "/arena",
    });
  });

  it("summarizes a thrown Response instead of stringifying it", () => {
    const { reportRuntimeError } = stubWindow();
    const response = new Response(null, { status: 404 });
    reportLovableError(response);
    expect(reportRuntimeError.mock.calls[0]![0]!.message).toBe("Response 404");
  });

  it("stringifies non-Error values and omits the stack", () => {
    const { reportRuntimeError } = stubWindow();
    reportLovableError("plain failure");
    expect(reportRuntimeError).toHaveBeenCalledWith({
      message: "plain failure",
      filename: "/arena",
    });
  });

  it("lets caller context override the default route", () => {
    const { captureException } = stubWindow();
    reportLovableError(new Error("x"), { route: "/custom" });
    expect(captureException.mock.calls[0]![1]).toMatchObject({ route: "/custom" });
  });

  it("tolerates a preview without the editor hooks", () => {
    stubWindow({ __lovableEvents: undefined, __lovableReportRuntimeError: undefined });
    expect(() => reportLovableError(new Error("no hooks"))).not.toThrow();
  });
});
