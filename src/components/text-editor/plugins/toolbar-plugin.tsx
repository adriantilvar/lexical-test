"use client";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  type ListNodeTagType,
} from "@lexical/list";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
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
  INSERT_PARAGRAPH_COMMAND,
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
  List,
  ListOrdered,
  type LucideIcon,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react";
import { type ComponentPropsWithRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INSERT_BODY_COMMAND,
  INSERT_HEADING_COMMAND,
  type SupportedHeadingTag,
} from "../commands/block-commands";
import { INSERT_IMAGE_COMMAND } from "../commands/node-commands";
import type { BlockTag } from "../lib/types";
import { $getBlockTag, isSupportedHeadingTag } from "../lib/utils";
import { $createImageNode } from "../nodes/image-node";

function Divider() {
  return <div className="border-r" />;
}

type ToolbarCommand<PayloadType> = {
  type: LexicalCommand<PayloadType>;
  payload: PayloadType;
  label: string;
  Icon: LucideIcon;
};

type BlockStyle =
  | "Heading"
  | "Subheading"
  | "Sub-subheading"
  | "Body"
  | "Bulleted List"
  | "Numbered List";
type BlockStyleOption = { label: BlockStyle; value: BlockTag };

const blockCommandMap = new Map([
  ["h2", { type: INSERT_HEADING_COMMAND, payload: "h2" }],
  ["h3", { type: INSERT_HEADING_COMMAND, payload: "h3" }],
  ["h4", { type: INSERT_HEADING_COMMAND, payload: "h4" }],
  ["p", { type: INSERT_BODY_COMMAND, payload: undefined }],
  ["ul", { type: INSERT_UNORDERED_LIST_COMMAND, payload: undefined }],
  ["ol", { type: INSERT_ORDERED_LIST_COMMAND, payload: undefined }],
]);

const blockStyle: BlockStyleOption[] = [
  { label: "Heading", value: "h2" },
  { label: "Subheading", value: "h3" },
  { label: "Sub-subheading", value: "h4" },
  { label: "Body", value: "p" },
  { label: "Bulleted List", value: "ul" },
  { label: "Numbered List", value: "ol" },
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

function ToolbarButton({ className, ...props }: ComponentPropsWithRef<"button">) {
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
  const [blockType, setBlockType] = useState<BlockTag>("p");

  // Image add
  const [open, setOpen] = useState(false);
  const [imageData, setImageData] = useState({ src: "", alt: "" });

  const handleAdd = () => {
    const root = editor.getRootElement();
    if (!root) throw new Error("Must have root");

    const rootWidth = root.getBoundingClientRect().width;

    editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
      ...imageData,
      width: rootWidth,
    });
    setOpen(false);
    setImageData({ src: "", alt: "" });
  };

  const handleCancel = () => {
    setOpen(false);
    setImageData({ src: "", alt: "" });
  };

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;

          setBlockType($getBlockTag(selection));

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
        INSERT_HEADING_COMMAND,
        (payload) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !isSupportedHeadingTag(payload)) {
            return false;
          }

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
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;

          const imageNode = $createImageNode(payload.src, payload.alt, payload.width);
          const emptyText = $createTextNode(" ");
          const emptyParagraph = $createParagraphNode();
          emptyParagraph.append(emptyText);

          const root = $getRoot();
          root.append(imageNode);
          root.append(emptyParagraph);

          selection.setTextNodeRange(emptyText, 0, emptyText, 0);

          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        INSERT_BODY_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;

          editor.update(() => $setBlocksType(selection, () => $createParagraphNode()));
          return true;
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

          const command = blockCommandMap.get(value);
          if (!command) throw new Error("Must have registerd command");
          //@ts-expect-error Will provide the correct payload from blockCommandMap
          editor.dispatchCommand(command.type, command.payload);
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

      {/*Component for adding image*/}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="xs" variant="outline">
              Add Image
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Image</DialogTitle>
            <DialogDescription>Enter the image source URL and alternative text.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <Field>
              <FieldLabel>Image Source</FieldLabel>
              <Input
                placeholder="https://example.com/image.jpg"
                type="url"
                value={imageData.src}
                onChange={(e) => setImageData((prev) => ({ ...prev, src: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel>Alt Text</FieldLabel>
              <Input
                placeholder="Description of the image"
                type="text"
                value={imageData.alt}
                onChange={(e) => setImageData((prev) => ({ ...prev, alt: e.target.value }))}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              }
            />

            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
