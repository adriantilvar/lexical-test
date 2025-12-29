import {
  $create,
  $getState,
  $setState,
  createState,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
} from "lexical";
import { invariant } from "@/lib/utils";
import { $isGridItemNode, GridItemNode } from "./grid-item-node";

const allowedColumnsNumber = {
  12: "grid-cols-12",
} as const;

type AllowedColumnsNumber = keyof typeof allowedColumnsNumber;

const columnsNumberState = createState("columnsNumber", {
  parse: (value) => (typeof value === "string" ? value : allowedColumnsNumber[12]),
});

export class GridContainerNode extends ElementNode {
  $config() {
    return this.config("grid-container", {
      extends: ElementNode,
      stateConfigs: [{ flat: true, stateConfig: columnsNumberState }],
    });
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("div");
    dom.classList.add("grid", $getState(this, columnsNumberState), "gap-x-8");

    return dom;
  }

  append(...nodes: GridItemNode[]): this {
    invariant(nodes.every($isGridItemNode), "GridContainerNode accepts only GridItemNode children");

    return super.append(...nodes);
  }

  getChildrenNodes(): GridItemNode[] {
    return super.getChildren<GridItemNode>();
  }

  remove() {
    super.remove();
  }

  updateDOM(_prevNode: this, _dom: HTMLElement, _config: EditorConfig): boolean {
    return false;
  }

  getColumnsNumber(): number {
    return Number($getState(this, columnsNumberState).split("grid-cols-")[1]);
  }

  updateChildrenColumnSpan(): void {
    const colSpan = this.getColumnsNumber() / this.getChildrenSize();
    invariant(GridItemNode.isAllowedColumnSpan(colSpan), "Invalid column span");

    this.getChildrenNodes().forEach((child) => void child.updateColumnSpan(colSpan));
  }
}

export function $createGridContainerNode(columnsNumber?: AllowedColumnsNumber): GridContainerNode {
  const gridContainer = $create(GridContainerNode);

  if (columnsNumber) {
    const gridColumns = allowedColumnsNumber[columnsNumber] ?? undefined;

    if (!gridColumns) throw new Error("Grid does not support provided columnsNumber");
    else $setState(gridContainer, columnsNumberState, gridColumns);
  }

  return gridContainer;
}

export function $isGridContainerNode(
  node: LexicalNode | null | undefined,
): node is GridContainerNode {
  return node instanceof GridContainerNode;
}
