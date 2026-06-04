"use client";
import { usePathname } from "next/navigation";
import { SiteNav } from "@/components/ui/site-nav";
import { BearBrickClient } from "@/components/BearBrickClient";

/**
 * Сквозной «хром» сайта, монтируется в layout → присутствует на всех страницах.
 * - SiteNav: на всех страницах КРОМЕ главной (у главной свой глобус-навигатор).
 * - BearBrickClient: на ВСЕХ страницах (один кликабельный маскот → один общий чат-бот).
 */
export function SiteChrome() {
  const pathname = usePathname();
  const isHome = (pathname.replace(/\/$/, "") || "/") === "/";

  return (
    <>
      {!isHome && <SiteNav />}
      <BearBrickClient />
    </>
  );
}
