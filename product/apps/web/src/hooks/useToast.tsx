import { useState, useCallback } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = nextId++;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  return { toasts, toast };
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-2.5 rounded-xl shadow-2xl text-sm font-medium animate-fade-in-up ${
          t.type === "success" ? "bg-win text-black" : t.type === "error" ? "bg-lose text-white" : "bg-casino-card text-casino-text border border-casino-border"
        }`}>{t.message}</div>
      ))}
    </div>
  );
}
