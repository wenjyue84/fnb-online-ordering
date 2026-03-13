"use client";

import Image from "next/image";
import { useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  photos: string[];
  alt: string;
  priority?: boolean;
  imagePosition?: string;
  version?: number;
  className?: string;
  sizes?: string;
  onLoad?: () => void;
}

/**
 * Swipeable image carousel with dot indicators.
 * Falls back to a single image if only one photo is provided.
 */
export function ImageCarousel({
  photos,
  alt,
  priority,
  imagePosition,
  version,
  className,
  sizes = "(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 50vw, 33vw",
  onLoad,
}: ImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 30) return; // ignore small swipes
    if (dx < 0) {
      setCurrent((i) => (i + 1) % photos.length);
    } else {
      setCurrent((i) => (i - 1 + photos.length) % photos.length);
    }
  }, [photos.length]);

  const prev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrent((i) => (i - 1 + photos.length) % photos.length);
    },
    [photos.length]
  );

  const next = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrent((i) => (i + 1) % photos.length);
    },
    [photos.length]
  );

  if (!photos.length) return null;

  const src = version ? `${photos[current]}?v=${version}` : photos[current];
  const multiplePhotos = photos.length > 1;

  return (
    <div
      onTouchStart={multiplePhotos ? handleTouchStart : undefined}
      onTouchEnd={multiplePhotos ? handleTouchEnd : undefined}
      className="absolute inset-0"
    >
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover img-scale ${className ?? ""}`}
        style={{ objectPosition: imagePosition || "50% 50%" }}
        sizes={sizes}
        priority={priority && current === 0}
        loading={priority && current === 0 ? "eager" : "lazy"}
        onLoad={current === 0 ? onLoad : undefined}
      />

      {multiplePhotos && (
        <>
          {/* Prev / Next arrow buttons */}
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrent(i);
                }}
                aria-label={`Photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-4 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
