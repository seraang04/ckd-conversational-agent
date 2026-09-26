import idleStrip from "@/assets/clara-animation/idle.webp";
import listeningStrip from "@/assets/clara-animation/listening.webp";
import speakingStrip from "@/assets/clara-animation/speaking.webp";
import { cn } from "@/lib/utils";

export type ClaraState = "idle" | "speaking" | "listening" | "waiting";

const strips: Record<ClaraState, string> = {
  idle: idleStrip,
  speaking: speakingStrip,
  listening: listeningStrip,
  waiting: idleStrip,
};

const durations: Record<ClaraState, string> = {
  idle: "2.4s",
  speaking: "0.6s",
  listening: "1.2s",
  waiting: "2.8s",
};

type Props = {
  state?: ClaraState;
  alt: string;
  className?: string;
};

/** A quiet four-frame Clara animation. Motion is disabled by reduced-motion preferences. */
export function ClaraMascot({ state = "idle", alt, className }: Props) {
  return (
    <span
      key={state}
      role="img"
      aria-label={alt}
      data-state={state}
      className={cn("clara-mascot block shrink-0", className)}
      style={{
        backgroundImage: `url(${strips[state]})`,
        animationDuration: durations[state],
      }}
    />
  );
}
