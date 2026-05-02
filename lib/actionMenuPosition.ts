import type { CSSProperties } from 'react';

const GAP = 4;
const VIEWPORT_PAD = 8;

/**
 * Posiciona um dropdown `position: fixed` alinhado ao canto direito do alvo,
 * abrindo para baixo ou para cima conforme o espaço no viewport, e limita
 * a altura com scroll para não ficar cortado.
 */
export function layoutFixedActionMenu(trigger: DOMRect): CSSProperties {
  const right = window.innerWidth - trigger.right;
  const spaceBelow = window.innerHeight - trigger.bottom - VIEWPORT_PAD;
  const spaceAbove = trigger.top - VIEWPORT_PAD;

  const openDown = spaceBelow >= spaceAbove;

  if (openDown) {
    return {
      top: trigger.bottom + GAP,
      right,
      maxHeight: Math.max(88, spaceBelow - GAP),
      overflowY: 'auto',
    };
  }

  return {
    bottom: window.innerHeight - trigger.top + GAP,
    right,
    maxHeight: Math.max(88, spaceAbove - GAP),
    overflowY: 'auto',
  };
}
