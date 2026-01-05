import { $isListItemNode, $isListNode } from "@lexical/list";
import { $isHeadingNode } from "@lexical/rich-text";
import {
  $copyNode,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRootNode,
  type ElementNode,
  type LexicalNode,
} from "lexical";
import { invariant } from "@/lib/utils";
import type { SupportedHeadingTag } from "../commands/block-commands";
import { $isGridNode, type GridNode } from "../nodes/grid-node";
import { $isImageNode, type ImageNode } from "../nodes/image-node";
import { BLOCK_TAGS } from "./const";
import type { BlockTag } from "./types";

export function isSupportedHeadingTag(tag: string): tag is SupportedHeadingTag {
  return /^h[2-4]$/.test(tag);
}

const blockTagSet = new Set<string>(BLOCK_TAGS);

export function isSupportedBlockTag(tag: string | null): tag is BlockTag {
  return tag !== null && blockTagSet.has(tag);
}

export function $getElementTag(node: ElementNode | ImageNode | null): string | null {
  if (node === null) return null;

  if ($isImageNode(node)) return "img";
  if ($isParagraphNode(node)) return "p";
  if ($isListItemNode(node)) return "li";
  if ($isHeadingNode(node)) return node.getTag();
  if ($isListNode(node)) return node.getTag();

  throw new Error("Unsupported element type");
}

export function isEditorContainer(element: unknown): element is HTMLDivElement {
  return element instanceof HTMLDivElement && element.dataset.lexicalEditor === "true";
}

export function isGridItemElement(element: unknown): element is HTMLDivElement {
  return element instanceof HTMLDivElement && element.classList.contains("lexical-grid-item");
}

export function isListElement(element: unknown): element is HTMLUListElement | HTMLOListElement {
  return element instanceof HTMLUListElement || element instanceof HTMLOListElement;
}

export function isListItemElement(element: unknown): element is HTMLLIElement {
  return element instanceof HTMLLIElement;
}

export function isLexicalNode(node: unknown): node is LexicalNode {
  return (
    node !== null &&
    node !== undefined &&
    Object.hasOwn(node, "__key") &&
    Object.hasOwn(node, "__type")
  );
}

export function $isBlockElementNode(node: unknown): node is ElementNode {
  return isLexicalNode(node) && $isElementNode(node) && !node.isInline();
}

export function $deepCopyElementNode<T extends LexicalNode>(node: T): T {
  if (!$isElementNode(node)) return $copyNode(node);

  const childrenCopy: LexicalNode[] = [];
  node.getChildren().forEach((child) => {
    if (!$isLineBreakNode(child)) childrenCopy.push($deepCopyElementNode(child));
  });

  return $copyNode(node).append(...childrenCopy);
}

export function $getParentGridNode(node: ElementNode | ImageNode): GridNode | null {
  if (!$isElementNode(node) && !$isImageNode(node)) return null;

  let currentNode: ElementNode | ImageNode | null = node;
  while (currentNode && !$isGridNode(currentNode) && !$isRootNode(currentNode)) {
    currentNode = currentNode.getParent();
  }

  return $isGridNode(currentNode) ? currentNode : null;
}

export function $removeNodeWithGridPruning(node: ElementNode | ImageNode): void {
  invariant($isElementNode(node) || $isImageNode(node), "Must be draggable node");
  const gridNode = $getParentGridNode(node);
  node.remove();
  if (gridNode) gridNode.prune();
}
