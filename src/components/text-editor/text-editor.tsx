"use client";
import { CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { ParagraphNode, TextNode } from "lexical";
import { Loader } from "lucide-react";
import dynamic from "next/dynamic";
import { use } from "react";
import {
  $createFormattedTextNode,
  FormattedTextNode,
} from "./nodes/formatted-text-node";
import { LimitedHistoryPlugin } from "./plugins/history-plugin";
import ToolbarPlugin from "./plugins/toolbar-plugin";

const nodes = [
  HeadingNode,
  ParagraphNode,
  FormattedTextNode,
  QuoteNode,
  LinkNode,
  AutoLinkNode,
  ListNode,
  ListItemNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  CodeNode,
  {
    replace: TextNode,
    with: (node: TextNode) => $createFormattedTextNode(node.getTextContent()),
    withKlass: FormattedTextNode,
  },
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
      <div className={`w-4xl  h-full ${className}`}>
        <ToolbarPlugin />
        <div className="border border-dashed relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none px-4 py-3 [&_span]:data-lexical-italic:italic [&_span]:data-lexical-bold:font-semibold [&_span]:data-lexical-strikethrough:line-through [&_span]:data-lexical-highlight:bg-amber-100 [&_span]:data-lexical-highlight:text-amber-900 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:text-lg"
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
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <LimitedHistoryPlugin limit={30} />
          <AutoFocusPlugin />
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
