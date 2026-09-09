/**
 * DOM Extractor
 * Extracts structural DOM topology and layout geometry without mutating the live DOM.
 * Conforms to Constitution Principle I (Zero Raw Data Transmission) & Principle III.
 */

import { DomSnapshot, DomSnapshotNode, SanitizedDomNode, SimpleBounds } from "../common/types.js";
import { extractShadowSubtree } from "./shadow-dom-extractor.js";

let nodeIdCounter = 0;

/**
 * Returns a stable or generated identifier for a DOM element.
 */
export function getOrCreateNodeId(el: Element): string {
  if (el.id) {
    return el.id;
  }
  const existingId = el.getAttribute("data-priv-node-id");
  if (existingId) {
    return existingId;
  }
  nodeIdCounter++;
  const generatedId = `node_${nodeIdCounter}`;
  // Store generated ID non-destructively in attribute
  el.setAttribute("data-priv-node-id", generatedId);
  return generatedId;
}

/**
 * Extracts bounding box coordinates from an element.
 */
export function getElementBounds(el: Element): SimpleBounds {
  if (typeof el.getBoundingClientRect === "function") {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(rect.left || rect.x || 0),
      y: Math.round(rect.top || rect.y || 0),
      width: Math.round(rect.width || 0),
      height: Math.round(rect.height || 0)
    };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}

/**
 * Extracts a non-sensitive snapshot of the live DOM.
 * Absolutely preserves all DOM values and node content without modification.
 */
export function extractDomSnapshot(root: Element = document.body): DomSnapshot {
  const nodes: DomSnapshotNode[] = [];
  const rootId = getOrCreateNodeId(root);

  function walk(el: Element, parentId?: string) {
    // Skip script, style, and audit overlay nodes
    const tagName = el.tagName.toLowerCase();
    if (tagName === "script" || tagName === "style" || el.id === "__privacy_audit_overlay") {
      return;
    }

    const nodeId = getOrCreateNodeId(el);
    const bounds = getElementBounds(el);

    // Attributes collection (safe non-sensitive metadata)
    const attributes: Record<string, string> = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (attr.name !== "data-priv-node-id") {
        attributes[attr.name] = attr.value;
      }
    }

    let value: string | undefined;
    let placeholder: string | undefined;

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      value = el.value;
      placeholder = el.placeholder;
    }

    // Direct text content (excluding nested element text to avoid duplication)
    let directText: string | undefined;
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
      const trimmed = el.textContent?.trim();
      if (trimmed) directText = trimmed;
    }

    const childElementIds: string[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      childElementIds.push(getOrCreateNodeId(child));
    }

    nodes.push({
      node_id: nodeId,
      tag: tagName,
      role: el.getAttribute("role") || undefined,
      text: directText,
      value,
      placeholder,
      attributes,
      bounds,
      parent_id: parentId,
      children_ids: childElementIds
    });

    for (let i = 0; i < el.children.length; i++) {
      walk(el.children[i], nodeId);
    }

    // Check for attached open Shadow DOM root
    if ((el as HTMLElement).shadowRoot) {
      const shadowNodes = extractShadowSubtree((el as HTMLElement).shadowRoot!, nodeId);
      for (const sn of shadowNodes) {
        nodes.push(sn);
      }
    }
  }

  walk(root);

  return {
    root_node_id: rootId,
    nodes
  };
}

/**
 * Converts a flat DomSnapshot into a hierarchical SanitizedDomNode tree.
 */
export function snapshotToTree(snapshot: DomSnapshot): SanitizedDomNode {
  const nodeMap = new Map<string, DomSnapshotNode>();
  for (const node of snapshot.nodes) {
    nodeMap.set(node.node_id, node);
  }

  function buildNode(nodeId: string): SanitizedDomNode {
    const raw = nodeMap.get(nodeId);
    if (!raw) {
      return {
        node_id: nodeId,
        tag: "div",
        bounds: { x: 0, y: 0, width: 0, height: 0 }
      };
    }

    const children = raw.children_ids
      .filter(id => nodeMap.has(id))
      .map(id => buildNode(id));

    return {
      node_id: raw.node_id,
      tag: raw.tag,
      role: raw.role,
      bounds: raw.bounds,
      text: raw.value || raw.text,
      attributes: raw.attributes,
      ...(children.length > 0 ? { children } : {})
    };
  }

  return buildNode(snapshot.root_node_id);
}
