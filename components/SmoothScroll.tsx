'use client';

import { useEffect } from 'react';

export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let disposed = false;
    let animationFrame = 0;
    let destroy: (() => void) | undefined;

    void import('lenis')
      .then(({ default: Lenis }) => {
        if (disposed || typeof window === 'undefined') return;

        const lenis = new Lenis();
        const raf = (time: number) => {
          lenis.raf(time);
          animationFrame = window.requestAnimationFrame(raf);
        };
        animationFrame = window.requestAnimationFrame(raf);
        destroy = () => lenis.destroy();
      })
      .catch((error: unknown) => {
        console.error('Unable to initialize smooth scrolling:', error);
      });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      destroy?.();
    };
  }, []);

  return null;
}
