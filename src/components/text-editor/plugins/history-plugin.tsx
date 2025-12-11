import { createEmptyHistoryState } from "@lexical/history";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { useEffect } from "react";

export function LimitedHistoryPlugin({
  limit = 50,
  delay = 1000,
}: {
  limit?: number;
  delay?: number;
}) {
  const [editor] = useLexicalComposerContext();

  const historyState = createEmptyHistoryState();

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      const { undoStack, redoStack } = historyState;

      if (undoStack.length > limit) {
        historyState.undoStack = undoStack.slice(-limit);
      }

      if (redoStack.length > limit) {
        historyState.redoStack = redoStack.slice(-limit);
      }
    });
  }, [editor, historyState, limit]);

  return <HistoryPlugin externalHistoryState={historyState} delay={delay} />;
}
