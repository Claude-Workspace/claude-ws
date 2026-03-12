import { CollisionDetection } from '@dnd-kit/core';

/**
 * Custom collision detector for mobile status tabs.
 * Triggers when ANY point along the left edge (top-left to bottom-left) of the dragging element
 * reaches the droppable area. This provides a larger hit area and more intuitive drag experience
 * on mobile where users want to see the drop target activate as soon as the leading edge touches it.
 */
export const leftEdgeCollisionDetector: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableContainers, active } = args;

  if (!pointerCoordinates || !active) {
    return [];
  }

  // Get the dragging rectangle (the active node's current transformed position)
  const activeRect = active.rect.current.translated;
  if (!activeRect) {
    return [];
  }

  // Get left edge coordinates and height of the dragging element
  const leftX = activeRect.left;
  const topY = activeRect.top;
  const bottomY = activeRect.bottom;

  const collisions: Array<{ id: string | number }> = [];

  for (const container of droppableContainers) {
    const containerRect = container.rect.current;
    if (!containerRect) continue;

    // Check if ANY point along the left edge is within the container
    // This means the left edge X must be within container's horizontal bounds
    // AND the vertical ranges must overlap (any Y from topY to bottomY is within container)
    const horizontalWithin = leftX >= containerRect.left && leftX <= containerRect.right;
    const verticalOverlaps = topY <= containerRect.bottom && bottomY >= containerRect.top;

    if (horizontalWithin && verticalOverlaps) {
      collisions.push({
        id: container.id,
      });
    }
  }

  return collisions;
};
