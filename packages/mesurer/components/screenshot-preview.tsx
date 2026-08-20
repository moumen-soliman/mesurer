
type ScreenshotPreviewProps = {
  url: string;
  side: "top" | "bottom";
  label: string;
  onExited: () => void;
};

export function ScreenshotPreview({
  url,
  side,
  label,
  onExited,
}: ScreenshotPreviewProps) {
  return (
    <div
      role="status"
      aria-label={label}
      data-side={side}
      className="mesurer-screenshot-preview"
      onAnimationEnd={(event) => {
        if (
          event.animationName === "mesurer-screenshot-preview" ||
          event.animationName === "mesurer-screenshot-preview-reduced"
        ) {
          onExited();
        }
      }}
    >
      <img src={url} alt="" className="mesurer-screenshot-preview-image" />
    </div>
  );
}
