import { useEffect, useMemo, useRef, useState } from 'react';

import { BUNDLED_CHAMPION_SNAPSHOT } from '../data/runtime-snapshot';
import type { ChampionSnapshot, Slot as SnapshotSlot } from '../data/snapshot-schema';
import { SLOT_METADATA, SLOT_ORDER, type Slot } from '../domain/slots';
import { SlotGlyph } from './SlotGlyph';

const ROTATION_INTERVAL_MS = 3_200;

type PreviewIcon = {
  readonly id: string;
  readonly src: string;
  readonly splashSrc?: string;
  readonly sourceName: string;
  readonly componentName: string;
};

type PreviewFrame = readonly (PreviewIcon | null)[];
type IconPools = Readonly<Record<Slot, readonly PreviewIcon[]>>;

type HomeSlotCarouselProps = {
  readonly snapshot?: ChampionSnapshot;
};

const SNAPSHOT_SLOT_BY_DISPLAY_SLOT: Readonly<Record<Slot, SnapshotSlot>> = {
  Body: 'body',
  Q: 'q',
  W: 'w',
  E: 'e',
  R: 'r',
  Passive: 'passive',
};

export function HomeSlotCarousel({ snapshot = BUNDLED_CHAMPION_SNAPSHOT }: HomeSlotCarouselProps) {
  const iconPools = useMemo(() => createIconPools(snapshot), [snapshot]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<PreviewFrame>(() => createRandomFrame(iconPools));
  const frameRef = useRef(frame);
  const loadingNextFrameRef = useRef(false);
  const [loadedSources, setLoadedSources] = useState<ReadonlySet<string>>(() => new Set());
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(() => new Set());
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [isFrameFailed, setIsFrameFailed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isOnscreen, setIsOnscreen] = useState(true);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => document.visibilityState !== 'hidden',
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    const element = carouselRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsOnscreen(entry?.isIntersecting ?? true),
      { threshold: 0.05 },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      setIsDocumentVisible(document.visibilityState !== 'hidden');
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isOnscreen || !isDocumentVisible) {
      return;
    }

    let cancelled = false;
    const markLoaded = (source: string) => {
      if (!cancelled) {
        setLoadedSources((currentSources) => {
          if (currentSources.has(source)) {
            return currentSources;
          }

          return new Set(currentSources).add(source);
        });
      }
    };

    void findLoadedFrame(frameRef.current, iconPools, markLoaded).then((loadedFrame) => {
      if (cancelled) {
        return;
      }

      if (loadedFrame) {
        frameRef.current = loadedFrame;
        setLoadedSources(new Set(frameSources(loadedFrame)));
        setFrame(loadedFrame);
        setIsFrameReady(true);
        setIsFrameFailed(false);
      } else {
        setIsFrameFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [iconPools, isDocumentVisible, isOnscreen]);

  useEffect(() => {
    if (
      !isFrameReady ||
      !isOnscreen ||
      !isDocumentVisible ||
      prefersReducedMotion ||
      isPaused ||
      isFrameFailed
    ) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      if (loadingNextFrameRef.current) {
        return;
      }

      const nextFrame = createRandomFrame(iconPools, frameRef.current);
      loadingNextFrameRef.current = true;

      void preloadFrame(nextFrame, (source) => {
        if (!cancelled) {
          setLoadedSources((currentSources) => {
            if (currentSources.has(source)) {
              return currentSources;
            }

            return new Set(currentSources).add(source);
          });
        }
      })
        .then((loaded) => {
          if (!cancelled && loaded) {
            frameRef.current = nextFrame;
            setLoadedSources(new Set(frameSources(nextFrame)));
            setFrame(nextFrame);
          }
        })
        .finally(() => {
          if (!cancelled) {
            loadingNextFrameRef.current = false;
          }
        });
    }, ROTATION_INTERVAL_MS);

    return () => {
      cancelled = true;
      loadingNextFrameRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [
    iconPools,
    isDocumentVisible,
    isFrameFailed,
    isFrameReady,
    isOnscreen,
    isPaused,
    prefersReducedMotion,
  ]);

  const bodyIcon = frame[0] ?? null;
  const bodySplashLoaded = Boolean(
    bodyIcon?.splashSrc &&
    loadedSources.has(bodyIcon.splashSrc) &&
    !failedSources.has(bodyIcon.splashSrc),
  );
  const frameState = isFrameFailed ? 'error' : isFrameReady ? 'ready' : 'loading';

  function handleImageError(source: string) {
    setFailedSources((currentSources) => {
      if (currentSources.has(source)) {
        return currentSources;
      }

      return new Set(currentSources).add(source);
    });
  }

  return (
    <div ref={carouselRef} className="home-slot-carousel">
      <div
        aria-label="Illustrative champion artwork preview"
        className="home-build-card__art"
        data-frame-state={frameState}
        data-body-preview-id={bodySplashLoaded ? bodyIcon?.id : undefined}
        role="img"
      >
        {bodySplashLoaded && bodyIcon?.splashSrc ? (
          <img
            alt=""
            aria-hidden="true"
            className="home-build-card__splash"
            data-preview-id={bodyIcon.id}
            decoding="async"
            height="1080"
            key={bodyIcon.id}
            onError={() => handleImageError(bodyIcon.splashSrc!)}
            src={bodyIcon.splashSrc}
            width="1920"
          />
        ) : (
          <div className="home-build-card__art-fallback">
            <span>{isFrameFailed ? 'Artwork unavailable' : 'Illustrative preview'}</span>
            <strong>{bodyIcon?.sourceName ?? 'BuildChamp'}</strong>
          </div>
        )}
      </div>
      <div
        aria-label="Six build slots"
        className="home-build-card__slots"
        data-frame-ready={isFrameReady}
        role="group"
      >
        {SLOT_ORDER.map((slot, index) => {
          const icon = frame[index] ?? iconPools[slot][0] ?? null;
          const hasLoadedIcon = Boolean(
            icon && loadedSources.has(icon.src) && !failedSources.has(icon.src),
          );

          return (
            <div
              aria-label={`${slot} slot. ${icon?.componentName ?? 'Component preview'} from ${icon?.sourceName ?? 'BuildChamp'}`}
              className="home-build-card__slot"
              data-carousel-slot={slot}
              data-component-name={icon?.componentName}
              data-icon-id={icon?.id}
              data-source-champion={icon?.sourceName}
              key={slot}
              role="group"
            >
              <span className="home-build-card__slot-index">{SLOT_METADATA[slot].index}</span>
              {hasLoadedIcon && icon ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="home-build-card__slot-icon home-build-card__slot-icon--loaded"
                  decoding="async"
                  height="48"
                  key={icon.id}
                  onError={() => handleImageError(icon.src)}
                  src={icon.src}
                  width="48"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="home-build-card__slot-icon home-build-card__slot-icon--empty"
                >
                  <SlotGlyph slot={slot} />
                </span>
              )}
              <strong>{icon?.componentName ?? SLOT_METADATA[slot].label}</strong>
              <span className="home-build-card__slot-source">{icon?.sourceName ?? 'Loading'}</span>
            </div>
          );
        })}
      </div>
      <div className="home-slot-carousel__footer">
        <p>Source champions and components are shown for reference.</p>
        <button
          aria-label={isPaused ? 'Play preview rotation' : 'Pause preview rotation'}
          aria-pressed={isPaused}
          className="home-slot-carousel__pause"
          onClick={() => setIsPaused((paused) => !paused)}
          type="button"
        >
          {isPaused ? 'Play preview' : 'Pause preview'}
        </button>
      </div>
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) {
      return;
    }

    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.('change', updatePreference);

    return () => mediaQuery.removeEventListener?.('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

function createIconPools(snapshot: ChampionSnapshot): IconPools {
  const pools = {} as Record<Slot, PreviewIcon[]>;

  for (const slot of SLOT_ORDER) {
    pools[slot] = [];
  }

  for (const champion of snapshot.champions) {
    if (champion.excluded) {
      continue;
    }

    addUniqueIcon(pools.Body, {
      id: champion.id,
      src: champion.assetRefs.icon,
      splashSrc: champion.assetRefs.defaultSplash,
      componentName: 'Body',
      sourceName: champion.name,
    });

    for (const variant of champion.variants) {
      for (const slot of SLOT_ORDER) {
        if (slot === 'Body') {
          continue;
        }

        const component = variant.components[SNAPSHOT_SLOT_BY_DISPLAY_SLOT[slot]];
        if (component.availability.status === 'unavailable') {
          continue;
        }

        addUniqueIcon(pools[slot], {
          id: `${champion.id}-${variant.id}-${component.id}`,
          src: component.iconRef,
          componentName: component.name,
          sourceName: champion.name,
        });
      }
    }
  }

  return pools;
}

function addUniqueIcon(pool: PreviewIcon[], icon: PreviewIcon) {
  if (!pool.some((existingIcon) => existingIcon.src === icon.src)) {
    pool.push(icon);
  }
}

function createRandomFrame(iconPools: IconPools, currentFrame?: PreviewFrame): PreviewFrame {
  return SLOT_ORDER.map((slot, index) =>
    chooseRandomIcon(iconPools[slot], currentFrame?.[index]?.id),
  );
}

function chooseRandomIcon(pool: readonly PreviewIcon[], currentId?: string): PreviewIcon | null {
  if (pool.length === 0) {
    return null;
  }

  const candidates =
    currentId && pool.length > 1 ? pool.filter((icon) => icon.id !== currentId) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0] ?? null;
}

async function preloadFrame(
  frame: PreviewFrame,
  onImageLoaded?: (source: string) => void,
): Promise<boolean> {
  const uniqueSources = frameSources(frame);
  const results = await Promise.all(
    uniqueSources.map((source) => preloadImage(source, () => onImageLoaded?.(source))),
  );
  return results.every(Boolean);
}

function frameSources(frame: PreviewFrame): readonly string[] {
  const sources = frame.flatMap((icon) =>
    icon ? [icon.src, ...(icon.splashSrc ? [icon.splashSrc] : [])] : [],
  );
  return [...new Set(sources)];
}

async function findLoadedFrame(
  initialFrame: PreviewFrame,
  iconPools: IconPools,
  onImageLoaded: (source: string) => void,
): Promise<PreviewFrame | null> {
  let candidate = initialFrame;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await preloadFrame(candidate, onImageLoaded)) {
      return candidate;
    }

    candidate = createRandomFrame(iconPools, candidate);
  }

  return null;
}

function preloadImage(source: string, onLoaded: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      if (typeof image.decode !== 'function') {
        onLoaded();
        resolve(true);
        return;
      }

      void image
        .decode()
        .then(() => {
          onLoaded();
          resolve(true);
        })
        .catch(() => resolve(false));
    };
    image.onerror = () => resolve(false);
    image.src = source;
  });
}
