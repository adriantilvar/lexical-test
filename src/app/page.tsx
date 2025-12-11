import TextEditor from "@/components/text-editor/text-editor";

const INITIAL_MARKDOWN =
  "Hello from **the *other* side**\n\nI have something to tell ~~you~~ someone";

export default function Home() {
  const initialMarkdown: Promise<string> = new Promise((resolve) =>
    resolve(INITIAL_MARKDOWN),
  );

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black py-12">
      <h1>Lexical Editor Test</h1>

      <TextEditor className="flex-1" initialContent={initialMarkdown} />
    </div>
  );
}
