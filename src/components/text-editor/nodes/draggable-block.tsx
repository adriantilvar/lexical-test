import {
  $create,
  $getState,
  $isElementNode,
  $setState,
  createState,
  DecoratorNode,
  type LexicalNode,
} from "lexical";
import { GripVertical } from "lucide-react";
import type { ReactElement } from "react";
import { isSupportedBlockTag } from "../lib/utils";

// type ImageElement = ReactElement<ImgHTMLAttributes<HTMLImageElement>, "img">;

const EDITOR_GRID_COLUMNS = 12;

const columnSpanState = createState("columnSpan", {
  parse: (value) => (typeof value === "number" ? value : EDITOR_GRID_COLUMNS),
});

const tagState = createState("tag", {
  parse: (value) =>
    typeof value === "string" && isSupportedBlockTag(value) ? value : "p",
});

export class DraggableBlock extends DecoratorNode<ReactElement> {
  $config() {
    return this.config("draggable-block", {
      extends: DecoratorNode,
      stateConfigs: [
        { flat: true, stateConfig: columnSpanState },
        { flat: true, stateConfig: tagState },
      ],
    });
  }

  createDOM(): HTMLDivElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  decorate(): ReactElement {
    const Tag = $getState(this, tagState);

    return (
      <>
        <GripVertical />
        <Tag>Some tag</Tag>
      </>
    );
  }
}

export function $createDraggableBlock(columnSpan?: number): DraggableBlock {
  const draggableBlock = $create(DraggableBlock);
  if (columnSpan) $setState(draggableBlock, columnSpanState, columnSpan);

  return draggableBlock;
}

export function $isDraggableBlock(
  node: LexicalNode | null | undefined,
): node is DraggableBlock {
  return node instanceof DraggableBlock;
}
