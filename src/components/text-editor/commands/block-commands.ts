import { createCommand } from "lexical";

export type BlockFormatType = "h2" | "h3" | "p";

export const FORMAT_BLOCK_COMMAND = createCommand<BlockFormatType>(
  "FORMAT_BLOCK_COMMAND",
);
