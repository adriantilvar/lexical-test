"use client";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_NORMAL,
  type ElementFormatType,
  type ElementNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  type LexicalCommand,
  type RangeSelection,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type TextFormatType,
  UNDO_COMMAND,
} from "lexical";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Highlighter,
  Italic,
  type LucideIcon,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react";
import { type ComponentPropsWithRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type BlockFormatType,
  FORMAT_BLOCK_COMMAND,
} from "../commands/block-commands";

function Divider() {
  return <div className="border-r" />;
}

type ToolbarCommand<PayloadType> = {
  type: LexicalCommand<PayloadType>;
  payload: PayloadType;
  label: string;
  Icon: LucideIcon;
};

type BlockStyle = "Heading" | "Subheading" | "Body";
type BlockStyleOption = { label: BlockStyle; value: BlockFormatType };

const blockStyle: BlockStyleOption[] = [
  { label: "Heading", value: "h2" },
  { label: "Subheading", value: "h3" },
  { label: "Body", value: "p" },
];

const textFormatButtons: ToolbarCommand<TextFormatType>[] = [
  {
    type: FORMAT_TEXT_COMMAND,
    payload: "bold",
    label: "Format Bold",
    Icon: Bold,
  },
  {
    type: FORMAT_TEXT_COMMAND,
    payload: "italic",
    label: "Format Italics",
    Icon: Italic,
  },
  {
    type: FORMAT_TEXT_COMMAND,
    payload: "highlight",
    label: "Format Highlight",
    Icon: Highlighter,
  },
  {
    type: FORMAT_TEXT_COMMAND,
    payload: "strikethrough",
    label: "Format Strikethrough",
    Icon: Strikethrough,
  },
];

const alignmentButtons: ToolbarCommand<ElementFormatType>[] = [
  {
    type: FORMAT_ELEMENT_COMMAND,
    payload: "left",
    label: "Left Align",
    Icon: AlignLeft,
  },
  {
    type: FORMAT_ELEMENT_COMMAND,
    payload: "center",
    label: "Center Align",
    Icon: AlignCenter,
  },
  {
    type: FORMAT_ELEMENT_COMMAND,
    payload: "right",
    label: "Right Align",
    Icon: AlignRight,
  },
  {
    type: FORMAT_ELEMENT_COMMAND,
    payload: "justify",
    label: "Justify Align",
    Icon: AlignJustify,
  },
];

function ToolbarButton({
  className,
  ...props
}: ComponentPropsWithRef<"button">) {
  return (
    <button
      type="button"
      className={`rounded-sm border size-6 flex items-center justify-center not-disabled:hover:bg-zinc-100 disabled:bg-zinc-50 disabled:[&_svg]:text-zinc-500 ${className ?? ""}`}
      {...props}
    />
  );
}

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [activeTags, setActiveTags] = useState<Set<string> | null>(null);
  const [blockType, setBlockType] = useState<BlockFormatType>("p");

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;

          setBlockType($getBlockFormatType(selection));

          if (selection.isCollapsed() && !activeTags) return false;
          if (selection.isCollapsed()) {
            setActiveTags(null);
            return false;
          }

          const tags = new Set<string>();
          if (selection.hasFormat("bold")) tags.add("bold");
          if (selection.hasFormat("italic")) tags.add("italic");
          if (selection.hasFormat("highlight")) tags.add("highlight");
          if (selection.hasFormat("strikethrough")) tags.add("strikethrough");
          if (tags.size > 0) setActiveTags(tags);

          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        FORMAT_BLOCK_COMMAND,
        (payload) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;

          if (payload === "p") {
            editor.update(() =>
              $setBlocksType(selection, () => $createParagraphNode()),
            );
            
            return true;
          }

          if (isSupportedHeading(payload)) {
            editor.update(() =>
              $setBlocksType(
                selection,
                () => $createHeadingNode(payload),
                (node) => {
                  const child = $createTextNode(node.getTextContent());
                  const length = child.__text.length;

                  node.clear();
                  node.append(child);
                  selection.setTextNodeRange(child, length, child, length);
                },
              ),
            );
            
            return true;
          }

          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
    // TODO: Not sure having activeTags as a dependency is too good
  }, [editor, activeTags]);

  return (
    <div className="flex my-1 p-1 rounded-lg align-middle items-center gap-x-1">
      <ToolbarButton
        disabled={!canUndo}
        aria-label="Undo"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        <Undo className="size-4 text-zinc-800" />
      </ToolbarButton>

      <ToolbarButton
        disabled={!canRedo}
        aria-label="Redo"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        <Redo className="size-4 text-zinc-800" />
      </ToolbarButton>

      <Divider />

      <Select
        items={blockStyle}
        aria-label="Select text style"
        value={blockType}
        onValueChange={(value) => {
          if (!value || value === blockType) return;

          editor.dispatchCommand(FORMAT_BLOCK_COMMAND, value);
        }}
      >
        <SelectTrigger size="sm" className="w-8">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup alignItemWithTrigger={false}>
          {blockStyle.map(({ label, value }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>

      <Divider />

      {textFormatButtons.map(({ type, payload, Icon, label }) => (
        <ToolbarButton
          key={payload}
          aria-label={label}
          className={activeTags?.has(payload) ? "bg-zinc-200" : ""}
          onClick={() => editor.dispatchCommand(type, payload)}
        >
          <Icon className="size-4 text-zinc-800" />
        </ToolbarButton>
      ))}

      <Divider />

      {alignmentButtons.map(({ type, payload, Icon, label }) => (
        <ToolbarButton
          key={payload}
          aria-label={label}
          onClick={() => editor.dispatchCommand(type, payload)}
        >
          <Icon className="size-4 text-zinc-800" />
        </ToolbarButton>
      ))}

      <Divider />

      <Button
        size="xs"
        onClick={() => {
          editor.read(() => {
            const markdown = $convertToMarkdownString(TRANSFORMERS);
            console.log(markdown);
          });
        }}
      >
        <Download />
        Export Markdown
      </Button>
    </div>
  );
}

function isSupportedHeading(tag: string): tag is BlockFormatType {
  return /^h[2-4]$/.test(tag);
}

function $getBlockFormatType(selection: RangeSelection): BlockFormatType {
  const block = selection.anchor.getNode().getTopLevelElement();
  if (!block) throw new Error("Must have block");

  if ($isHeadingNode(block)) {
    const tag = block.getTag();
    if (!isSupportedHeading(tag)) throw new Error("Unsupported block type");

    return tag;
  }

  if (block.getType() === "paragraph") return "p";

  throw new Error("Unsupported block type");
}
