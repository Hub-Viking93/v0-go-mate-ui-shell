

import { RefreshCw, WifiOff, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatError {
  code?: number;
  message: string;
  retryable: boolean;
  type: "network" | "rate_limit" | "server" | "unknown";
}

interface ChatErrorMessageProps {
  error: ChatError;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function ChatErrorMessage({
  error,
  onRetry,
  isRetrying,
  className,
}: ChatErrorMessageProps) {
  const getIcon = () => {
    switch (error.type) {
      case "network":
        return <WifiOff className="w-5 h-5" />;
      case "rate_limit":
        return <Clock className="w-5 h-5" />;
      case "server":
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getTitle = () => {
    switch (error.type) {
      case "network":
        return "You're offline";
      case "rate_limit":
        return "Too many requests";
      case "server":
        return "Service unavailable";
      default:
        return "Something went wrong";
    }
  };

  const getBgColor = () => {
    switch (error.type) {
      case "network":
        return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
      case "rate_limit":
        return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
      case "server":
        return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
      default:
        return "bg-muted border-border";
    }
  };

  const getTextColor = () => {
    switch (error.type) {
      case "network":
        return "text-amber-700 dark:text-amber-300";
      case "rate_limit":
        return "text-blue-700 dark:text-blue-300";
      case "server":
        return "text-red-700 dark:text-red-300";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className={cn("flex justify-start animate-fade-in", className)}>
      <div
        className={cn("rounded-xl px-4 py-3 max-w-[85%] border", getBgColor())}
      >
        <div className={cn("flex items-start gap-3", getTextColor())}>
          <div className="mt-0.5">{getIcon()}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{getTitle()}</p>
            <p className="text-sm opacity-80 mt-0.5">{error.message}</p>

            {error.retryable && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                className="mt-3 h-8 text-xs bg-transparent"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                    Try again
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function parseError(error: unknown, statusCode?: number): ChatError {
  const errorObj = error as { message?: string; code?: number; status?: number } | null;
  
  if (typeof window !== "undefined" && !navigator.onLine) {
    return {
      message: "Check your internet connection and try again.",
      retryable: true,
      type: "network",
    };
  }

  const code = statusCode || errorObj?.code || errorObj?.status;

  if (code === 429) {
    return {
      code: 429,
      message: "Please wait a moment before sending another message.",
      retryable: true,
      type: "rate_limit",
    };
  }

  if (code === 503 || code === 502 || code === 504) {
    return {
      code,
      message:
        "The AI service is temporarily busy. This usually resolves in a few seconds.",
      retryable: true,
      type: "server",
    };
  }

  if (code === 500) {
    return {
      code: 500,
      message: "A server error occurred. Please try again.",
      retryable: true,
      type: "server",
    };
  }

  return {
    code,
    message: errorObj?.message || "An unexpected error occurred. Please try again.",
    retryable: true,
    type: "unknown",
  };
}
