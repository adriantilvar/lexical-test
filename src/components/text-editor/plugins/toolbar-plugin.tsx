"use client";
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $createQuoteNode, $isQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_NORMAL,
  type ElementFormatType,
  type ElementNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  getTransformSetFromKlass,
  type LexicalCommand,
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
  Baseline,
  Bold,
  Check,
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
import { Popover } from "@/components/ui/popover";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, invariant, not } from "@/lib/utils";
import {
  CHANGE_TEXT_COLOR,
  INSERT_BODY_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_QUOTE_COMMAND,
  type SupportedHeadingTag,
  type SupportedTextColor,
} from "../commands/block-commands";
import { INSERT_IMAGE_COMMAND, type InsertImagePayload } from "../commands/node-commands";
import {
  $deepCopyElementNode,
  $getNodeTag,
  $getSelectedBlockNodes,
  $getTopLevelNode,
  $isBlockWrapperNode,
  type BlockTag,
  isSupportedBlockTag,
  isSupportedHeadingTag,
} from "../lib/utils";
import { $createImageNode } from "../nodes/image-node";
import { $isRichParagraphNode } from "../nodes/rich-paragraph-node";

function Divider() {
  return <div className="border-r" />;
}

type ToolbarCommand<PayloadType> = {
  type: LexicalCommand<PayloadType>;
  payload: PayloadType;
  label: string;
  Icon: LucideIcon;
};

type BlockStyle = "Heading" | "Subheading" | "Sub-subheading" | "Body" | "Quote" | "Bulleted List" | "Numbered List";
type BlockStyleOption = { label: BlockStyle | "Mixed"; value: BlockTag | "mixed" };

const blockCommandMap = new Map([
  ["h2", { type: INSERT_HEADING_COMMAND, payload: "h2" }],
  ["h3", { type: INSERT_HEADING_COMMAND, payload: "h3" }],
  ["h4", { type: INSERT_HEADING_COMMAND, payload: "h4" }],
  ["p", { type: INSERT_BODY_COMMAND, payload: undefined }],
  ["blockquote", { type: INSERT_QUOTE_COMMAND, payload: undefined }],
  ["ul", { type: INSERT_UNORDERED_LIST_COMMAND, payload: undefined }],
  ["ol", { type: INSERT_ORDERED_LIST_COMMAND, payload: undefined }],
]);

const blockStyle: BlockStyleOption[] = [
  { label: "Heading", value: "h2" },
  { label: "Subheading", value: "h3" },
  { label: "Sub-subheading", value: "h4" },
  { label: "Body", value: "p" },
  { label: "Quote", value: "blockquote" },
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

function $getBodyInsertFn(): () => boolean {
  return function insertBody(): boolean {
    {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      const blocks = $getSelectedBlockNodes(selection).filter(not($isBlockWrapperNode));
      let endBlock: ElementNode = blocks[blocks.length - 1];

      blocks.forEach((block) => {
        if (!$isParagraphNode(block)) {
          const blockChildren = block.getChildren().map($deepCopyElementNode);
          const p = $createParagraphNode().append(...blockChildren);
          if (block.is(endBlock)) endBlock = p;

          block.replace(p);
          return;
        }

        const parent = block.getParent();
        if (!$isQuoteNode(parent)) return;

        const quoteChildren = parent.getChildren().map((child) => {
          invariant($isElementNode(child), "Child must be ElementNode");
          const clone = $deepCopyElementNode(child);
          if (child.is(endBlock)) endBlock = clone;

          return clone;
        });

        const quoteContainer = parent.getParent();
        invariant(quoteContainer !== null, "Quote parent must be nonnull");
        quoteContainer.splice(parent.getIndexWithinParent(), 1, quoteChildren);
      });

      endBlock.selectEnd();
      return true;
    }
  };
}

function $getHeadingInsertFn(): (payload: SupportedHeadingTag) => boolean {
  return function insertHeading(payload: SupportedHeadingTag): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !isSupportedHeadingTag(payload)) {
      return false;
    }

    $setBlocksType(
      selection,
      () => $createHeadingNode(payload),
      (node) => {
        const child = $createTextNode(node.getTextContent());
        node.clear();
        node.append(child);
        child.selectEnd();
      },
    );

    return true;
  };
}

function $getListInsertFn(listType: "bullet" | "number"): () => boolean {
  return function insertList(): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return false;

    const blocks = $getSelectedBlockNodes(selection).filter(not($isBlockWrapperNode));

    const startBlock = $getTopLevelNode(blocks[0]);
    invariant($isElementNode(startBlock), "Start block must be ElementNode");
    const container = startBlock.getParent();
    invariant($isElementNode(container), "Container must be ElementNode");
    const insertionIndex = startBlock.getIndexWithinParent();

    let endBlock: ElementNode = blocks[blocks.length - 1];

    const blocksToInsert: ListItemNode[] = [];

    blocks.forEach((block) => {
      const blockChildren = block.getChildren().map($deepCopyElementNode);
      const li = $createListItemNode().append(...blockChildren);

      if (block.is(endBlock)) endBlock = li;

      block.remove();
      blocksToInsert.push(li);
    });

    const ul = $createListNode(listType).append(...blocksToInsert);
    container.splice(insertionIndex, 0, [ul]);
    endBlock.selectEnd();

    return true;
  };
}

function $getQuoteInsertFn(): () => boolean {
  return function insertQuote(): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return false;

    const keysToInsert = new Set<string>();
    const keysToRemove = new Set<string>();
    const keysToCleanUp = new Set<string>();

    let insertionIndex: number | null = null;
    let container: ElementNode | null = null;

    for (const node of selection.getNodes()) {
      const block = $isElementNode(node) ? node : node.getParent();

      if ($isQuoteNode(block) || $isListNode(block)) {
        keysToCleanUp.add(block.getKey());
        continue;
      }

      invariant($isElementNode(block), "Selected block must be ElementNode");

      keysToInsert.add(block.getKey());
      keysToRemove.add(block.getKey());

      if (insertionIndex === null && container === null) {
        const topLevelBlock = $getTopLevelNode(block);
        invariant($isElementNode(topLevelBlock), "Top-level block must be ElementNode");
        insertionIndex = topLevelBlock.getIndexWithinParent();
        container = topLevelBlock.getParent();
      }
    }

    invariant(insertionIndex !== null, "Must have insertion index");
    invariant($isElementNode(container), "Must have container");

    const blocksToInsert: ElementNode[] = [];

    keysToInsert.forEach((key) => {
      const node = $getNodeByKey(key);
      invariant($isElementNode(node), "Node to insert must be ElementNode");

      blocksToInsert.push(
        $isListItemNode(node)
          ? $createParagraphNode().append(...node.getChildren().map($deepCopyElementNode))
          : $deepCopyElementNode(node),
      );
    });

    keysToRemove.forEach((key) => {
      $getNodeByKey(key)?.remove();
    });

    keysToCleanUp.forEach((key) => {
      const node = $getNodeByKey(key);
      invariant($isElementNode(node), "Node to clean up must be ElementNode");

      if (node.getChildrenSize() === 0) node.remove();
    });

    const quoteNode = $createQuoteNode().append(...blocksToInsert);
    container.splice(insertionIndex, 0, [quoteNode]);
    quoteNode.getLastChild()?.selectEnd();

    return true;
  };
}

function $getImageInsertFn(): (payload: InsertImagePayload) => boolean {
  return function insertImage(payload: InsertImagePayload) {
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
  };
}

function ToolbarButton({ className, ...props }: ComponentPropsWithRef<"button">) {
  return (
    <button
      type="button"
      className={`rounded-sm border size-6 flex items-center justify-center not-disabled:hover:bg-zinc-100 disabled:bg-zinc-50 disabled:[&_svg]:text-zinc-500 ${className ?? ""}`}
      {...props}
    />
  );
}

type ActiveSelection = {
  blockType: BlockTag | null;
  formatting: Set<string>;
  textColor: SupportedTextColor | null;
};

const EMPTY_FORMATTING = new Set<string>();
const DEFAULT_TEXT_COLOR = "zinc";

// TODO: Replace referential equality with LexicalNode.is
export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [activeSelection, setActiveSelection] = useState<ActiveSelection>({
    blockType: null,
    formatting: EMPTY_FORMATTING,
    textColor: DEFAULT_TEXT_COLOR,
  });

  // Image add
  const [open, setOpen] = useState(false);
  const [imageData, setImageData] = useState({ src: "", alt: "" });

  const handleAdd = () => {
    const root = editor.getRootElement();
    if (!root) throw new Error("Must have root");

    const rootWidth = root.getBoundingClientRect().width * 0.75;

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
    invariant(editor.hasNodes([ListNode, ListItemNode]), "ListNode and/or ListItemNode not registered");
  }, [editor]);

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            setCanRedo(payload);
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;

            const selectedBlocks = $getSelectedBlockNodes(selection);
            if (selectedBlocks.length === 1 && $isRootNode(selectedBlocks[0])) return false;

            const textColors = new Set<SupportedTextColor>();
            selectedBlocks.filter($isRichParagraphNode).forEach((block) => {
              textColors.add(block.getTextColor());
            });
            const textColor = textColors.size === 1 ? (textColors.values().next().value ?? null) : DEFAULT_TEXT_COLOR;

            const topLevelBlocksKeys = new Set<string>();
            const topLevelBlocks: ElementNode[] = [];

            selectedBlocks.forEach((block) => {
              const topLevelBlock = $getTopLevelNode(block);
              invariant($isElementNode(topLevelBlock), "Top-level block must be ElementNode");
              const blockKey = topLevelBlock.getKey();

              if (!topLevelBlocksKeys.has(blockKey)) {
                topLevelBlocksKeys.add(blockKey);
                topLevelBlocks.push(topLevelBlock);
              }
            });

            const blockTags = new Set<BlockTag>();
            topLevelBlocks.forEach((block) => {
              const tag = $getNodeTag(block);
              invariant(isSupportedBlockTag(tag), `Tag "${tag} is not BlockTag"`);
              blockTags.add(tag);
            });
            const blockType = blockTags.size === 1 ? (blockTags.values().next().value ?? null) : null;

            if (selection.isCollapsed()) {
              setActiveSelection({ blockType, formatting: EMPTY_FORMATTING, textColor });
              return true;
            }

            const formatTags = new Set<string>();
            if (selection.hasFormat("bold")) formatTags.add("bold");
            if (selection.hasFormat("italic")) formatTags.add("italic");
            if (selection.hasFormat("highlight")) formatTags.add("highlight");
            if (selection.hasFormat("strikethrough")) formatTags.add("strikethrough");

            setActiveSelection({
              blockType,
              formatting: formatTags.size > 0 ? formatTags : EMPTY_FORMATTING,
              textColor,
            });
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(INSERT_HEADING_COMMAND, $getHeadingInsertFn(), COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(INSERT_BODY_COMMAND, $getBodyInsertFn(), COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(INSERT_QUOTE_COMMAND, $getQuoteInsertFn(), COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(INSERT_UNORDERED_LIST_COMMAND, $getListInsertFn("bullet"), COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(INSERT_ORDERED_LIST_COMMAND, $getListInsertFn("number"), COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(INSERT_IMAGE_COMMAND, $getImageInsertFn(), COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(
          CHANGE_TEXT_COLOR,
          function changeTextColor(color: SupportedTextColor): boolean {
            {
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) return false;

              $getSelectedBlockNodes(selection)
                .filter($isRichParagraphNode)
                .forEach((block) => {
                  block.setTextColor(color);
                });

              return true;
            }
          },
          COMMAND_PRIORITY_NORMAL,
        ),
      ),
    [editor],
  );

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
        value={activeSelection.blockType}
        onValueChange={(value) => {
          if (!value || value === activeSelection.blockType) return;

          const command = blockCommandMap.get(value);
          if (!command) throw new Error("Must have registerd command");
          //@ts-expect-error Will provide the correct payload from blockCommandMap
          editor.dispatchCommand(command.type, command.payload);
        }}
      >
        <SelectTrigger size="sm" className="w-8">
          {activeSelection.blockType !== null ? <SelectValue /> : "Mixed"}
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
          className={activeSelection.formatting.has(payload) ? "bg-zinc-200" : ""}
          onClick={() => editor.dispatchCommand(type, payload)}
        >
          <Icon className="size-4 text-zinc-800" />
        </ToolbarButton>
      ))}

      <Popover.Root>
        <Popover.Trigger
          render={
            <ToolbarButton aria-label="Text Color">
              <Baseline className="size-4 text-zinc-800" />
            </ToolbarButton>
          }
        />

        <Popover.Portal>
          <Popover.Positioner sideOffset={8}>
            <Popover.Content className="flex flex-col gap-3">
              <Popover.Title className="text-sm font-medium text-muted-foreground">Text Color</Popover.Title>

              <div className="grid grid-cols-4 gap-2">
                {TEXT_COLORS.map((color) => (
                  <Button
                    size="xs"
                    key={color.label}
                    title={color.label}
                    onClick={() => editor.dispatchCommand(CHANGE_TEXT_COLOR, color.label)}
                    className={cn(color.class)}
                  >
                    {activeSelection.textColor === color.label && <Check className="size-3" />}
                  </Button>
                ))}
              </div>

              <Popover.Description className="sr-only">Choose a text color for the selected block.</Popover.Description>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <Divider />

      {alignmentButtons.map(({ type, payload, Icon, label }) => (
        <ToolbarButton key={payload} aria-label={label} onClick={() => editor.dispatchCommand(type, payload)}>
          <Icon className="size-4 text-zinc-800" />
        </ToolbarButton>
      ))}

      <Divider />

      <Button
        size="xs"
        onClick={() => localStorage.setItem("lexical-editor-state", JSON.stringify(editor.getEditorState()))}
      >
        <Download />
        Save
      </Button>

      {/*Component for adding image*/}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="xs" variant="outline" className="font-medium tracking-tight">
              Add Image
            </Button>
          }
        />
        <DialogContent className="max-w-md border border-zinc-200 bg-white p-0 shadow-lg rounded-xl overflow-hidden">
          {/* Header Section: Clear separation using background or subtle padding */}

          <DialogHeader>
            <DialogTitle>Add Image</DialogTitle>
            <DialogDescription>Provide the details below to embed an image into your content.</DialogDescription>
          </DialogHeader>

          {/* Content Area: Consistent spacing and alignment */}
          <div className="flex flex-col gap-5 px-6 py-2">
            <Field className="flex flex-col gap-1.5">
              <FieldLabel>Image Source</FieldLabel>
              <Input
                placeholder="https://example.com/image.jpg"
                type="url"
                value={imageData.src}
                onChange={(e) => setImageData((prev) => ({ ...prev, src: e.target.value }))}
                className="w-full text-sm border-zinc-200 focus:ring-1 focus:ring-zinc-900 transition-all rounded-md"
              />
            </Field>

            <Field className="flex flex-col gap-1.5">
              <FieldLabel>Alt Text</FieldLabel>
              <Input
                placeholder="Describe the image for accessibility..."
                type="text"
                value={imageData.alt}
                onChange={(e) => setImageData((prev) => ({ ...prev, alt: e.target.value }))}
                className="w-full text-sm border-zinc-200 focus:ring-1 focus:ring-zinc-900 transition-all rounded-md"
              />
            </Field>
          </div>

          {/* Footer: Subtle top border and right-aligned actions */}
          <DialogFooter className="mt-6 flex items-center justify-end gap-3 py-3 bg-zinc-50/50 border-t border-zinc-100">
            <DialogClose
              render={
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              }
            />
            <Button size="sm" onClick={handleAdd}>
              Add Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TEXT_COLORS: { label: SupportedTextColor; class: `bg-${SupportedTextColor}-${number}` }[] = [
  { label: "zinc", class: "bg-zinc-900" },
  { label: "orange", class: "bg-orange-900" },
  { label: "yellow", class: "bg-yellow-900" },
  { label: "green", class: "bg-green-900" },
  { label: "emerald", class: "bg-emerald-900" },
  { label: "cyan", class: "bg-cyan-900" },
  { label: "blue", class: "bg-blue-900" },
  { label: "violet", class: "bg-violet-900" },
  { label: "purple", class: "bg-purple-900" },
  { label: "fuchsia", class: "bg-fuchsia-900" },
  { label: "rose", class: "bg-rose-900" },
  { label: "red", class: "bg-red-900" },
];
