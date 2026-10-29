export function createLoop(tick: (dt: number) => void): { start: () => void; stop: () => void } {
  let raf = 0;
  let last = 0;
  let running = false;

  const frame = (now: number) => {
    if (!running) return;
    if (document.hidden) {
      last = now;
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt);
    raf = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
