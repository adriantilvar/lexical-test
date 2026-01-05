import {
  $create,
  $getState,
  $isRootNode,
  $setState,
  createState,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
} from "lexical";
import { invariant } from "@/lib/utils";
import { $deepCopyElementNode } from "../lib/utils";
import { $isGridItemNode, GridItemNode } from "./grid-item-node";

const allowedColumnsNumber = {
  12: "grid-cols-12",
} as const;

type AllowedColumnsNumber = keyof typeof allowedColumnsNumber;

const columnsNumberState = createState("columnsNumber", {
  parse: (value) => (typeof value === "string" ? value : allowedColumnsNumber[12]),
});

export class GridNode extends ElementNode {
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

  // TODO: Should guard against doing this when it's not necessary
  updateChildrenColumnSpan(): void {
    const colSpan = this.getColumnsNumber() / this.getChildrenSize();
    invariant(GridItemNode.isAllowedColumnSpan(colSpan), "Invalid column span");

    this.getChildrenNodes().forEach((child) => void child.updateColumnSpan(colSpan));
  }

  prune(): void {
    let hasRemovedChild = false;
    this.getChildrenNodes().forEach((child) => {
      if (child.getChildrenSize() === 0) {
        child.remove();
        hasRemovedChild = true;
      }
    });

    const gridItemsNo = this.getChildrenSize();
    if (gridItemsNo === 0) return void this.remove();
    if (gridItemsNo === 1) {
      const root = this.getParent();
      invariant($isRootNode(root), "Must be root");

      const firstChild = this.getFirstChild();
      invariant($isGridItemNode(firstChild), "Must be GridItemNode");

      root.splice(this.getIndexWithinParent(), 1, [
        ...firstChild.getChildrenNodes().map($deepCopyElementNode),
      ]);
      return;
    }

    // The grid still has items, so they need to be updated
    if (hasRemovedChild) this.updateChildrenColumnSpan();
  }
}

export function $createGridNode(columnsNumber?: AllowedColumnsNumber): GridNode {
  const gridContainer = $create(GridNode);

  if (columnsNumber) {
    const gridColumns = allowedColumnsNumber[columnsNumber] ?? undefined;

    if (!gridColumns) throw new Error("Grid does not support provided columnsNumber");
    else $setState(gridContainer, columnsNumberState, gridColumns);
  }

  return gridContainer;
}

export function $isGridNode(node: LexicalNode | null | undefined): node is GridNode {
  return node instanceof GridNode;
}
