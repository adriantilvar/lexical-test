"use client";
import {
  $createListNode,
  $isListItemNode,
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  type ListType,
} from "@lexical/list";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $createQuoteNode, $isQuoteNode } from "@lexical/rich-text";
import { $setBlocksType, $wrapNodes } from "@lexical/selection";
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
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_NORMAL,
  type CommandListener,
  type ElementFormatType,
  type ElementNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  type LexicalCommand,
  type LexicalNode,
  type ParagraphNode,
  REDO_COMMAND,
  RootNode,
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
import { invariant } from "@/lib/utils";
import {
  INSERT_BODY_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_QUOTE_COMMAND,
} from "../commands/block-commands";
import { INSERT_IMAGE_COMMAND } from "../commands/node-commands";
import {
  $deepCopyElementNode,
  $getElementTag,
  $getSiblingsBetween,
  $getTopLevelNode,
  $isBlockElementNode,
  $isContainerNode,
  type BlockTag,
  isSupportedBlockTag,
  isSupportedHeadingTag,
} from "../lib/utils";
import { $isGridItemNode } from "../nodes/grid-item-node";
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
  | "Quote"
  | "Bulleted List"
  | "Numbered List";
type BlockStyleOption = { label: BlockStyle; value: BlockTag };

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
  // TODO: Is it better to get the block directly?
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

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;
            const topLevelBlock = $getTopLevelNode(selection.anchor.getNode());
            const anchorBlock = selection.anchor.getNode().getParent();
            if ($isRootNode(anchorBlock) || $isGridItemNode(anchorBlock) || anchorBlock === null) {
              return false;
            }

            // $1: This fucks up with the insertion commands
            // const tag = $getElementTag(topLevelBlock);

            const tag = $isListItemNode(topLevelBlock)
              ? $getElementTag(anchorBlock.getParent())
              : $getElementTag(anchorBlock);
            invariant(isSupportedBlockTag(tag), "Must be supported block");
            setBlockType(tag);

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
                  node.clear();
                  node.append(child);
                  child.selectEnd();
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

            const selectionEdgePoints = selection.getStartEndPoints();
            invariant(selectionEdgePoints, "Must have selection edge points");

            const [anchorBlock, focusBlock] = selectionEdgePoints
              .map((point) => $getNodeByKey(point.key))
              .map((node) => node?.getParent());
            invariant($isBlockElementNode(anchorBlock), "anchorBlock must be ElementNode");
            invariant($isBlockElementNode(focusBlock), "focusBlock must be ElementNode");

            const selectedBlocks = $getSiblingsBetween(anchorBlock, focusBlock);

            const blockKeysToRemove = new Set<string>();

            selectedBlocks.forEach((block) => {
              invariant($isBlockElementNode(block), "Selected block must be ElementNode");
              const blockParent = block.getParent();
              invariant($isElementNode(blockParent), "Block parent must be ElementNode");

              if (!$isParagraphNode(block)) {
                const blockChildren = block.getChildren().map($deepCopyElementNode);
                block.replace($createParagraphNode().append(...blockChildren));
              }

              if ($isQuoteNode(blockParent)) blockKeysToRemove.add(blockParent.getKey());
            });

            // BUG: Inside GridItem, removing QuoteNode triggers error; probably caused by $1
            blockKeysToRemove.forEach((key) => {
              const block = $getNodeByKey(key);
              invariant($isElementNode(block), "Node to remove must be ElementNode");

              const blockChildren = block.getChildren().map($deepCopyElementNode);
              const blockParent = block.getParent();
              invariant($isElementNode(blockParent), "Block parent must be ElementNode");

              blockParent.splice(block.getIndexWithinParent(), 1, blockChildren);
            });

            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          INSERT_QUOTE_COMMAND,
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;

            editor.update(() => {
              const keysToInsert = new Set<string>();
              const keysToRemove = new Set<string>();
              const keysToCleanUp = new Set<string>();

              let insertionIndex: number | null = null;
              let container: ElementNode | null = null;

              for (const node of selection.getNodes()) {
                const block = $isBlockElementNode(node) ? node : node.getParent();

                if ($isQuoteNode(block) || $isListNode(block)) {
                  keysToCleanUp.add(block.getKey());
                  continue;
                }

                invariant($isBlockElementNode(block), "Selected block must be ElementNode");

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
            });

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
