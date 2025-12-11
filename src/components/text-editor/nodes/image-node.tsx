import {
  $create,
  $getState,
  $setState,
  createState,
  DecoratorNode,
  type LexicalNode,
} from "lexical";
import type { ImgHTMLAttributes, ReactElement } from "react";

type ImageElement = ReactElement<ImgHTMLAttributes<HTMLImageElement>, "img">;

const sourceState = createState("source", {
  parse: (value) => (typeof value === "string" ? value : ""),
});

const altState = createState("alt", {
  parse: (value) => (typeof value === "string" ? value : ""),
});

const widthState = createState("width", {
  parse: (value) => (typeof value === "number" ? value : 320),
});

export class ImageNode extends DecoratorNode<ImageElement> {
  $config() {
    return this.config("image-node", {
      extends: DecoratorNode,
      stateConfigs: [
        { flat: true, stateConfig: sourceState },
        { flat: true, stateConfig: altState },
        { flat: true, stateConfig: widthState },
      ],
    });
  }

  createDOM(): HTMLDivElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  decorate(): ImageElement {
    return (
      // biome-ignore lint/performance/noImgElement: This is a test
      <img
        src={$getState(this, sourceState)}
        alt={$getState(this, altState)}
        width={$getState(this, widthState)}
        height="auto"
      />
    );
  }
}

export function $createImageNode(
  src: string,
  alt: string,
  width: number,
): ImageNode {
  const imageNode = $create(ImageNode);
  $setState(imageNode, sourceState, src);
  $setState(imageNode, altState, alt);
  $setState(imageNode, widthState, width);

  return imageNode;
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode;
}
