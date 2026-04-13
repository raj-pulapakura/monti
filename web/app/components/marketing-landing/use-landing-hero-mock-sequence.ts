'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HERO_MOCK_ANIM_MS } from './constants';
import { getReducedMotionSnapshot, subscribeReducedMotion } from './reduced-motion';

function getServerReducedMotion() {
  return false;
}

export function useLandingHeroMockSequence() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotion,
  );

  const [introVisible, setIntroVisible] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showChips, setShowChips] = useState(false);
  const [previewMasked, setPreviewMasked] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [pulseExpand, setPulseExpand] = useState(false);

  const timeoutIdsRef = useRef<number[]>([]);
  const aliveRef = useRef(true);
  const loopGenerationRef = useRef(0);

  const clearTimers = () => {
    for (const id of timeoutIdsRef.current) {
      clearTimeout(id);
    }
    timeoutIdsRef.current = [];
  };

  const wait = (ms: number, gen: number) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        timeoutIdsRef.current = timeoutIdsRef.current.filter((x) => x !== id);
        if (aliveRef.current && loopGenerationRef.current === gen) resolve();
      }, ms) as unknown as number;
      timeoutIdsRef.current.push(id);
    });

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      loopGenerationRef.current += 1;
      clearTimers();
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIntroVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    clearTimers();
    loopGenerationRef.current += 1;
    const gen = loopGenerationRef.current;

    if (!introVisible || reducedMotion) return;

    const resetForRepeat = () => {
      setShowUser(false);
      setShowThinking(false);
      setShowAssistant(false);
      setShowChips(false);
      setPreviewMasked(true);
      setIsBuilding(true);
      setPulseExpand(false);
    };

    void (async () => {
      let first = true;
      while (aliveRef.current && loopGenerationRef.current === gen) {
        if (!first) {
          resetForRepeat();
          await wait(HERO_MOCK_ANIM_MS.repeatResetPause, gen);
        } else {
          await wait(HERO_MOCK_ANIM_MS.afterIntro, gen);
        }
        if (!aliveRef.current || loopGenerationRef.current !== gen) break;

        setShowUser(true);
        await wait(HERO_MOCK_ANIM_MS.userToThinking, gen);
        if (!aliveRef.current || loopGenerationRef.current !== gen) break;

        setShowThinking(true);
        await wait(HERO_MOCK_ANIM_MS.thinkingToAssistant, gen);
        if (!aliveRef.current || loopGenerationRef.current !== gen) break;

        setShowThinking(false);
        setShowAssistant(true);
        await wait(HERO_MOCK_ANIM_MS.assistantToChips, gen);
        if (!aliveRef.current || loopGenerationRef.current !== gen) break;

        setShowChips(true);
        await wait(HERO_MOCK_ANIM_MS.chipsToPreviewBusy, gen);
        if (!aliveRef.current || loopGenerationRef.current !== gen) break;

        setPreviewMasked(true);
        setIsBuilding(true);
        await wait(HERO_MOCK_ANIM_MS.previewBusyToReady, gen);
        if (!aliveRef.current || loopGenerationRef.current !== gen) break;

        setPreviewMasked(false);
        setIsBuilding(false);
        setPulseExpand(true);
        const pulseId = window.setTimeout(() => {
          if (aliveRef.current && loopGenerationRef.current === gen) {
            setPulseExpand(false);
          }
        }, 720) as unknown as number;
        timeoutIdsRef.current.push(pulseId);

        await wait(HERO_MOCK_ANIM_MS.holdReady, gen);
        first = false;
      }
    })();

    return () => {
      loopGenerationRef.current += 1;
      clearTimers();
    };
  }, [introVisible, reducedMotion]);

  const live = !reducedMotion;
  const displayUser = live ? showUser : true;
  const displayThinking = live ? showThinking : false;
  const displayAssistant = live ? showAssistant : true;
  const displayChips = live ? showChips : true;
  const displayPreviewMasked = live ? previewMasked : false;
  const displayBuilding = live ? isBuilding : false;
  const displayPulseExpand = live ? pulseExpand : false;
  const displayIntroVisible = live ? introVisible : true;

  return {
    rootRef,
    introVisible: displayIntroVisible,
    reducedMotion,
    showUser: displayUser,
    showThinking: displayThinking,
    showAssistant: displayAssistant,
    showChips: displayChips,
    previewMasked: displayPreviewMasked,
    isBuilding: displayBuilding,
    pulseExpand: displayPulseExpand,
  };
}
