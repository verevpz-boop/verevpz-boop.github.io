"use client";
import Link from "next/link";
import { motion } from "motion/react";

/**
 * Две двери входа — главная развилка сайта (решение Pavel'а):
 *   РАБОТЫ → /work (шоурил: кино, фэшн, гейминг, тех, тикток)
 *   СТУДИЯ → /studio (услуги: боты, автоматизация, 3D-сайты, instagram)
 * Мягкие, вписанные в космос зоны (перо-края, без жёсткой рамки), но явно
 * кликабельные: при наведении — золотой glow + лёгкий зум. Анимации по Эмилю
 * (transform+opacity, ease-out, reduced-motion безопасен через motion).
 * Лежат оверлеем в нижней части глобус-героя (глобус виден сверху).
 */
const EASE = [0.16, 1, 0.3, 1] as const;

export function EntryDoors() {
  return (
    <motion.div
      className="pz-doors pointer-events-none absolute bottom-24 left-0 right-0 z-20 flex justify-center gap-5 px-5"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 1.0, ease: EASE }}
    >
      {/* ── РАБОТЫ ── */}
      <Link href="/work" className="pz-door pointer-events-auto" aria-label="Работы — шоурил">
        <span className="pz-aura" />
        <span className="pz-glow" />
        <span className="pz-scene" aria-hidden="true">
          <span className="pz-plate p1" />
          <span className="pz-plate p2" />
          <span className="pz-plate p3" />
          <span className="pz-bear">
            <span className="ear el" /><span className="ear er" />
            <span className="head" /><span className="body" />
          </span>
        </span>
        <span className="pz-label">
          <span className="pz-kick">01 — шоурил</span>
          <span className="pz-title">РАБОТЫ</span>
          <span className="pz-sub">кино · фэшн · гейминг · тех · тикток</span>
        </span>
      </Link>

      {/* ── СТУДИЯ ── */}
      <Link href="/studio" className="pz-door pz-door--studio pointer-events-auto" aria-label="Студия — услуги">
        <span className="pz-aura" />
        <span className="pz-glow" />
        <span className="pz-scene" aria-hidden="true">
          <svg viewBox="0 0 220 150" width="100%" height="100%">
            <defs>
              <linearGradient id="pzM" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#c7ccd4" /><stop offset="1" stopColor="#5a606b" />
              </linearGradient>
              <radialGradient id="pzC" cx="38%" cy="34%" r="70%">
                <stop offset="0" stopColor="#f3dc97" /><stop offset="0.6" stopColor="#d2a955" /><stop offset="1" stopColor="#a87f31" />
              </radialGradient>
            </defs>
            <ellipse cx="118" cy="138" rx="40" ry="9" fill="#000" opacity="0.4" />
            <rect x="96" y="118" width="44" height="18" rx="8" fill="url(#pzM)" />
            <circle cx="118" cy="118" r="10" fill="#3a3d45" stroke="#C9A961" strokeWidth="1.3" />
            <rect x="109" y="58" width="17" height="64" rx="8" fill="url(#pzM)" transform="rotate(-24 118 118)" />
            <rect x="92" y="60" width="70" height="13" rx="6" fill="url(#pzM)" transform="rotate(-30 92 66)" />
            <circle cx="92" cy="66" r="8" fill="#3a3d45" stroke="#C9A961" strokeWidth="1.3" />
            <rect x="150" y="22" width="13" height="4" rx="2" fill="#5a5e68" transform="rotate(-52 152 34)" />
            <rect x="150" y="34" width="13" height="4" rx="2" fill="#5a5e68" transform="rotate(-12 152 34)" />
            <circle cx="152" cy="34" r="6" fill="#3a3d45" stroke="#C9A961" strokeWidth="1.1" />
            <circle cx="176" cy="20" r="13" fill="url(#pzC)" stroke="#7a5d22" strokeWidth="1" />
            <text x="176" y="25" textAnchor="middle" fontSize="11" fontWeight="800" fill="#5a3f12">$</text>
            <circle cx="48" cy="40" r="11" fill="url(#pzC)" stroke="#7a5d22" strokeWidth="1" />
            <text x="48" y="44" textAnchor="middle" fontSize="8" fontWeight="800" fill="#5a3f12">AI</text>
          </svg>
        </span>
        <span className="pz-label">
          <span className="pz-kick">02 — что я делаю</span>
          <span className="pz-title">СТУДИЯ</span>
          <span className="pz-sub">боты · автоматизация · 3D-сайты</span>
        </span>
      </Link>

      <style jsx>{`
        .pz-door {
          position: relative;
          width: 300px;
          max-width: 42vw;
          min-height: 230px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 12px 10px 6px;
          text-decoration: none;
          color: inherit;
          transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }
        .pz-door:hover { transform: scale(1.025); }
        .pz-door:active { transform: scale(0.99); }
        .pz-aura, .pz-glow {
          position: absolute; inset: -8% -4% -2%; border-radius: 50% / 40%;
          pointer-events: none;
        }
        .pz-aura {
          background: radial-gradient(62% 56% at 50% 42%, rgba(201,169,97,0.1), rgba(201,169,97,0) 72%);
          filter: blur(8px);
        }
        .pz-door--studio .pz-aura {
          background: radial-gradient(62% 56% at 50% 42%, rgba(150,170,190,0.11), rgba(150,170,190,0) 72%);
        }
        .pz-glow {
          background: radial-gradient(58% 52% at 50% 42%, rgba(201,169,97,0.22), transparent 70%);
          opacity: 0; filter: blur(6px);
          transition: opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }
        .pz-door:hover .pz-glow { opacity: 1; }

        .pz-scene { position: relative; height: 140px; z-index: 1; display: block; }

        /* plates (РАБОТЫ) */
        .pz-scene { perspective: 760px; }
        .pz-plate {
          position: absolute; left: 50%; top: 40%; width: 56px; height: 92px;
          margin: -46px 0 0 -28px; border-radius: 8px;
          border: 1px solid rgba(201,169,97,0.3);
          box-shadow: 0 10px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .p1 { background: linear-gradient(160deg, #3a2a3f, #1b1622); transform: translateX(-58px) translateZ(-30px) rotateY(22deg) scale(0.86); }
        .p2 { background: linear-gradient(160deg, #234047, #142226); transform: translateX(-4px) translateZ(28px) rotateY(3deg) scale(1); }
        .p3 { background: linear-gradient(160deg, #2a2f40, #161a24); transform: translateX(52px) translateZ(-26px) rotateY(-20deg) scale(0.86); }
        .pz-bear {
          position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%);
          width: 44px; height: 54px; z-index: 5;
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.6));
        }
        .pz-bear .head { position: absolute; left: 9px; top: 11px; width: 26px; height: 23px; border-radius: 8px; background: radial-gradient(60% 50% at 38% 32%, #e8d6ad, #c6ab78); border: 1px solid rgba(201,169,97,0.5); }
        .pz-bear .ear { position: absolute; top: 5px; width: 12px; height: 12px; border-radius: 50%; background: radial-gradient(60% 60% at 40% 35%, #e8d6ad, #b89a66); border: 1px solid rgba(201,169,97,0.45); }
        .pz-bear .el { left: 5px; } .pz-bear .er { right: 5px; }
        .pz-bear .body { position: absolute; left: 6px; top: 30px; width: 32px; height: 24px; border-radius: 10px 10px 8px 8px; background: radial-gradient(60% 50% at 40% 28%, #ddc89c, #b89a66); border: 1px solid rgba(201,169,97,0.45); }

        .pz-door--studio .pz-scene { display: flex; align-items: flex-end; justify-content: center; perspective: none; }

        .pz-label { position: relative; z-index: 4; text-align: center; margin-top: 4px; }
        .pz-kick { display: block; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(201,169,97,0.8); }
        .pz-title { display: block; margin: 4px 0 2px; font-family: var(--font-cormorant), serif; font-weight: 400; font-size: 30px; letter-spacing: 0.14em; color: rgba(245,241,232,0.95); }
        .pz-door:hover .pz-title { color: #fff; }
        .pz-sub { display: block; font-size: 11px; letter-spacing: 0.05em; color: rgba(245,241,232,0.5); }

        @media (max-width: 640px) {
          .pz-door { min-height: 190px; }
          .pz-scene { height: 104px; }
          .pz-title { font-size: 24px; }
          .pz-sub { font-size: 10px; }
        }
      `}</style>
    </motion.div>
  );
}
