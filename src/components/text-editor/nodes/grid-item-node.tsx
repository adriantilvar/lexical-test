import {
  $create,
  $getState,
  $isElementNode,
  $setState,
  createState,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
} from "lexical";
import { invariant } from "@/lib/utils";
import type { ImageNode } from "./image-node";

const allowedColumnSpan: Record<number, string> = {
  12: "col-span-12",
  6: "col-span-6",
  4: "col-span-4",
  3: "col-span-3",
};

export type AllowedColumnSpan = 4 | 6 | 12;

const columnSpanState = createState("columnSpan", {
  parse: (value) => (typeof value === "string" ? value : allowedColumnSpan[12]),
});

export class GridItemNode extends ElementNode {
  $config() {
    return this.config("grid-item", {
      extends: ElementNode,
      stateConfigs: [{ flat: true, stateConfig: columnSpanState }],
    });
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("div");

    dom.classList.add("lexical-grid-item", $getState(this, columnSpanState));

    return dom;
  }

  append(...nodes: (ElementNode | ImageNode)[]): this {
    // TODO: Re-enable with check for ElementNode || ImageNode
    // invariant(nodes.every($isElementNode), "GridItemNode accepts only ElementNode children");

    return super.append(...nodes);
  }

  getChildrenNodes(): ElementNode[] {
    return super.getChildren<ElementNode>();
  }

  remove() {
    super.remove();
  }

  updateDOM(prevNode: this, _dom: HTMLElement, _config: EditorConfig): boolean {
    return $getState(prevNode, columnSpanState) === $getState(this, columnSpanState);
  }

  updateColumnSpan(newSpan: AllowedColumnSpan): void {
    invariant(GridItemNode.isAllowedColumnSpan(newSpan), "Must have allowed column span");
    if (this.getColumnSpan() === newSpan) return;

    $setState(this, columnSpanState, allowedColumnSpan[newSpan]);
  }

  getColumnSpan(): number {
    return Number($getState(this, columnSpanState).split("col-span-")[1]);
  }

  static isAllowedColumnSpan(columnSpan: number): columnSpan is AllowedColumnSpan {
    return allowedColumnSpan[columnSpan] !== undefined;
  }
}

export function $createGridItemNode(
  columnSpan?: AllowedColumnSpan,
  ...nodes: (ElementNode | ImageNode)[]
): GridItemNode {
  const gridItemNode = $create(GridItemNode);

  if (columnSpan && !GridItemNode.isAllowedColumnSpan(columnSpan)) {
    throw new Error("Grid item does not support provided columnSpan");
  }

  if (columnSpan) {
    $setState(gridItemNode, columnSpanState, allowedColumnSpan[columnSpan]);
  }

  return gridItemNode.append(...nodes);
}

export function $isGridItemNode(node: LexicalNode | null | undefined): node is GridItemNode {
  return node instanceof GridItemNode;
}
