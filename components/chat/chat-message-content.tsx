"use client";

import ReactMarkdown from "react-markdown";

interface ChatMessageContentProps {
  content: string;
  role: "user" | "assistant";
}

export function ChatMessageContent({ content, role }: ChatMessageContentProps) {
  if (role === "user") {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
    );
  }

  return (
    <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:text-foreground prose-strong:text-foreground prose-em:text-muted-foreground">
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
