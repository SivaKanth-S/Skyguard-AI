import { useEffect } from 'react';

/**
 * Reveals `.fi` (fade-in) elements by adding `.show` when they enter the viewport.
 * Fixes sections (e.g. Detection Pipeline) that otherwise stay at opacity:0 forever
 * because no IntersectionObserver was ever attached.
 * Includes a safety sweep so dynamically added / already-visible cards never stay hidden.
 */
export default function useReveal(dep) {
  useEffect(() => {
    const revealAll = () => {
      document.querySelectorAll('.fi:not(.show)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92) el.classList.add('show');
      });
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('show');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
      );
      document.querySelectorAll('.fi:not(.show)').forEach((el) => io.observe(el));
      // Safety: reveal anything missed (e.g. content rendered after observe pass)
      const t1 = setTimeout(revealAll, 600);
      const t2 = setTimeout(revealAll, 2000);
      return () => {
        io.disconnect();
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    // No IntersectionObserver (old browser / SSR): show everything.
    revealAll();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
