import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface BeatVisualizerProps {
  beatData: Array<{ timestamp: number; confidence: number; strength: number }>;
  energyData: Array<{ timestamp: number; energy: number; frequency: number }>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  className?: string;
  height?: number;
}

export function BeatVisualizer({
  beatData,
  energyData,
  currentTime,
  duration,
  isPlaying,
  className,
  height = 40,
}: BeatVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [animationTime, setAnimationTime] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      setAnimationTime((prev) => prev + 0.1);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height: canvasHeight } = canvas;

    // Clear canvas
    ctx.clearRect(0, 0, width, canvasHeight);

    // Draw background
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, width, canvasHeight);

    // Find current beat (unused for now but available for future features)
    // const currentBeat = beatData.find(
    //   (beat) => Math.abs(beat.timestamp - currentTime) < 0.5
    // );

    // Draw energy bars
    const barWidth = width / energyData.length;
    energyData.forEach((energy, index) => {
      const x = index * barWidth;
      const barHeight = energy.energy * canvasHeight;
      const y = canvasHeight - barHeight;

      // Color based on energy level and current time
      const timeAtPosition = energy.timestamp;
      const isCurrent = Math.abs(timeAtPosition - currentTime) < 1;
      const isPast = timeAtPosition < currentTime;

      let color = 'hsl(var(--muted-foreground) / 0.3)';

      if (isCurrent) {
        // Pulsing effect for current energy
        const pulse = Math.sin(animationTime * 10) * 0.3 + 0.7;
        color = `hsl(var(--primary) / ${pulse})`;
      } else if (isPast) {
        color = 'hsl(var(--primary) / 0.6)';
      } else if (energy.energy > 0.7) {
        color = 'hsl(var(--accent) / 0.8)';
      } else if (energy.energy > 0.4) {
        color = 'hsl(var(--accent) / 0.5)';
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });

    // Draw beat markers
    beatData.forEach((beat) => {
      const beatX = (beat.timestamp / duration) * width;
      const isCurrent = Math.abs(beat.timestamp - currentTime) < 0.5;
      const isPast = beat.timestamp < currentTime;

      if (isCurrent) {
        // Highlight current beat with pulsing effect
        const pulse = Math.sin(animationTime * 15) * 0.5 + 0.5;
        ctx.fillStyle = `hsl(var(--destructive) / ${pulse})`;
        ctx.fillRect(beatX - 2, 0, 4, canvasHeight);
      } else if (isPast) {
        ctx.fillStyle = 'hsl(var(--destructive) / 0.6)';
        ctx.fillRect(beatX - 1, 0, 2, canvasHeight);
      } else {
        ctx.fillStyle = 'hsl(var(--destructive) / 0.3)';
        ctx.fillRect(beatX - 1, canvasHeight * 0.2, 2, canvasHeight * 0.6);
      }
    });

    // Draw current time indicator
    const currentX = (currentTime / duration) * width;
    ctx.strokeStyle = 'hsl(var(--foreground))';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, canvasHeight);
    ctx.stroke();
  }, [
    beatData,
    energyData,
    currentTime,
    duration,
    isPlaying,
    animationTime,
    height,
  ]);

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        className="w-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
