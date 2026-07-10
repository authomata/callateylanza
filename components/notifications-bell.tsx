"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markNotificationsRead } from "@/app/(app)/projects/actions";
import type { Notification } from "@/lib/types";

export function NotificationsBell({ initial, unread }: { initial: Notification[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await markNotificationsRead();
      router.refresh();
    }
  }

  return (
    <div className="relative">
      <button onClick={toggle} className="relative grid h-8 w-8 place-items-center rounded-lg hover:bg-[color-mix(in_srgb,var(--border)_45%,transparent)]">
        <span className="text-base">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-fg">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-[var(--border-card)] bg-surface p-2 shadow-lg">
            <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
              Notificaciones
            </div>
            {initial.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted">Sin novedades.</p>
            ) : (
              <ul className="max-h-80 space-y-0.5 overflow-auto">
                {initial.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.project_id ? `/projects/${n.project_id}` : "/dashboard"}
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-2 py-2 text-xs hover:bg-[color-mix(in_srgb,var(--border)_35%,transparent)] ${
                        n.leido ? "text-muted" : "text-secondary"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.leido && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                        <span>
                          {n.texto}
                          <span className="mt-0.5 block text-[10px] text-muted">
                            {new Date(n.created_at).toLocaleString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
