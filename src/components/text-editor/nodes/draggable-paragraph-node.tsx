import {
  $create,
  $getState,
  $setState,
  createState,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  ParagraphNode,
} from "lexical";
import { createElement, GripVertical } from "lucide";

const EDITOR_GRID_COLUMNS = 12;

const columnSpanState = createState("columnSpan", {
  parse: (value) => (typeof value === "number" ? value : EDITOR_GRID_COLUMNS),
});

export class DraggableParagraph extends ParagraphNode {
  $config() {
    return this.config("draggable-paragraph", {
      extends: ParagraphNode,
      stateConfigs: [{ flat: true, stateConfig: columnSpanState }],
    });
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("p");
    const dragHandle = document.createElement("span");
    dragHandle.appendChild(createElement(GripVertical));
    dom.appendChild(dragHandle);

    dom.style.setProperty("--cols", String($getState(this, columnSpanState)));
    dom.classList.add(
      "group",
      "relative",
      "col-span-[var(--cols)]",
      "inline-flex",
      "items-center",
      "[&_svg]:absolute",
      "[&_svg]:-left-6",
      "[&_svg]:invisible",
      "[&_svg]:group-hover:visible",
      "[&_svg]:hover:cursor-grab",
    );

    return dom;
  }

  remove() {
    super.remove();
    console.log(`Hey, you're trying to remove me!`);
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    if (super.updateDOM(prevNode, dom, config)) return true;

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
