"use client";
import { usePathname } from "next/navigation";
import { SiteNav } from "@/components/ui/site-nav";
import { JarviHostClient } from "@/components/jarvi/jarvi-host-client";

/**
 * Сквозной «хром» сайта, монтируется в layout → присутствует на всех страницах.
 * - SiteNav: на всех страницах КРОМЕ главной (у главной свой глобус-навигатор).
 * - JarviHostClient: на ВСЕХ страницах — живой угловой хост Джарви (заменил мишку;
 *   мишка переехал в TikTok-сферу). Клик → приветствие + общий чат.
 */
export function SiteChrome() {
  const pathname = usePathname();
  const path = pathname.replace(/\/$/, "") || "/";
  const isHome = path === "/";
  // На /ai-bots уже живёт большой Джарви (JarviClient) — угловой хост там не нужен
  // (дубль + второй WebGL-контекст гасил большую голову). Скрываем его на этой странице.
  const isAiBots = path === "/ai-bots";

  return (
    <>
      {!isHome && <SiteNav />}
      {!isAiBots && <JarviHostClient />}
    </>
  );
}
