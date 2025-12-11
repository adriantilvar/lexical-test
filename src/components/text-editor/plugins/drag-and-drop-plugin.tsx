import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { COMMAND_PRIORITY_NORMAL, DROP_COMMAND } from "lexical";
import { useEffect } from "react";
import { DraggableParagraph } from "../nodes/draggable-paragraph-node";

export function DragAndDropPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // return editor.registerCommand(
    //   DROP_COMMAND,
    //   (e) => {
    //     console.log("Drop: ", e);
    //     return true;
    //   },
    //   COMMAND_PRIORITY_NORMAL,
    // );
    return mergeRegister(
      editor.registerMutationListener(
        DraggableParagraph,
        (mutations, payload) => {
          console.log(`mutations: `, mutations);

          for (const [nodeKey, mutation] of mutations) {
            if (mutation === "created") {
              console.log(`${nodeKey} created!`);
            } else if (mutation === "destroyed") {
              console.log(`${nodeKey} destroyed!`);
            }
          }
        },
      ),
    );
  }, [editor]);

  return null;
}
