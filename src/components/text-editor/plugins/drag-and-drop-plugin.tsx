"use client";
import type { DropTargetGetFeedbackArgs } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import type { ElementDragType, Position } from "@atlaskit/pragmatic-drag-and-drop/types";
import { Popover } from "@base-ui/react/popover";
import { $createListNode, $isListItemNode, $isListNode, ListItemNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $isQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import {
  $copyNode,
  $getNodeByKey,
  $getNodeFromDOMNode,
  $getRoot,
  $isParagraphNode,
  $isRootNode,
  DecoratorNode,
  type ElementNode,
  type NodeKey,
  ParagraphNode,
} from "lexical";
import { GripVertical } from "lucide-react";
import Image from "next/image";
import { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn, invariant } from "@/lib/utils";
import {
  $deepCopyElementNode as $deepCopyNode,
  $getElementTag,
  $getParentGridNode,
  $isBlockElementNode,
  $removeNodeWithGridPruning,
  isEditorContainer,
  isGridItemElement,
  isListElement,
  isListItemElement,
  isQuoteElement,
} from "../lib/utils";
import { $createGridItemNode, $isGridItemNode, GridItemNode } from "../nodes/grid-item-node";
import { $createGridNode, $isGridNode, GridNode } from "../nodes/grid-node";
import { $isImageNode, ImageNode } from "../nodes/image-node";

type CleanupFn = () => void;
type Edge = "top" | "right" | "bottom" | "left";

const getDistanceToEdge: {
  [TKey in Edge]: (rect: DOMRect, client: Position) => number;
} = {
  top: (rect, client) => Math.abs(client.y - rect.top),
  right: (rect, client) => Math.abs(rect.right - client.x),
  bottom: (rect, client) => Math.abs(rect.bottom - client.y),
  left: (rect, client) => Math.abs(client.x - rect.left),
};

const closestEdgeKey = Symbol("closestEdge");

type GetClosestEdgeArgs = Pick<DropTargetGetFeedbackArgs<ElementDragType>, "input" | "element"> & {
  allowedEdges: Edge[];
};

function getClosestEdge({ input, element, allowedEdges }: GetClosestEdgeArgs): Edge | null {
  const clientPosition: Position = {
    x: input.clientX,
    y: input.clientY,
  };
  const rect: DOMRect = element.getBoundingClientRect();

  let distanceToClosestEdge = 10000;
  let closestEdge: Edge | null = null;
  allowedEdges.forEach((edge) => {
    const distanceToEdge = getDistanceToEdge[edge](rect, clientPosition);

    if (distanceToEdge < distanceToClosestEdge) {
      distanceToClosestEdge = distanceToEdge;
      closestEdge = edge;
    }
  });

  return closestEdge;
}

function extractClosestEdge(userData: Record<string | symbol, unknown>): Edge | null {
  return (userData[closestEdgeKey] as Edge) ?? null;
}

function getAllowedEdges(source: HTMLElement, target: HTMLElement): Edge[] {
  if (source === target) return [];

  if (isEditorContainer(target.parentElement)) {
    const allowedEdges: Edge[] = ["left", "right"];

    if (source.previousSibling !== target) allowedEdges.push("bottom");
    if (source.nextElementSibling !== target) allowedEdges.push("top");

    return allowedEdges;
  }

  if (isQuoteElement(target.parentElement)) {
    return ["top", "bottom"];
  }

  if (isListItemElement(target) && isListItemElement(source)) {
    const allowedEdges: Edge[] = [];

    if (source.previousSibling !== target) allowedEdges.push("bottom");
    if (source.nextElementSibling !== target) allowedEdges.push("top");

    return allowedEdges;
  }

  if (isListItemElement(target) && !isListItemElement(source)) {
    return ["top", "right", "bottom", "left"];
  }

  if (isGridItemElement(target.parentElement)) {
    const allowedEdges: Edge[] = ["top", "bottom"];

    if (target.parentElement.previousSibling !== source.parentElement) allowedEdges.push("left");
    if (target.parentElement.nextSibling !== source.parentElement) allowedEdges.push("right");

    return allowedEdges;
  }

  throw new Error("Unhandled dragging edge");
}

function makeDropTarget(element: HTMLElement, data: Record<string, unknown>): CleanupFn {
  return dropTargetForElements({
    element,
    getData: ({ input, source, element: targetElement }) => {
      invariant(targetElement instanceof HTMLElement, "Must be HTMLElement");
      const sourceElement = source.data.anchorElement;
      invariant(sourceElement instanceof HTMLElement, "Must be HTMLElement");

      return {
        ...data,
        [closestEdgeKey]: getClosestEdge({
          element,
          input,
          allowedEdges: getAllowedEdges(sourceElement, targetElement),
        }),
      };
    },
    onDrag: ({ self }) => {
      const closestEdge = extractClosestEdge(self.data);
      if (!closestEdge) return;

      const currentEdge = self.element.getAttribute("data-drag-edge");
      if (currentEdge && currentEdge === closestEdge) return;

      self.element.setAttribute("data-drag-edge", closestEdge);
    },
    onDragLeave: ({ source, self }) => {
      if (source.data.lexicalBlock === self.data.lexicalBlock) return;

      self.element.removeAttribute("data-drag-edge");
    },
    onDrop: ({ source, self }) => {
      if (source.data.lexicalBlock === self.data.lexicalBlock) return;

      self.element.removeAttribute("data-drag-edge");
    },
  });
}

type DragState =
  | {
      type: "idle";
    }
  | {
      type: "block-hover";
    }
  | {
      type: "preview";
      previewContainer: HTMLElement;
      previewComponent: ReactNode;
    };

export function DragAndDropPlugin() {
  const [editor] = useLexicalComposerContext();
  const [dragState, setDragState] = useState<DragState>({ type: "idle" });

  const dragMenuRef = useRef<HTMLDivElement>(null);
  const dragMenuAnchorRef = useRef<HTMLElement>(null);
  const getDragMenuAnchor = () => dragMenuAnchorRef.current;

  const dropTargetRegistry = useRef<Map<NodeKey, CleanupFn>>(null);
  if (!dropTargetRegistry.current) dropTargetRegistry.current = new Map();

  function registerDropTarget(nodeKey: string): void {
    const lexicalBlock = editor.read(() => $getNodeByKey(nodeKey));
    const element = editor.getElementByKey(nodeKey);
    invariant(element !== null, "Element must not be null");

    if ($isBlockElementNode(lexicalBlock)) element.classList.add("lexical-block");

    invariant(
      $isBlockElementNode(lexicalBlock) || $isImageNode(lexicalBlock),
      "Must be ElementNode or ImageNode",
    );

    invariant(dropTargetRegistry.current !== null, "Must have drop target registry");
    dropTargetRegistry.current.set(nodeKey, makeDropTarget(element, { lexicalBlock }));
  }

  function deregisterDropTarget(nodeKey: string): void {
    invariant(dropTargetRegistry.current !== null, "Must have drop target registry");
    const cleanupFn = dropTargetRegistry.current.get(nodeKey);
    invariant(cleanupFn, "Must have cleanup function");

    cleanupFn();
    dropTargetRegistry.current.delete(nodeKey);
  }

  useEffect(() => {
    const hasDependencies = editor.hasNodes([GridNode, GridItemNode]);
    invariant(hasDependencies, "[DragAndDropPlugin] GridNode and/or GridItemNode not registered");
  }, [editor]);

  useEffect(() => {
    invariant(dragMenuRef.current, "Must have drag menu ref");

    return draggable({
      element: dragMenuRef.current,
      getInitialData: () => ({
        anchorElement: dragMenuAnchorRef.current,
        lexicalBlock: editor.read(() => {
          invariant(dragMenuAnchorRef.current !== null, "Must have drag menu anchor");
          return $getNodeFromDOMNode(dragMenuAnchorRef.current);
        }),
      }),
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          render: ({ container }) => {
            setDragState(() => {
              invariant(dragMenuAnchorRef.current, "Must have drag menu anchor ref");

              if (dragMenuAnchorRef.current.classList.contains("lexical-image-wrapper")) {
                const img = dragMenuAnchorRef.current.firstElementChild;
                invariant(img instanceof HTMLImageElement, "Must be image");

                return {
                  type: "preview",
                  previewContainer: container,
                  previewComponent: (
                    // biome-ignore lint/performance/noImgElement: TODO: Optimize image
                    <img
                      className="p-1.5"
                      src={img.src}
                      alt={`${img.alt}-preview`}
                      width={100}
                      height="auto"
                    />
                  ),
                };
              }

              if (dragMenuAnchorRef.current.classList.contains("lexical-block")) {
                return {
                  type: "preview",
                  previewContainer: container,
                  previewComponent: (
                    <div className="p-1.5 text-lg">{dragMenuAnchorRef.current.textContent}</div>
                  ),
                };
              }

              throw new Error("Unhandled drag preview");
            });

            return () => setDragState({ type: "idle" });
          },
          nativeSetDragImage,
        });
      },
    });
  }, [editor]);

  useEffect(
    () =>
      monitorForElements({
        onDrop: ({ source, location }) => {
          const dropTarget = location.current.dropTargets[0];
          if (!dropTarget) return;

          const sourceNode = source.data.lexicalBlock;
          invariant(
            $isBlockElementNode(sourceNode) || $isImageNode(sourceNode),
            "Must be ElementNode or ImageNode",
          );
          const targetNode = dropTarget.data.lexicalBlock;
          invariant(
            $isBlockElementNode(targetNode) || $isImageNode(targetNode),
            "Must be ElementNode or ImageNode",
          );

          if (sourceNode.getKey() === targetNode.getKey()) return;

          const closestEdge = extractClosestEdge(dropTarget.data);
          invariant(closestEdge !== null, "Must have closest edge");

          editor.update(() => {
            const sourceParent = sourceNode.getParent();
            invariant(sourceParent !== null, "Must have source parent");
            const targetParent = targetNode.getParent();
            invariant(targetParent !== null, "Must have parent node");

            const sourceCopy =
              $isListNode(sourceParent) && !$isListNode(targetParent)
                ? $createListNode(sourceParent.getListType()).append($deepCopyNode(sourceNode))
                : $deepCopyNode(sourceNode);

            if (closestEdge === "top" || closestEdge === "bottom") {
              const targetIndex = targetNode.getIndexWithinParent();
              const insertIndex = closestEdge === "bottom" ? targetIndex + 1 : targetIndex;
              targetParent.splice(insertIndex, 0, [sourceCopy]);

              $removeNodeWithGridPruning(sourceNode);
              return;
            }

            if ($isRootNode(targetParent)) {
              const targetCopy = $deepCopyNode(targetNode);
              const gridItems =
                closestEdge === "right"
                  ? [$createGridItemNode(6, targetCopy), $createGridItemNode(6, sourceCopy)]
                  : [$createGridItemNode(6, sourceCopy), $createGridItemNode(6, targetCopy)];

              const insertIndex = targetNode.getIndexWithinParent();
              targetParent.splice(insertIndex, 1, [$createGridNode(12).append(...gridItems)]);

              $removeNodeWithGridPruning(sourceNode);
              return;
            }

            if ($isListNode(targetParent)) {
              const targetCopy = $deepCopyNode(targetParent);
              const gridItems =
                closestEdge === "right"
                  ? [$createGridItemNode(6, targetCopy), $createGridItemNode(6, sourceCopy)]
                  : [$createGridItemNode(6, sourceCopy), $createGridItemNode(6, targetCopy)];

              const insertIndex = targetParent.getIndexWithinParent();
              $getRoot().splice(insertIndex, 1, [$createGridNode(12).append(...gridItems)]);

              $removeNodeWithGridPruning(sourceNode);
              return;
            }

            invariant($isGridItemNode(targetParent), "Must be GridItemNode");
            const gridNode = targetParent.getParent();
            invariant($isGridNode(gridNode), "Must be GridNode");

            const targetIndex = targetParent.getIndexWithinParent();
            const insertIndex = closestEdge === "right" ? targetIndex + 1 : targetIndex;
            gridNode.splice(insertIndex, 0, [$createGridItemNode(6, sourceCopy)]);
            gridNode.updateChildrenColumnSpan();
            $removeNodeWithGridPruning(sourceNode);
          });
        },
      }),
    [editor],
  );

  function onMouseMove(e: MouseEvent): void {
    if (dragState.type === "preview") return;
    // console.log(`clientX: $e.clientX, clientY: $e.clientY`);
    // console.log(`e.target: $e.target`);
    const targetElement = e.target;

    if (isEditorContainer(targetElement)) return;

    if (
      (targetElement instanceof HTMLParagraphElement || targetElement instanceof HTMLLIElement) &&
      dragMenuAnchorRef.current !== targetElement
    ) {
      dragMenuAnchorRef.current = targetElement;
      setDragState({ type: "block-hover" });
      return;
    }

    if (
      (targetElement instanceof HTMLSpanElement || targetElement instanceof HTMLImageElement) &&
      dragMenuAnchorRef.current !== targetElement
    ) {
      dragMenuAnchorRef.current = targetElement.parentElement;
      setDragState({ type: "block-hover" });
      return;
    }
  }

  function onMouseLeave(e: MouseEvent): void {
    if (e.offsetX < 0 || e.offsetY < 0) {
      dragMenuAnchorRef.current = null;
      // console.log(`Mouseleave`);
      setDragState({ type: "idle" });
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler should memoize onMouseMove & onMouseLeave
  useEffect(
    () =>
      mergeRegister(
        editor.registerRootListener((root, previousRoot) => {
          if (!root) return;

          if (previousRoot) {
            previousRoot.removeEventListener("mousemove", onMouseMove);
            previousRoot.removeEventListener("mouseleave", onMouseLeave);
          }

          root.addEventListener("mousemove", onMouseMove);
          root.addEventListener("mouseleave", onMouseLeave);
        }),
        editor.registerMutationListener(ParagraphNode, (mutations) => {
          for (const [nodeKey, mutation] of mutations) {
            if (mutation === "created") registerDropTarget(nodeKey);
            else if (mutation === "destroyed") deregisterDropTarget(nodeKey);
          }
        }),
        editor.registerMutationListener(HeadingNode, (mutations) => {
          for (const [nodeKey, mutation] of mutations) {
            if (mutation === "created") registerDropTarget(nodeKey);
            else if (mutation === "destroyed") deregisterDropTarget(nodeKey);
          }
        }),
        editor.registerMutationListener(ListItemNode, (mutations) => {
          for (const [nodeKey, mutation] of mutations) {
            if (mutation === "created") registerDropTarget(nodeKey);
            else if (mutation === "destroyed") deregisterDropTarget(nodeKey);
          }
        }),
        editor.registerMutationListener(ImageNode, (mutations) => {
          for (const [nodeKey, mutation] of mutations) {
            if (mutation === "created") registerDropTarget(nodeKey);
            else if (mutation === "destroyed") deregisterDropTarget(nodeKey);
          }
        }),
      ),
    [editor],
  );

  return (
    <>
      <div ref={dragMenuRef} />

      <Popover.Root open={dragState.type !== "idle"}>
        <Popover.Portal container={dragMenuRef.current}>
          <Popover.Positioner
            side="left"
            align="start"
            sideOffset={() => {
              const anchor = dragMenuAnchorRef.current;

              if (anchor instanceof HTMLLIElement) return 22;
              if (anchor?.parentElement instanceof HTMLQuoteElement) return 26;

              return 4;
            }}
            anchor={getDragMenuAnchor()}
          >
            <Popover.Popup className="outline-none mt-0.5 py-0.5 px-px rounded-sm origin-(--transform-origin) hover:bg-zinc-200/60 hover:cursor-grab text-zinc-600 hover:text-zinc-900 has-data-starting-style:scale-98 has-data-starting-style:opacity-0">
              <GripVertical className="size-5 " />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {dragState.type === "preview"
        ? createPortal(dragState.previewComponent, dragState.previewContainer)
        : null}
    </>
  );
}
