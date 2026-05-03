

import { useState, useEffect, useRef, useMemo } from "react";
import { ChatMessageContent } from "./chat-message-content";

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
  wordsPerSecond?: number;
}

export function StreamingText({
  content,
  isStreaming,
  wordsPerSecond = 25,
}: StreamingTextProps) {
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const lastContentRef = useRef("");
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const words = useMemo(() => {
    return content.split(/(\s+)/).filter(Boolean);
  }, [content]);

  const wordDelay = 1000 / wordsPerSecond;

  useEffect(() => {
    if (content !== lastContentRef.current) {
      const previousLength = lastContentRef.current
        .split(/(\s+)/)
        .filter(Boolean).length;
      lastContentRef.current = content;

      if (words.length > previousLength && isStreaming) {
        setVisibleWordCount((prev) => Math.max(prev, previousLength));
      } else if (!isStreaming) {
        setVisibleWordCount(words.length);
      }
    }
  }, [content, words.length, isStreaming]);

  useEffect(() => {
    if (!isStreaming && visibleWordCount >= words.length) {
      return;
    }

    const animate = (timestamp: number) => {
      if (visibleWordCount >= words.length) {
        return;
      }

      const elapsed = timestamp - lastUpdateRef.current;

      if (elapsed >= wordDelay) {
        setVisibleWordCount((prev) => {
          const next = Math.min(prev + 1, words.length);
          return next;
        });
        lastUpdateRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isStreaming, visibleWordCount, words.length, wordDelay]);

  useEffect(() => {
    if (!isStreaming) {
      setVisibleWordCount(words.length);
    }
  }, [isStreaming, words.length]);

  const visibleText = useMemo(() => {
    return words.slice(0, visibleWordCount).join("");
  }, [words, visibleWordCount]);

  const showCursor = isStreaming && visibleWordCount < words.length;

  return (
    <div className="relative">
      <ChatMessageContent content={visibleText} role="assistant" />
      {showCursor && (
        <span className="inline-block w-0.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
}
