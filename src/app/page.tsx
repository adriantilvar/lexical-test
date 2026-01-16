import TextEditor from "@/components/text-editor/text-editor";
import { cn } from "@/lib/utils";

const INITIAL_MARKDOWN = "Hello from **the *other* side**\n\nI have something to tell ~~you~~ someone";

export default function Home() {
  const initialMarkdown: Promise<string> = new Promise((resolve) => resolve(INITIAL_MARKDOWN));

  function test(state: string): string | undefined {
    return state;
  }

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black py-12",
        test,
      )}
    >
      <h1>Lexical Editor Test</h1>

      <TextEditor className="flex-1" initialContent={initialMarkdown} />
    </div>
  );
}
