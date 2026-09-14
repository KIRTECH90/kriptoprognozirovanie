import { useEffect, useState } from "react";
import { cn } from "@/lib/utils.ts";

const SPLASH_AT = "corridor.splashAt";
const SPLASH_MS = 1800;
const EXIT_MS = 380;

export function markSplashStart() {
  try {
    if (!sessionStorage.getItem(SPLASH_AT)) {
      sessionStorage.setItem(SPLASH_AT, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

function remainder(): number {
  try {
    const at = Number(sessionStorage.getItem(SPLASH_AT) || 0);
    if (!at) return SPLASH_MS;
    return Math.max(0, SPLASH_MS - (Date.now() - at));
  } catch {
    return SPLASH_MS;
  }
}

export function Splash({ exiting = false }: { exiting?: boolean }) {
  useEffect(() => {
    markSplashStart();
  }, []);

  return (
    <div
      className={cn("splash", exiting && "splash-out")}
      role="status"
      aria-live="polite"
      aria-label="Загрузка прогноза"
    >
      <p className="splash-kicker">Прогноз цены</p>
      <h1 className="splash-title">Коридор</h1>
      <div className="splash-stage" aria-hidden="true">
        <span className="splash-track" />
        <span className="splash-fill" />
        <span className="splash-node" />
      </div>
      <p className="splash-caption">Считаю, где цена будет жить</p>
    </div>
  );
}

export function SplashOverlay({ onFinished }: { onFinished: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    markSplashStart();
    const rest = remainder();
    if (rest < 220) {
      onFinished();
      return;
    }
    const t1 = window.setTimeout(() => setExiting(true), rest);
    const t2 = window.setTimeout(onFinished, rest + EXIT_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // first mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Splash exiting={exiting} />;
}
