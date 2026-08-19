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
      data-side={side}
      data-visible={visible && !exiting ? "true" : "false"}
      className={cn(
        "mesurer-screenshot-preview",
        exiting ? "msr:ease-in" : "msr:ease-out",
      )}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "opacity") return;
        if (exiting) onExited();
      }}
    >
      <img src={url} alt="" className="mesurer-screenshot-preview-image" />
    </div>
  );
}
