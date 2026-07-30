"use client";

import { useEffect, useRef } from "react";

import {
  visibilityAt,
  type VisibilityTransition,
} from "@/lib/skill-graph-visibility-transition";


const GRAPH_VISIBILITY_TRANSITION_MS = 220;


type VisibilityTransitions = Map<string, VisibilityTransition>;


type SkillGraphVisibilityOptions = {
  enabled: boolean;
  labelIds: readonly string[];
  linkIds: readonly string[];
  nodeIds: readonly string[];
  onFrame: () => void;
  reduceMotion: boolean;
  visibleLinkIds?: ReadonlySet<string>;
  visibleNodeIds?: ReadonlySet<string>;
};


function visibilityTarget(
  id: string,
  visibleIds: ReadonlySet<string> | undefined,
) {
  return visibleIds === undefined || visibleIds.has(id) ? 1 : 0;
}


function prepareTransitions(
  ids: readonly string[],
  visibleIds: ReadonlySet<string> | undefined,
  values: Map<string, number>,
  startedAt: number,
  duration: number,
  revealNewValues: boolean,
) {
  const transitions: VisibilityTransitions = new Map();
  const currentIds = new Set(ids);

  for (const id of values.keys()) {
    if (!currentIds.has(id)) values.delete(id);
  }

  for (const id of ids) {
    const target = visibilityTarget(id, visibleIds);
    const from = values.get(id) ?? (revealNewValues ? 0 : target);
    values.set(id, from);
    if (Math.abs(from - target) < 0.001) {
      values.set(id, target);
      continue;
    }
    transitions.set(id, { from, to: target, startedAt, duration });
  }

  return transitions;
}


function updateValues(
  transitions: VisibilityTransitions,
  values: Map<string, number>,
  now: number,
  reduceMotion: boolean,
) {
  let running = false;
  transitions.forEach((transition, id) => {
    const value = visibilityAt(transition, now, reduceMotion);
    values.set(id, value);
    if (Math.abs(value - transition.to) >= 0.001) running = true;
  });
  return running;
}


export function useSkillGraphVisibility({
  enabled,
  labelIds,
  linkIds,
  nodeIds,
  onFrame,
  reduceMotion,
  visibleLinkIds,
  visibleNodeIds,
}: SkillGraphVisibilityOptions) {
  const frameRef = useRef(0);
  const initializedRef = useRef(false);
  const labelValuesRef = useRef<Map<string, number>>(new Map());
  const linkValuesRef = useRef<Map<string, number>>(new Map());
  const nodeValuesRef = useRef<Map<string, number>>(new Map());
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    if (!enabled) return;

    window.cancelAnimationFrame(frameRef.current);
    const startedAt = window.performance.now();
    const duration = reduceMotion ? 0 : GRAPH_VISIBILITY_TRANSITION_MS;
    const revealNewValues = initializedRef.current;
    const nodeTransitions = prepareTransitions(
      nodeIds,
      visibleNodeIds,
      nodeValuesRef.current,
      startedAt,
      duration,
      revealNewValues,
    );
    const linkTransitions = prepareTransitions(
      linkIds,
      visibleLinkIds,
      linkValuesRef.current,
      startedAt,
      duration,
      revealNewValues,
    );
    const labelTransitions = prepareTransitions(
      nodeIds,
      new Set(labelIds),
      labelValuesRef.current,
      startedAt,
      duration,
      revealNewValues,
    );
    initializedRef.current = true;

    const renderFrame = (now: number) => {
      const nodesRunning = updateValues(
        nodeTransitions,
        nodeValuesRef.current,
        now,
        reduceMotion,
      );
      const linksRunning = updateValues(
        linkTransitions,
        linkValuesRef.current,
        now,
        reduceMotion,
      );
      const labelsRunning = updateValues(
        labelTransitions,
        labelValuesRef.current,
        now,
        reduceMotion,
      );

      onFrameRef.current();
      if (nodesRunning || linksRunning || labelsRunning) {
        frameRef.current = window.requestAnimationFrame(renderFrame);
      } else {
        frameRef.current = 0;
      }
    };

    renderFrame(startedAt);
    return () => {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [
    enabled,
    labelIds,
    linkIds,
    nodeIds,
    reduceMotion,
    visibleLinkIds,
    visibleNodeIds,
  ]);

  return { labelValuesRef, linkValuesRef, nodeValuesRef };
}
