import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";

interface UnsavedChangesCtx {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
}

const Ctx = createContext<UnsavedChangesCtx | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const router = useRouter();
  const location = useLocation();

  // Handle browser back/forward/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle internal navigation via TanStack Router
  // We use a history block if supported or subscribe to location changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // TanStack Router 1.x doesn't have a built-in "blocker" like React Router yet
    // but we can listen to the router's subscribe method or use window.history directly.
    // However, the most reliable way to intercept clicks on <Link> in AppShell is to check in the UI.
    // For now, we'll provide the context and the pages will use it.
  }, [hasUnsavedChanges, router]);

  return (
    <Ctx.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUnsavedChanges must be inside UnsavedChangesProvider");
  return ctx;
}
