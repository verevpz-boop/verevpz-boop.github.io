import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Статический экспорт для GitHub Pages — превращает сайт в чистые HTML/JS/CSS.
  // Бэкенда нет, всё клиентское (R3F, видео по внешним R2-URL), поэтому export безопасен.
  output: "export",

  // GitHub Pages не оптимизирует картинки на лету — отключаем встроенный оптимизатор Next.
  images: { unoptimized: true },

  // Слэш в конце URL → каждая страница это папка/index.html (надёжнее для статики на Pages).
  trailingSlash: true,
};

export default nextConfig;
