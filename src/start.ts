import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

// Redirects, notFound() and thrown Responses are control flow, not failures:
// converting them into the 500 page would swallow the intended status and hide
// the real outcome from the router.
function isControlFlowThrow(error: unknown): boolean {
  if (error instanceof Response) return true;
  if (error == null || typeof error !== "object") return false;
  const candidate = error as {
    statusCode?: unknown;
    status?: unknown;
    isRedirect?: unknown;
    isNotFound?: unknown;
  };
  return (
    candidate.isRedirect === true ||
    candidate.isNotFound === true ||
    typeof candidate.statusCode === "number" ||
    typeof candidate.status === "number"
  );
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isControlFlowThrow(error)) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
