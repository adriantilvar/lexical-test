"use client";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ParagraphNode, TextNode } from "lexical";
import { Loader } from "lucide-react";
import dynamic from "next/dynamic";
import { use } from "react";
import { cn } from "@/lib/utils";
import { GridItemNode } from "./nodes/grid-item-node";
import { GridNode } from "./nodes/grid-node";
import { ImageNode } from "./nodes/image-node";
import { $createRichTextNode, RichTextNode } from "./nodes/rich-text-node";
import { DragAndDropPlugin } from "./plugins/drag-and-drop-plugin";
import { LimitedHistoryPlugin } from "./plugins/history-plugin";
import ToolbarPlugin from "./plugins/toolbar-plugin";

const nodes = [
  RichTextNode,
  {
    replace: TextNode,
    with: (node: TextNode) => $createRichTextNode(node.getTextContent()),
    withKlass: RichTextNode,
  },
  ParagraphNode,
  HeadingNode,
  QuoteNode,
  GridNode,
  GridItemNode,
  ListNode,
  ListItemNode,
  ImageNode,
];

const theme = {};

function onError(error: Error) {
  console.error(error);
}

function TextEditor({
  initialContent,
  className,
}: {
  initialContent: Promise<string>;
  className?: string;
}) {
  const content = use(initialContent);
  const initialConfig = {
    editorState: () => $convertFromMarkdownString(content, TRANSFORMERS),
    namespace: "TextEditor",
    nodes,
    theme,
    onError,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={cn("max-w-6xl w-full px-8 flex flex-col", className)}>
        <ToolbarPlugin />
        <div className="border-2 border-dashed relative flex-1">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none px-8 py-6"
                aria-placeholder={"You can start typing..."}
                placeholder={
                  <div className="absolute left-4 top-3 select-none pointer-events-none text-zinc-400">
                    You can start typing...
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <DragAndDropPlugin />
          <AutoFocusPlugin />
          <LimitedHistoryPlugin limit={30} />
        </div>
      </div>
    </LexicalComposer>
  );
}

export default dynamic(() => Promise.resolve(TextEditor), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-40">
      <Loader className="animate-spin" />
    </div>
  ),
});
