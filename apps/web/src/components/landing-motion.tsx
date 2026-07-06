"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";


gsap.registerPlugin(useGSAP, ScrollTrigger);


export function LandingMotion() {
  useGSAP(() => {
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        ".hero-visual",
        { opacity: 0, scale: 0.92, y: 48 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1.2,
          ease: "power3.out",
        },
      );

      gsap.utils.toArray<HTMLElement>(".gsap-image-reveal").forEach((item) => {
        gsap.fromTo(
          item,
          { opacity: 0.4, scale: 0.82 },
          {
            opacity: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: item,
              start: "top 85%",
              end: "bottom 30%",
              scrub: true,
            },
          },
        );
      });

      const words = gsap.utils.toArray<HTMLElement>(".scrub-word");
      if (words.length > 0) {
        gsap.fromTo(
          words,
          { opacity: 0.16, y: 18 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.08,
            ease: "none",
            scrollTrigger: {
              trigger: ".scrub-copy",
              start: "top 78%",
              end: "bottom 36%",
              scrub: true,
            },
          },
        );
      }

      const pinTitle = document.querySelector<HTMLElement>(".pin-title");
      const pinSection = document.querySelector<HTMLElement>(".pin-section");
      if (pinTitle && pinSection) {
        ScrollTrigger.create({
          trigger: pinSection,
          start: "top top",
          end: "bottom bottom",
          pin: pinTitle,
          pinSpacing: false,
        });
      }
    });

    return () => media.revert();
  }, []);

  return null;
}
