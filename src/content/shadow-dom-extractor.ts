/**
 * Shadow DOM Subtree Extractor
 * Recursively inspects open and accessible Shadow DOM roots
 * Implements Constitution Article II (Local Vision Processing & Opaque Boundaries).
 */

import { DomSnapshotNode, SimpleBounds } from "../common/types.js";

/**
 * Recursively extracts snapshot nodes from an attached ShadowRoot.
 */
export function extractShadowSubtree(
  shadowRoot: ShadowRoot,
  hostId: string
): DomSnapshotNode[] {
  const nodes: DomSnapshotNode[] = [];

  function traverse(element: Element, parentId?: string): string {
    const nodeId = element.id || `shadow_node_${nodes.length + 1}_${Math.random().toString(36).slice(2, 6)}`;

    const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
    const bounds: SimpleBounds = {
      x: (rect as any).left ?? rect.x ?? 0,
      y: (rect as any).top ?? rect.y ?? 0,
      width: rect.width || 0,
      height: rect.height || 0
    };

    const attributes: Record<string, string> = {};
    if (element.hasAttributes && element.hasAttributes()) {
      for (const attr of Array.from(element.attributes)) {
        attributes[attr.name] = attr.value;
      }
    }

    const text = element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE
      ? (element.textContent || "").trim()
      : undefined;

    const value = (element as HTMLInputElement).value;
    const placeholder = (element as HTMLInputElement).placeholder;

    const node: DomSnapshotNode = {
      node_id: nodeId,
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || undefined,
      text: text || undefined,
      value: value || undefined,
      placeholder: placeholder || undefined,
      attributes,
      bounds,
      parent_id: parentId,
      children_ids: [],
      is_shadow_root: true,
      shadow_host_id: hostId
    };

    nodes.push(node);

    // Recursively traverse light children of shadow root or nested shadow roots
    for (const child of Array.from(element.children)) {
      const childId = traverse(child, nodeId);
      node.children_ids.push(childId);
    }

    // Check for nested shadow roots
    if ((element as HTMLElement).shadowRoot) {
      const nestedNodes = extractShadowSubtree((element as HTMLElement).shadowRoot!, nodeId);
      for (const n of nestedNodes) {
        nodes.push(n);
      }
    }

    return nodeId;
  }

  for (const child of Array.from(shadowRoot.children)) {
    traverse(child, hostId);
  }

  return nodes;
}

/**
 * Searches across all shadow roots in the document for an element matching selector or id.
 */
export function resolveElementInShadowRoots(selectorOrId: string): HTMLElement | null {
  const allElements = Array.from(document.querySelectorAll("*"));
  for (const el of allElements) {
    const shadow = (el as HTMLElement).shadowRoot;
    if (shadow) {
      const found = shadow.getElementById(selectorOrId) ||
        shadow.querySelector(`[id="${selectorOrId}"]`) as HTMLElement ||
        shadow.querySelector(selectorOrId) as HTMLElement;
      if (found) return found;

      // Recursive check nested
      const nestedFound = searchInShadow(shadow, selectorOrId);
      if (nestedFound) return nestedFound;
    }
  }
  return null;
}

function searchInShadow(root: ShadowRoot, selectorOrId: string): HTMLElement | null {
  for (const child of Array.from(root.querySelectorAll("*"))) {
    const nestedShadow = (child as HTMLElement).shadowRoot;
    if (nestedShadow) {
      const found = nestedShadow.getElementById(selectorOrId) ||
        nestedShadow.querySelector(selectorOrId) as HTMLElement;
      if (found) return found;
    }
  }
  return null;
}
