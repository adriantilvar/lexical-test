"use client";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import type { Input, Position } from "@atlaskit/pragmatic-drag-and-drop/types";
import { Popover } from "@base-ui/react/popover";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getNodeByKey, $getRoot } from "lexical";
import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Edge = "top" | "right" | "bottom" | "left";

const getDistanceToEdge: {
  [TKey in Edge]: (rect: DOMRect, client: Position) => number;
} = {
  top: (rect, client) => Math.abs(client.y - rect.top),
  right: (rect, client) => Math.abs(rect.right - client.x),
  bottom: (rect, client) => Math.abs(rect.bottom - client.y),
  left: (rect, client) => Math.abs(client.x - rect.left),
};

const uniqueKey = Symbol("closestEdge");

export function attachClosestEdge(
  userData: Record<string | symbol, unknown>,
  {
    element,
    input,
    allowedEdges,
  }: {
    element: Element;
    input: Input;
    allowedEdges: Edge[];
  },
): Record<string | symbol, unknown> {
  const client: Position = {
    x: input.clientX,
    y: input.clientY,
  };
  const rect: DOMRect = element.getBoundingClientRect();

  const entries = allowedEdges.map((edge) => {
    return {
      edge,
      value: getDistanceToEdge[edge](rect, client),
    };
  });

  // edge can be `null` when `allowedEdges` is []
  const addClosestEdge: Edge | null =
    entries.sort((a, b) => a.value - b.value)[0]?.edge ?? null;

  return {
    ...userData,
    [uniqueKey]: addClosestEdge,
  };
}

export function extractClosestEdge(
  userData: Record<string | symbol, unknown>,
): Edge | null {
  return (userData[uniqueKey] as Edge) ?? null;
}

type State =
  | {
      type: "idle";
    }
  | {
      type: "preview";
      container: HTMLElement;
      previewText: string;
    };

export function DragAndDropPlugin() {
  const [editor] = useLexicalComposerContext();
  const [hoveredBlock, setHoveredBlock] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<State>({ type: "idle" });

  function onMouseMove(e: MouseEvent): void {
    const targetElement = e.target;
    if (
      targetElement instanceof HTMLDivElement &&
      targetElement.dataset.lexicalEditor
    )
      return;

    if (
      targetElement instanceof HTMLParagraphElement &&
      hoveredBlock !== targetElement
    ) {
      setHoveredBlock(targetElement);
      return;
    }

    if (
      targetElement instanceof HTMLSpanElement &&
      hoveredBlock !== targetElement
    ) {
      setHoveredBlock(targetElement.parentElement);
      return;
    }
  }

  function onMouseLeave(e: MouseEvent): void {
    const editorRect = editor.getRootElement()?.getBoundingClientRect();
    // console.log(`Editor: `, editorRect?.bottom);
    // console.log(`Mouse: `, { x: e.offsetX, y: e.offsetY });

    if (e.offsetX < 0 || e.offsetY < 0) setHoveredBlock(null);
  }

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        console.log("source: ", source.data.lexicalBlock);
        const dropTarget = location.current.dropTargets[0];

        // const dropTargetRect = dropTarget.element.getBoundingClientRect();

        console.log(`location: `, dropTarget.data.lexicalBlock);
      },
    });
  }, []);

  useEffect(() => {
    return mergeRegister(
      ...editor.getEditorState().read(() =>
        $getRoot()
          .getChildrenKeys()
          .map((key) => {
            const lexicalBlock = $getNodeByKey(key);
            const element = editor.getElementByKey(key);
            if (element === null) throw new Error("Block must be valid");

            return dropTargetForElements({
              element,
              getData: ({ input }) =>
                attachClosestEdge(
                  { lexicalBlock },
                  {
                    element,
                    input,
                    allowedEdges: ["top", "right", "bottom", "left"],
                  },
                ),
              onDrag: ({ source, self }) => {
                if (source.data.lexicalBlock === self.data.lexicalBlock) return;

                const currentEdge = self.element.getAttribute("data-drag-edge");
                const closestEdge = extractClosestEdge(self.data);
                if (!closestEdge) throw new Error("Must have closest edge");

                if (currentEdge && currentEdge === closestEdge) return;

                console.log(`setting edge -> `, closestEdge);
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
          }),
      ),
    );
  }, [editor]);

  useEffect(() => {
    let draggableCleanup: () => void;

    if (hoveredBlock && menuRef.current) {
      const [lexicalBlock, previewText] = editor.getEditorState().read(() => {
        const blockKey = $getRoot()
          .getChildrenKeys()
          .find((key) => editor.getElementByKey(key) === hoveredBlock);
        if (!blockKey) throw new Error("Must have block key");

        const block = $getNodeByKey(blockKey);

        return [block, block?.getTextContent()];
      });
      if (!previewText) throw new Error("Must have Lexical block");

      draggableCleanup = draggable({
        element: menuRef.current,
        getInitialData: () => ({ lexicalBlock }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          setCustomNativeDragPreview({
            render({ container }) {
              setState({ type: "preview", container, previewText });

              return () => setState({ type: "idle" });
            },
            nativeSetDragImage,
          });
        },
      });
    }

    const commandsCleanup = mergeRegister(
      editor.registerRootListener((root, previousRoot) => {
        if (!root) return;

        if (previousRoot) {
          previousRoot.removeEventListener("mousemove", onMouseMove);
          previousRoot.removeEventListener("mouseleave", onMouseLeave);
        }

        root.addEventListener("mousemove", onMouseMove);
        root.addEventListener("mouseleave", onMouseLeave);
      }),
      // editor.registerMutationListener(
      //   DraggableParagraph,
      //   (mutations, payload) => {
      //     console.log(`mutations: `, mutations);

      //     for (const [nodeKey, mutation] of mutations) {
      //       if (mutation === "created") {
      //         console.log(`${nodeKey} created!`);
      //       } else if (mutation === "destroyed") {
      //         console.log(`${nodeKey} destroyed!`);
      //       }
      //     }
      //   },
      // ),
    );

    return () => {
      if (draggableCleanup) draggableCleanup();
      commandsCleanup();
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler should memoize functions
  }, [editor, hoveredBlock, onMouseMove, onMouseLeave]);

  return (
    <>
      <div ref={menuRef} />

      <Popover.Root open={hoveredBlock !== null}>
        <Popover.Portal container={menuRef.current}>
          <Popover.Positioner
            side="left"
            align="center"
            sideOffset={4}
            anchor={hoveredBlock}
          >
            <Popover.Popup className="outline-none py-0.5 px-px rounded-sm origin-(--transform-origin) hover:bg-zinc-200 has-data-starting-style:scale-98 has-data-starting-style:opacity-0">
              <GripVertical className="size-5" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {state.type === "preview"
        ? createPortal(
            <DragPreview text={state.previewText} />,
            state.container,
          )
        : null}
    </>
  );
}

function DragPreview({ text }: { text: string }) {
  return <div className="pl-3 text-lg">{text}</div>;
}
