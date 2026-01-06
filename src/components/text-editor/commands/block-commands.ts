import { createCommand } from "lexical";

export type SupportedHeadingTag = "h2" | "h3" | "h4";

export const INSERT_HEADING_COMMAND = createCommand<SupportedHeadingTag>("INSERT_HEADING_COMMAND");

export const INSERT_BODY_COMMAND = createCommand<"p">("INSERT_BODY_COMMAND");

export const INSERT_QUOTE_COMMAND = createCommand<"blockquote">("INSERT_QUOTE_COMMAND");
