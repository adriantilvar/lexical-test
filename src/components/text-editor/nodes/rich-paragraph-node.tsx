import {
  $create,
  $getState,
  $setState,
  createState,
  type EditorConfig,
  type LexicalNode,
  ParagraphNode,
  TextNode,
} from "lexical";
import { invariant } from "@/lib/utils";
import type { SupportedTextColor } from "../commands/block-commands";
import { isSupportedTextColor } from "../lib/utils";

const textColorState = createState("textColor", {
  parse: (value) => (isSupportedTextColor(value) ? value : "zinc"),
});

export class RichParagraphNode extends ParagraphNode {
  $config() {
    return this.config("rich-paragraph-node", { extends: TextNode });
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("p");
    dom.classList.add("lexical-block");
    dom.setAttribute("data-text-color", $getState(this, textColorState));

    return dom;
  }

  remove() {
    super.remove();
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    if (super.updateDOM(prevNode, dom, config)) return true;

    return $getState(prevNode, textColorState) === $getState(this, textColorState);
  }

  getTextColor(): SupportedTextColor {
    return $getState(this, textColorState);
  }

  setTextColor(color: SupportedTextColor): void {
    invariant(isSupportedTextColor(color), `Color '${color}' is not supported`);

    $setState(this, textColorState, color);
  }
}

export function $createRichParagraphNode(): RichParagraphNode {
  return $setState($create(RichParagraphNode), textColorState, "zinc");
}

export function $isRichParagraphNode(node: LexicalNode | null | undefined): node is RichParagraphNode {
  return node instanceof RichParagraphNode;
}
