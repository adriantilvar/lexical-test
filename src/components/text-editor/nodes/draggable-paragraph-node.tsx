import type { CleanupFn } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import {
  $create,
  $getState,
  $setState,
  createState,
  DOMExportOutput,
  type EditorConfig,
  ElementNode,
  LexicalEditor,
  type LexicalNode,
  ParagraphNode,
} from "lexical";
import { createElement, GripVertical } from "lucide";

const EDITOR_GRID_COLUMNS = 12;

const columnSpanState = createState("columnSpan", {
  parse: (value) => (typeof value === "number" ? value : EDITOR_GRID_COLUMNS),
});

const draggableCleanupState = createState("draggableCleanup", {
  parse: (value) => (typeof value === "function" ? value : null),
});

export class DraggableParagraph extends ParagraphNode {
  $config() {
    return this.config("draggable-paragraph", {
      extends: ParagraphNode,
      stateConfigs: [
        { flat: true, stateConfig: columnSpanState },
        { flat: true, stateConfig: draggableCleanupState },
      ],
    });
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("p");
    dom.style.setProperty("--cols", String($getState(this, columnSpanState)));
    dom.classList.add(
      "col-span-[var(--cols)]",
      "border-blue-200",
      "data-[drag-edge=top]:border-t-4",
      "data-[drag-edge=right]:border-r-4",
      "data-[drag-edge=bottom]:border-b-4",
      "data-[drag-edge=left]:border-l-4",
      // "group",
      // "relative",
      // "inline-flex",
      // "items-center",
      // "[&_svg]:absolute",
      // "[&_svg]:-left-6",
      // "[&_svg]:top-0",
      // "[&_svg]:invisible",
      // "[&_svg]:group-hover:visible",
      // "[&_svg]:hover:cursor-grab",
    );

    // const dragHandle = document.createElement("span");
    // dragHandle.appendChild(createElement(GripVertical));
    // dom.appendChild(dragHandle);

    // const textContent = this.getTextContent();

    // // Attaching DnD behavior
    // const draggableCleanupFn = draggable({
    //   element: dom,
    //   dragHandle,
    //   onGenerateDragPreview: ({ nativeSetDragImage }) => {
    //     setCustomNativeDragPreview({
    //       render({ container }) {
    //         const preview = document.createElement("div");
    //         preview.textContent = textContent;
    //         preview.classList.add("pl-3");

    //         container.appendChild(preview);
    //       },
    //       nativeSetDragImage,
    //     });
    //   },
    // });

    // $setState(this, draggableCleanupState, draggableCleanupFn);

    return dom;
  }

  remove() {
    super.remove();

    const draggableCleanup = $getState(this, draggableCleanupState);
    if (draggableCleanup) draggableCleanup();
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    if (super.updateDOM(prevNode, dom, config)) return true;

    console.log(`Updating dom`);

    // const prevColSpan = $getState(prevNode, columnSpanState);
    // const currentColSpan = dom.style.getPropertyValue('--cols');
    // if(prevColSpan !== currentColSpan)

    return false;
  }
}

export function $createDraggableParagraph(
  columnSpan?: number,
): DraggableParagraph {
  const draggableParagraph = $create(DraggableParagraph);
  if (columnSpan) $setState(draggableParagraph, columnSpanState, columnSpan);

  return draggableParagraph;
}

export function $isDraggableParagraph(
  node: LexicalNode | null | undefined,
): node is DraggableParagraph {
  return node instanceof DraggableParagraph;
}
