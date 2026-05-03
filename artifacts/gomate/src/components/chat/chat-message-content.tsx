

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { CheckCircle2 } from "lucide-react";

const TASK_DONE_REGEX = /\[TASK_DONE:(.+?)\]/g;

function parseTaskMarkers(text: string) {
  const markers: string[] = [];
  let match;
  while ((match = TASK_DONE_REGEX.exec(text)) !== null) {
    markers.push(match[1]);
  }
  const cleanText = text.replace(TASK_DONE_REGEX, "").trimEnd();
  return { cleanText, markers };
}

interface ChatMessageContentProps {
  content: string;
  role?: "user" | "assistant";
  isStreaming?: boolean;
}

export function ChatMessageContent({ content, role = "assistant" }: ChatMessageContentProps) {
  const processedRef = useRef<Set<string>>(new Set());

  // Extract and process task completion markers
  const { cleanText, markers } = role === "assistant"
    ? parseTaskMarkers(content)
    : { cleanText: content, markers: [] as string[] };

  // Auto-complete tasks via API when markers are detected
  useEffect(() => {
    if (markers.length === 0) return;
    for (const taskTitle of markers) {
      if (processedRef.current.has(taskTitle)) continue;
      processedRef.current.add(taskTitle);
      // Fire-and-forget: call the settling-in list API to find the task by title and mark complete
      (async () => {
        try {
          const listRes = await fetch("/api/settling-in");
          if (!listRes.ok) return;
          const data = await listRes.json();
          const task = data.tasks?.find(
            (t: { title: string; status: string }) =>
              t.title.toLowerCase() === taskTitle.toLowerCase() && t.status !== "completed"
          );
          if (task) {
            await fetch(`/api/settling-in/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "completed" }),
            });
          }
        } catch {
          // Silently fail — user can still mark tasks manually
        }
      })();
    }
  }, [markers]);

  if (role === "user") {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
    );
  }

  return (
    <div className="text-sm leading-relaxed">
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-foreground prose-strong:text-foreground prose-em:text-muted-foreground">
      <ReactMarkdown
        components={{
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-muted-foreground">{children}</em>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-2 ml-4 space-y-1 list-disc marker:text-primary">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 space-y-1 list-decimal marker:text-primary">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-foreground">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-4 border-l-2 border-primary/50 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80 transition-colors"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
              {children}
            </code>
          ),
        }}
      >
        {cleanText}
      </ReactMarkdown>
      </div>
      {markers.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {markers.map((title) => (
            <div
              key={title}
              className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-primary font-medium">
                Task completed: {title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
