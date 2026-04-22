"use client";

import { useEffect } from "react";

type ClientLogPayload = {
  kind: "probe-mounted" | "error" | "unhandledrejection";
  href: string;
  userAgent: string;
  message?: string;
  stack?: string;
};

function postClientLog(payload: ClientLogPayload) {
  void fetch("/api/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export function ClientHydrationProbe() {
  useEffect(() => {
    (window as Window & { __BROWSER_MMO_HYDRATED__?: boolean }).__BROWSER_MMO_HYDRATED__ = true;
    postClientLog({
      kind: "probe-mounted",
      href: window.location.href,
      userAgent: navigator.userAgent,
    });

    const onError = (event: ErrorEvent) => {
      postClientLog({
        kind: "error",
        href: window.location.href,
        userAgent: navigator.userAgent,
        message: event.message,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? `${event.reason.name}: ${event.reason.message}`
            : JSON.stringify(event.reason);
      postClientLog({
        kind: "unhandledrejection",
        href: window.location.href,
        userAgent: navigator.userAgent,
        message: reason,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
