import { $isListNode } from "@lexical/list";
import { $isHeadingNode } from "@lexical/rich-text";
import type { RangeSelection } from "lexical";
import type { SupportedHeadingTag } from "../commands/block-commands";
import { $isDraggableParagraph } from "../nodes/draggable-paragraph-node";
import { BLOCK_TAGS } from "./const";
import type { BlockTag } from "./types";

export function isSupportedHeadingTag(tag: string): tag is SupportedHeadingTag {
  return /^h[2-4]$/.test(tag);
}

const blockTagSet = new Set<string>(BLOCK_TAGS);
export function isSupportedBlockTag(tag: string): tag is BlockTag {
  return blockTagSet.has(tag);
}

export function $getBlockTag(selection: RangeSelection): BlockTag {
  const block = selection.anchor.getNode().getTopLevelElement();
  if (!block) throw new Error("Must have block");

  if ($isHeadingNode(block)) {
    const tag = block.getTag();
    if (!isSupportedHeadingTag(tag))
      throw new Error("Unsupported heading type");

    return tag;
  }

  if ($isListNode(block)) return block.getTag();

  if ($isDraggableParagraph(block)) return "p";

  throw new Error("Unsupported block type");
}
