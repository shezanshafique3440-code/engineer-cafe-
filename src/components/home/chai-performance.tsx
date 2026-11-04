"use client";

import Image from "next/image";
import { useId } from "react";

/** Independent photographic fluid layers, with actual animated falling liquid. */
export function ChaiPerformance() {
  const id = useId().replace(/:/g, "");
  return (
    <div className="chai-performance" aria-hidden="true">
      <div className="chai-stage-halo" />
      <div className="chai-landing-shadow" />
      <div className="chai-landing-disc" />
      <Image
        src="/experience/chai-splash.webp"
        alt=""
        width={1824}
        height={1024}
        sizes="(max-width: 600px) 100vw, 46vw"
        className="chai-impact-splash"
      />
      <div className="chai-cup-drop">
        <Image
          src="/experience/chai-cup.webp"
          alt=""
          width={1254}
          height={1254}
          priority
          sizes="(max-width: 600px) 80vw, 34vw"
          className="chai-glass"
        />
        <svg className="chai-steam" viewBox="0 0 150 130" fill="none">
          {[0, 1, 2].map((n) => (
            <path
              key={n}
              d={`M${40 + n * 35} 125 C${10 + n * 35} 90 ${75 + n * 35} 80 ${40 + n * 35} 50 S${55 + n * 35} 15 ${45 + n * 35} 0`}
            />
          ))}
        </svg>
      </div>
      <div className="chai-milk-stream">
        <Image
          src="/experience/chai-stream.webp"
          alt=""
          width={256}
          height={512}
          sizes="110px"
          className="chai-liquid-sprite"
        />
      </div>
      <div className="chai-spill-stream">
        <Image
          src="/experience/chai-stream.webp"
          alt=""
          width={256}
          height={512}
          sizes="110px"
          className="chai-liquid-sprite"
        />
      </div>
      <svg className="chai-liquid-vfx" viewBox="0 0 640 640" fill="none">
        <defs>
          <linearGradient
            id={`${id}-milk`}
            x1="240"
            y1="0"
            x2="330"
            y2="300"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff9e8" />
            <stop offset=".48" stopColor="#f9e1ad" />
            <stop offset="1" stopColor="#d69b50" />
          </linearGradient>
          <linearGradient
            id={`${id}-tea`}
            x1="440"
            y1="300"
            x2="478"
            y2="300"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#9a541d" />
            <stop offset=".28" stopColor="#d39445" />
            <stop offset=".57" stopColor="#f8d993" />
            <stop offset=".76" stopColor="#c98936" />
            <stop offset="1" stopColor="#99551f" />
          </linearGradient>
        </defs>
        <g className="chai-impact-ripples" stroke="#fbe0ac">
          <ellipse cx="385" cy="551" rx="78" ry="17" />
          <ellipse cx="385" cy="551" rx="108" ry="27" />
        </g>
        <g className="chai-droplets">
          {Array.from({ length: 12 }, (_, n) => (
            <ellipse
              key={n}
              className={`chai-droplet chai-droplet-${n}`}
              cx={398 + (n % 4) * 20}
              cy={300 + (n % 3) * 30}
              rx={3 + (n % 3)}
              ry={6 + (n % 4)}
              fill={`url(#${id}-tea)`}
              style={
                {
                  "--drop-x": `${(n - 5) * 13}px`,
                  "--drop-delay": `${n * 0.13}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      </svg>
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className={`chai-ice chai-ice-${n}`}>
          <Image
            src="/experience/ice-cube.webp"
            alt=""
            width={256}
            height={256}
            sizes="100px"
          />
        </div>
      ))}
    </div>
  );
}
