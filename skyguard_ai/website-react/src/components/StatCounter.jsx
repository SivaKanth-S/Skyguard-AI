import React, { useState, useEffect, useRef } from 'react';

export default function StatCounter({ target, isFloat = false, duration = 1400 }) {
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const end = parseFloat(target);
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const factor = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = end * factor;

      setVal(isFloat ? current.toFixed(1) : Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        setVal(isFloat ? end.toFixed(1) : end);
      }
    };

    requestAnimationFrame(update);
  }, [target, isFloat, duration]);

  return <>{val}</>;
}
