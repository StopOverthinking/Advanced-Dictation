import { useEffect, useState } from "react";

const HIDE_SCROLL_DISTANCE = 26;
const SHOW_SCROLL_DISTANCE = 72;
const TOP_VISIBLE_RANGE = 140;

export function useFilterBarVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let downScrollAccum = 0;
    let upScrollAccum = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (currentScrollY <= TOP_VISIBLE_RANGE) {
        downScrollAccum = 0;
        upScrollAccum = 0;
        setIsVisible(true);
        lastScrollY = currentScrollY;
        return;
      }

      if (Math.abs(delta) < 2) {
        lastScrollY = currentScrollY;
        return;
      }

      if (delta > 0) {
        downScrollAccum += delta;
        upScrollAccum = 0;

        if (downScrollAccum >= HIDE_SCROLL_DISTANCE) {
          setIsVisible(false);
          downScrollAccum = 0;
        }
      } else {
        upScrollAccum += Math.abs(delta);
        downScrollAccum = 0;

        if (upScrollAccum >= SHOW_SCROLL_DISTANCE) {
          setIsVisible(true);
          upScrollAccum = 0;
        }
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return isVisible;
}
