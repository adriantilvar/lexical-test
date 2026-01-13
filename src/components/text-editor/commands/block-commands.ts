import { createCommand } from "lexical";

export type SupportedHeadingTag = "h2" | "h3" | "h4";

export const INSERT_HEADING_COMMAND = createCommand<SupportedHeadingTag>("INSERT_HEADING_COMMAND");

export const INSERT_BODY_COMMAND = createCommand<"p">("INSERT_BODY_COMMAND");

export const INSERT_QUOTE_COMMAND = createCommand<"blockquote">("INSERT_QUOTE_COMMAND");

export type SupportedTextColor =
  | "zinc"
  | "orange"
  | "yellow"
  | "green"
  | "emerald"
  | "cyan"
  | "blue"
  | "violet"
  | "purple"
  | "fuchsia"
  | "rose"
  | "red";

export const CHANGE_TEXT_COLOR = createCommand<SupportedTextColor>("CHANGE_TEXT_COLOR");
