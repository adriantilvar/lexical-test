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
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $copyNode,
  $getNodeByKey,
  $getNodeFromDOMNode,
  $getRoot,
  $isElementNode,
  $isRootNode,
  type ElementNode,
  type LexicalNode,
  type NodeKey,
  ParagraphNode,
} from "lexical";
import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invariant } from "@/lib/utils";
import {
  $createGridContainerNode,
  $isGridContainerNode,
  GridContainerNode,
} from "../nodes/grid-container-node";
import { $createGridItemNode, $isGridItemNode, GridItemNode } from "../nodes/grid-item-node";

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
    const allowedEdges: Edge[] = [];
    allowedEdges.push("left", "right");

    if (source.previousSibling !== target) allowedEdges.push("bottom");
    if (source.nextElementSibling !== target) allowedEdges.push("top");

    return allowedEdges;
  }

  if (isGridItemElement(target.parentElement)) {
    const allowedEdges: Edge[] = [];
    allowedEdges.push("top", "bottom");

    if (target.parentElement.previousSibling !== source.parentElement) allowedEdges.push("left");
    if (target.parentElement.nextSibling !== source.parentElement) allowedEdges.push("right");

    return allowedEdges;
  }

  throw new Error("Unhandled dragging edge");
}

function isEditorContainer(element: unknown): element is HTMLDivElement {
  return element instanceof HTMLDivElement && element.dataset.lexicalEditor === "true";
}

function isGridItemElement(element: unknown): element is HTMLDivElement {
  return element instanceof HTMLDivElement && element.classList.contains("lexical-grid-item");
}

function isLexicalNode(node: unknown): node is LexicalNode {
  return (
    node !== null &&
    node !== undefined &&
    Object.hasOwn(node, "__key") &&
    Object.hasOwn(node, "__type")
  );
}

function $isBlockElementNode(node: unknown): node is ElementNode {
  return isLexicalNode(node) && $isElementNode(node) && !node.isInline();
}

function $deepCopyElementNode<T extends ElementNode>(node: T): T {
  return $copyNode(node).append(...node.getChildren());
}

function $removeNodeWithGridCheck(node: ElementNode): void {
  const parentNode = node.getParent();
  node.remove();

  if (!$isGridItemNode(parentNode)) return;

  const gridContainer = parentNode.getParent();
  invariant($isGridContainerNode(gridContainer), "Must be GridContainerNode");

  const isParentGridItemEmpty = parentNode.getChildrenSize() === 0;
  if (isParentGridItemEmpty) parentNode.remove();

  const gridItems = gridContainer.getChildrenSize();

  if (gridItems === 0) {
    gridContainer.remove();
    return;
  }

  if (gridItems === 1) {
    const root = gridContainer.getParent();
    invariant($isRootNode(root), "Must be root");

    const firstChild = gridContainer.getFirstChild();
    invariant($isGridItemNode(firstChild), "Must be GridItemNode");

    root.splice(gridContainer.getIndexWithinParent(), 1, [
      ...firstChild.getChildrenNodes().map($deepCopyElementNode),
    ]);
    return;
  }

  // At this point we will still have the grid container, so it's worth updating it
  if (isParentGridItemEmpty) gridContainer.updateChildrenColumnSpan();
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
      previewText: string;
    };

export function DragAndDropPlugin() {
  const [editor] = useLexicalComposerContext();
  const [dragState, setDragState] = useState<DragState>({ type: "idle" });

  const dragMenuRef = useRef<HTMLDivElement>(null);
  const dragMenuAnchorRef = useRef<HTMLElement>(null);

  const getDragMenuAnchor = () => dragMenuAnchorRef.current;

  const dropTargetsCleanup = useRef<Map<NodeKey, CleanupFn>>(null);
  if (!dropTargetsCleanup.current) dropTargetsCleanup.current = new Map();

  useEffect(() => {
    invariant(
      editor.hasNodes([GridContainerNode, GridItemNode]),
      "[DragAndDropPlugin]: GridContainerNode and/or GridItemNode not registered on editor",
    );
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
            invariant(dragMenuAnchorRef.current, "Must have drag menu anchor ref");
            setDragState({
              type: "preview",
              previewContainer: container,
              previewText: dragMenuAnchorRef.current.textContent,
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
          invariant($isBlockElementNode(sourceNode), "Source must be block node");
          const targetNode = dropTarget.data.lexicalBlock;
          invariant($isBlockElementNode(targetNode), "Target must be block node");

          if (sourceNode.getKey() === targetNode.getKey()) return;

          const closestEdge = extractClosestEdge(dropTarget.data);
          invariant(closestEdge !== null, "Must have closest edge");

          editor.update(() => {
            const targetParent = targetNode.getParent();
            invariant(targetParent !== null, "Must have parent node");

            if (closestEdge === "top" || closestEdge === "bottom") {
              const sourceCopy = $deepCopyElementNode(sourceNode);

              targetParent.splice(
                closestEdge === "bottom"
                  ? targetNode.getIndexWithinParent() + 1
                  : targetNode.getIndexWithinParent(),
                0,
                [sourceCopy],
              );

              sourceCopy.selectEnd();
              $removeNodeWithGridCheck(sourceNode);
              return;
            }

            if ($isRootNode(targetParent)) {
              const gridContainer = $createGridContainerNode(12);

              if (closestEdge === "right") {
                gridContainer.append(
                  $createGridItemNode(6).append($deepCopyElementNode(targetNode)),
                  $createGridItemNode(6).append($deepCopyElementNode(sourceNode)),
                );
              } else if (closestEdge === "left") {
                gridContainer.append(
                  $createGridItemNode(6).append($deepCopyElementNode(sourceNode)),
                  $createGridItemNode(6).append($deepCopyElementNode(targetNode)),
                );
              }

              $getRoot().splice(targetNode.getIndexWithinParent(), 1, [gridContainer]);

              $removeNodeWithGridCheck(sourceNode);
              return;
            }

            invariant($isGridItemNode(targetParent), "Must be GridItemNode");
            const gridContainer = targetParent.getParent();
            invariant($isGridContainerNode(gridContainer), "Must be GridContainerNode");

            const sourceCopy = $deepCopyElementNode(sourceNode);

            gridContainer.splice(
              closestEdge === "right"
                ? targetParent.getIndexWithinParent() + 1
                : targetParent.getIndexWithinParent(),
              0,
              [$createGridItemNode().append(sourceCopy)],
            );

            gridContainer.updateChildrenColumnSpan();
            $removeNodeWithGridCheck(sourceNode);

            sourceCopy.selectEnd();
          });
        },
      }),
    [editor],
  );

  function onMouseMove(e: MouseEvent): void {
    if (dragState.type === "preview") return;
    // console.log(`clientX: ${e.clientX}, clientY: ${e.clientY}`);
    // console.log(`e.target: ${e.target}`);
    const targetElement = e.target;

    if (isEditorContainer(targetElement)) return;

    if (
      targetElement instanceof HTMLParagraphElement &&
      dragMenuAnchorRef.current !== targetElement
    ) {
      dragMenuAnchorRef.current = targetElement;
      setDragState({ type: "block-hover" });
      return;
    }

    if (targetElement instanceof HTMLSpanElement && dragMenuAnchorRef.current !== targetElement) {
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
            if (mutation === "created") {
              const lexicalBlock = editor.read(() => $getNodeByKey(nodeKey));
              invariant($isBlockElementNode(lexicalBlock), "Must be block node");
              const element = editor.getElementByKey(nodeKey);
              invariant(element !== null, "Element must not be null");

              element.classList.add("lexical-block");

              const cleanupFn = dropTargetForElements({
                element,
                getData: ({ input, source, element: targetElement }) => {
                  invariant(targetElement instanceof HTMLElement, "Must be HTMLElement");
                  const sourceElement = source.data.anchorElement;
                  invariant(sourceElement instanceof HTMLElement, "Must be HTMLElement");

                  return {
                    lexicalBlock,
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

              invariant(dropTargetsCleanup.current !== null, "Must have drop target registry");
              dropTargetsCleanup.current.set(nodeKey, cleanupFn);
            } else if (mutation === "destroyed") {
              invariant(dropTargetsCleanup.current !== null, "Must have drop target registry");
              const cleanupFn = dropTargetsCleanup.current.get(nodeKey);
              invariant(cleanupFn, "Must have cleanup function");

              cleanupFn();
              dropTargetsCleanup.current.delete(nodeKey);
            }
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
            align="center"
            sideOffset={4}
            anchor={getDragMenuAnchor()}
          >
            <Popover.Popup className="outline-none py-0.5 px-px rounded-sm origin-(--transform-origin) hover:bg-zinc-200/60 hover:cursor-grab has-data-starting-style:scale-98 has-data-starting-style:opacity-0">
              <GripVertical className="size-5" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {dragState.type === "preview"
        ? createPortal(<DragPreview text={dragState.previewText} />, dragState.previewContainer)
        : null}
    </>
  );
}

function DragPreview({ text }: { text: string }) {
  return <div className="pl-3 text-lg">{text}</div>;
}
