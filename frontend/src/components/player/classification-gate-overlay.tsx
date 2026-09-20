import { useEffect } from "react";
import { toast } from "sonner";
import {
  useCurrentTrack,
  useDislikeCurrentTrack,
  useTrackClassificationGate,
} from "@/contexts/audio-player-context";
import { useBangerTrack, useLikeTrack } from "@/services/api-hooks";
import { isTypingTarget } from "@/lib/keyboard";

/**
 * A full-app scrim that appears while the playing track is unclassified
 * (neither liked nor bangered). It sits below the player bar so the bar's
 * own classification buttons read as the one live thing on screen, and
 * mirrors /swipe's a/z/e shortcuts so the decision can be made without
 * reaching for the mouse.
 */
export function ClassificationGateOverlay() {
  const { needsClassification } = useTrackClassificationGate();
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const { dislikeCurrentTrack } = useDislikeCurrentTrack();
  const likeMutation = useLikeTrack();
  const bangerMutation = useBangerTrack();

  useEffect(() => {
    if (!needsClassification) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || !currentTrack) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "a") {
        event.preventDefault();
        dislikeCurrentTrack(() => toast.error("Couldn't remove this track. Try again."));
      } else if (event.key === "z") {
        event.preventDefault();
        bangerMutation.mutate(currentTrack.id, {
          onSuccess: (track) => setCurrentTrack(track),
          onError: () => toast.error("Couldn't mark this track as a banger. Try again."),
        });
      } else if (event.key === "e") {
        event.preventDefault();
        likeMutation.mutate(currentTrack.id, {
          onSuccess: (track) => setCurrentTrack(track),
          onError: () => toast.error("Couldn't like this track. Try again."),
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    needsClassification,
    currentTrack,
    likeMutation,
    bangerMutation,
    dislikeCurrentTrack,
    setCurrentTrack,
  ]);

  if (!needsClassification) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-[5.5rem] z-[39] bg-background/80 backdrop-blur-sm duration-200 ease-out animate-in fade-in motion-reduce:animate-none sm:bottom-[4.5rem]"
      aria-hidden
    />
  );
}
