import { createCommand } from "lexical";

export type InsertImagePayload = {
  src: string;
  alt: string;
  width: number;
};

export const INSERT_IMAGE_COMMAND = createCommand<InsertImagePayload>("INSERT_BODY_COMMAND");
