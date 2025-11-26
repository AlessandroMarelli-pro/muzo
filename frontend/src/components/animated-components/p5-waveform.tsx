import { cn } from '@/lib/utils';
import {
  P5CanvasInstance,
  ReactP5Wrapper,
  SketchProps,
} from '@p5-wrapper/react';
import * as p5 from 'p5';
import { useEffect, useState } from 'react';

// Set p5 on window for p5.sound plugin
(window as any).p5 = p5;

interface P5WaveformProps {
  isPlaying?: boolean;
  className?: string;
  width?: number;
  height?: number;
  tempo: number;
}

type MySketchProps = SketchProps & {
  width: number;
  height: number;
};
//https://editor.p5js.org/chaski/sketches/IlIKtwLfn
// TODO : divide music in beats and get energy of each beat
//https://editor.p5js.org/sobers/sketches/67RuEEGgv
function sketch(p5: P5CanvasInstance<MySketchProps>) {
  let width = 0;
  let height = 0;
  let begin = 0;
  // Random between 0.5 and 1
  let random = 0;
  let random2 = 0;
  let random3 = 0;
  let random4 = 0;
  p5.setup = () => {
    p5.createCanvas(width, height * 0.5);
    p5.frameRate(60);
  };

  p5.updateWithProps = (props) => {
    if (props.width) {
      width = props.width;
    }
    if (props.height) {
      height = props.height * 0.5;
    }
    p5.resizeCanvas(width, height);
    begin = 0;
    random = Math.random() * 0.5 + 0.5;
    random2 = Math.random() * 0.5 + 0.5;
    random3 = Math.random() * 0.5 + 0.5;
    random4 = Math.random() * 0.5 + 0.5;
  };

  p5.draw = () => {
    p5.clear();

    // p5.background('rgba(0, 255, 0, 0.05)');

    //p5.circle(width / 2, height / 2, (40 * begin) / 10);
    // Create a p5.Color object using RGB values.
    let c1 = p5.color(20, 71, 230);
    let c2 = p5.color(0, 188, 125);
    let c3 = p5.color(253, 154, 0);
    let c4 = p5.color(173, 70, 255);
    // Draw the left circle.
    p5.fill(c1);
    p5.rect(0, height, width / 4 - 10, (-random * (height * begin)) / 50);
    p5.fill(c2);
    p5.rect(
      width / 4,
      height,
      width / 4 - 10,
      (-random2 * (height * begin)) / 40,
    );
    p5.fill(c3);
    p5.rect(
      width / 2,
      height,
      width / 4 - 10,
      (-random3 * (height * begin)) / 60,
    );
    p5.fill(c4);
    p5.rect(
      (width / 4) * 3,
      height,
      width / 4 - 10,
      (-random4 * (height * begin)) / 80,
    );
    begin++;
  };
}

export function P5Waveform({
  width,
  height,
  className,
  tempo,
}: P5WaveformProps) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const modTempo = tempo > 140 ? tempo / 2 : tempo;
    const interval = setInterval(
      () => setBeat((beat) => beat + 1),
      (60 * 1000) / modTempo,
    );

    return () => {
      clearInterval(interval);
    };
  }, []);
  return (
    <div className={cn('rounded-md', className)}>
      <ReactP5Wrapper
        sketch={sketch}
        width={width}
        height={height}
        beat={beat}
      />
    </div>
  );
}
