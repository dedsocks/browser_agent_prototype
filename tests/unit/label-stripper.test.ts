import { describe, it, expect } from "vitest";
import {
  findAssociatedLabels,
  isSensitiveDescriptorText
} from "../../src/privacy/label-stripper.js";
import { DomSnapshotNode, SimpleBounds } from "../../src/common/types.js";

describe("VLM Contextual Blindness - Adjacent Label Stripper", () => {
  it("identifies sensitive descriptor strings matching the denylist", () => {
    expect(isSensitiveDescriptorText("Credit Card Number:")).toBe(true);
    expect(isSensitiveDescriptorText("SSN / Tax ID")).toBe(true);
    expect(isSensitiveDescriptorText("Enter your password")).toBe(true);
    expect(isSensitiveDescriptorText("CVV/CVC")).toBe(true);
    expect(isSensitiveDescriptorText("Aadhaar Number")).toBe(true);
    expect(isSensitiveDescriptorText("Shipping Address Line 1")).toBe(false);
    expect(isSensitiveDescriptorText("Search Query")).toBe(false);
  });

  it("identifies associated labels by explicit 'for' attribute", () => {
    const sensitiveNode: DomSnapshotNode = {
      node_id: "cc-input",
      tag: "input",
      bounds: { x: 100, y: 150, width: 200, height: 30 },
      attributes: { id: "cc-input" },
      children_ids: []
    };

    const labelNode: DomSnapshotNode = {
      node_id: "cc-label",
      tag: "label",
      text: "Card Number:",
      bounds: { x: 100, y: 120, width: 100, height: 20 },
      attributes: { for: "cc-input" },
      children_ids: []
    };

    const labels = findAssociatedLabels(sensitiveNode, [labelNode, sensitiveNode]);
    expect(labels.map((l: DomSnapshotNode) => l.node_id)).toContain("cc-label");
  });

  it("identifies associated labels by aria-labelledby and aria-label", () => {
    const sensitiveNode: DomSnapshotNode = {
      node_id: "ssn-input",
      tag: "input",
      bounds: { x: 50, y: 100, width: 150, height: 30 },
      attributes: { "aria-labelledby": "ssn-heading" },
      children_ids: []
    };

    const headingNode: DomSnapshotNode = {
      node_id: "ssn-heading",
      tag: "span",
      text: "Social Security Number:",
      bounds: { x: 50, y: 70, width: 150, height: 20 },
      attributes: { id: "ssn-heading" },
      children_ids: []
    };

    const labels = findAssociatedLabels(sensitiveNode, [headingNode, sensitiveNode]);
    expect(labels.map((l: DomSnapshotNode) => l.node_id)).toContain("ssn-heading");
  });

  it("identifies adjacent descriptor elements within 50px spatial proximity threshold", () => {
    const sensitiveNode: DomSnapshotNode = {
      node_id: "pass-input",
      tag: "input",
      bounds: { x: 100, y: 100, width: 200, height: 30 },
      attributes: {},
      children_ids: []
    };

    // Label 30px above sensitive input (within 50px)
    const adjacentDescriptor: DomSnapshotNode = {
      node_id: "desc-pass",
      tag: "div",
      text: "Account Password",
      bounds: { x: 100, y: 70, width: 150, height: 20 },
      attributes: {},
      children_ids: []
    };

    // Unrelated element 300px away
    const distantElement: DomSnapshotNode = {
      node_id: "desc-distant",
      tag: "div",
      text: "Password Tips",
      bounds: { x: 100, y: 400, width: 150, height: 20 },
      attributes: {},
      children_ids: []
    };

    const labels = findAssociatedLabels(sensitiveNode, [adjacentDescriptor, distantElement, sensitiveNode]);
    expect(labels.map((l: DomSnapshotNode) => l.node_id)).toContain("desc-pass");
    expect(labels.map((l: DomSnapshotNode) => l.node_id)).not.toContain("desc-distant");
  });
});
