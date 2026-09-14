import { useEffect, useState } from "react";
import { cn } from "@/lib/utils.ts";

const SPLASH_AT = "corridor.splashAt.v2";
const SPLASH_DONE = "corridor.splashDone.v2";
const SPLASH_MS = 3000;
const MIN_AFTER_READY = 1800;
const EXIT_MS = 480;

const STEPS = ["Смотрю ход за сутки", "Сверяю неделю и месяц", "Читаю новости", "Строю коридор"];

export function markSplashStart() {
  try {
    if (!sessionStorage.getItem(SPLASH_AT)) {
      sessionStorage.setItem(SPLASH_AT, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

function isDone(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_DONE) === "1";
  } catch {
    return false;
  }
}

function markDone() {
  try {
    sessionStorage.setItem(SPLASH_DONE, "1");
  } catch {
    /* ignore */
  }
}

function overlayMs(): number {
  if (isDone()) return 0;
  try {
    const at = Number(sessionStorage.getItem(SPLASH_AT) || 0);
    const elapsed = at ? Date.now() - at : 0;
    return Math.max(MIN_AFTER_READY, SPLASH_MS - elapsed);
  } catch {
    return MIN_AFTER_READY;
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
      <div className="splash-glow" aria-hidden="true" />
      <p className="splash-kicker">Прогноз цены</p>
      <h1 className="splash-title" aria-label="Коридор">
        {"Коридор".split("").map((ch, i) => (
          <span key={`${ch}-${i}`} className="splash-letter">
            {ch}
          </span>
        ))}
      </h1>
      <div className="splash-chart" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={cn("splash-bar", i === 5 && "is-now")} />
        ))}
      </div>
      <div className="splash-stage" aria-hidden="true">
        <span className="splash-track" />
        <span className="splash-fill" />
        <span className="splash-node" />
      </div>
      <p className="splash-caption">
        {STEPS.map((line) => (
          <span key={line} className="splash-step">
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

export function SplashOverlay({ onFinished }: { onFinished: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    markSplashStart();
    const rest = overlayMs();
    if (rest < 120) {
      markDone();
      onFinished();
      return;
    }
    const t1 = window.setTimeout(() => setExiting(true), rest);
    const t2 = window.setTimeout(() => {
      markDone();
      onFinished();
    }, rest + EXIT_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // first mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Splash exiting={exiting} />;
}
