import { useLayoutEffect, useState } from "react";
import { cn } from "../core/utils";

const ENTER_MS = 160;
const HOLD_MS = 5000;

type ScreenshotPreviewProps = {
  url: string;
  ownerWindow: Window;
  side: "top" | "bottom";
  onExited: () => void;
};

export function ScreenshotPreview({
  url,
  ownerWindow,
  side,
  onExited,
}: ScreenshotPreviewProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useLayoutEffect(() => {
    const prefersReducedMotion = ownerWindow.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const enterId = ownerWindow.requestAnimationFrame(() => {
      setVisible(true);
    });
    const holdId = ownerWindow.setTimeout(
      () => {
        if (prefersReducedMotion) {
          onExited();
          return;
        }
        setExiting(true);
      },
      prefersReducedMotion ? HOLD_MS : HOLD_MS + ENTER_MS,
    );
    return () => {
      ownerWindow.cancelAnimationFrame(enterId);
      ownerWindow.clearTimeout(holdId);
    };
  }, [onExited, ownerWindow, url]);

  return (
    <div
      role="status"
      aria-label="Screenshot copied"
      className={cn(
        "mesurer-screenshot-preview msr:pointer-events-none msr:absolute msr:left-1/2 msr:z-10 msr:w-max msr:-translate-x-1/2 msr:overflow-hidden msr:rounded-[10px]",
        side === "bottom" ? "msr:top-full msr:mt-2" : "msr:bottom-full msr:mb-2",
        visible && !exiting ? "msr:opacity-100" : "msr:opacity-0",
        exiting ? "msr:ease-in" : "msr:ease-out",
      )}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "opacity") return;
        if (exiting) onExited();
      }}
    >
      <div className="msr:flex msr:h-7 msr:items-center msr:gap-1.5 msr:bg-[#ececec] msr:px-2.5">
        <span className="msr:size-2.5 msr:rounded-full msr:bg-[#ff5f57]" />
        <span className="msr:size-2.5 msr:rounded-full msr:bg-[#febc2e]" />
        <span className="msr:size-2.5 msr:rounded-full msr:bg-[#28c840]" />
      </div>
      <img
        src={url}
        alt=""
        className="msr:block msr:max-h-32 msr:max-w-48 msr:bg-white msr:object-contain"
      />
    </div>
  );
}
