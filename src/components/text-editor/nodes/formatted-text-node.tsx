import {
  $create,
  type EditorConfig,
  type LexicalNode,
  TextNode,
} from "lexical";

export class FormattedTextNode extends TextNode {
  $config() {
    return this.config("formatted-text-node", { extends: TextNode });
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("span");
    this.applyFormatToDOM(dom);
    dom.textContent = this.__text;

    return dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    if (super.updateDOM(prevNode, dom, config)) return true;

    if (prevNode.__format !== this.__format) {
      this.applyFormatToDOM(dom);
    }

    return false;
  }

  applyFormatToDOM(dom: HTMLElement) {
    if (this.hasFormat("bold")) {
      dom.setAttribute("data-lexical-bold", "");
    } else dom.removeAttribute("data-lexical-bold");

    if (this.hasFormat("italic")) {
      dom.setAttribute("data-lexical-italic", "");
    } else dom.removeAttribute("data-lexical-italic");

    if (this.hasFormat("highlight")) {
      dom.setAttribute("data-lexical-highlight", "");
    } else dom.removeAttribute("data-lexical-highlight");

    if (this.hasFormat("strikethrough")) {
      dom.setAttribute("data-lexical-strikethrough", "");
    } else dom.removeAttribute("data-lexical-strikethrough");
  }
}

export function $createFormattedTextNode(text: string): FormattedTextNode {
  return $create(FormattedTextNode).setTextContent(text);
}

export function $isFormattedTextNode(
  node: LexicalNode | null | undefined,
): node is FormattedTextNode {
  return node instanceof FormattedTextNode;
}
