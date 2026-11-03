"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type DockedChat = { id: string; name: string; min?: boolean };
export const DOCK_KEY = "influo_docked_chats";
export const DOCK_EVENT = "influo:dock-chat";
const MAX = 3;

export function openDockedChat(chat: DockedChat) {
  window.dispatchEvent(new CustomEvent(DOCK_EVENT, { detail: chat }));
}

function read(): DockedChat[] {
  try {
    const v = JSON.parse(localStorage.getItem(DOCK_KEY) || "[]");
    return Array.isArray(v) ? v.filter((c) => c && typeof c.id === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Facebook-style chat windows docked bottom-right on desktop; survive navigation until closed. */
export default function ChatDock() {
  const pathname = usePathname() || "";
  const [chats, setChats] = useState<DockedChat[]>([]);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChats(read());
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => setDesktop(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    const onOpen = (e: Event) => {
      const c = (e as CustomEvent<DockedChat>).detail;
      if (!c?.id) return;
      setChats((prev) => {
        const next = [{ ...c, min: false }, ...prev.filter((x) => x.id !== c.id)].slice(0, MAX);
        localStorage.setItem(DOCK_KEY, JSON.stringify(next));
        return next;
      });
    };
    const onStorage = (e: StorageEvent) => e.key === DOCK_KEY && setChats(read());
    window.addEventListener(DOCK_EVENT, onOpen);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onMq);
      window.removeEventListener(DOCK_EVENT, onOpen);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const save = (next: DockedChat[]) => {
    setChats(next);
    localStorage.setItem(DOCK_KEY, JSON.stringify(next));
  };

  if (!desktop || !chats.length || pathname.startsWith("/chat-embed") || pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-0 right-4 z-[90] flex items-end gap-3 pointer-events-none">
      {chats.map((c) => (
        <div key={c.id} className="pointer-events-auto w-[340px] overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex h-11 items-center gap-2 bg-slate-900 px-3 text-white">
            <button type="button" onClick={() => save(chats.map((x) => (x.id === c.id ? { ...x, min: !x.min } : x)))} className="min-w-0 flex-1 truncate text-left text-sm font-semibold" title={c.min ? "Άνοιγμα" : "Ελαχιστοποίηση"}>
              {c.name}
            </button>
            <button type="button" aria-label={c.min ? "Άνοιγμα" : "Ελαχιστοποίηση"} onClick={() => save(chats.map((x) => (x.id === c.id ? { ...x, min: !x.min } : x)))} className="h-7 w-7 rounded hover:bg-white/10">
              {c.min ? "▴" : "▾"}
            </button>
            <button type="button" aria-label="Κλείσιμο" onClick={() => save(chats.filter((x) => x.id !== c.id))} className="h-7 w-7 rounded text-lg leading-none hover:bg-white/10">
              ×
            </button>
          </div>
          {!c.min && <iframe title={c.name} src={`/chat-embed?conversation=${encodeURIComponent(c.id)}`} className="block h-[460px] w-full border-0" />}
        </div>
      ))}
    </div>
  );
}
