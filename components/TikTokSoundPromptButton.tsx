"use client";

/** Small overlay control when auto-unmute is blocked by the browser. */
export default function TikTokSoundPromptButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm"
      aria-label={label}
    >
      <span aria-hidden>🔊</span>
      <span>{label}</span>
    </button>
  );
}
