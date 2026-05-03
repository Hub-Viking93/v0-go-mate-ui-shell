

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QuestionCardProps {
  question: string
  options: string[]
  onSelect?: (option: string) => void
  selectedOption?: string
  className?: string
}

export function QuestionCard({ question, options, onSelect, selectedOption, className }: QuestionCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border border-primary/20 bg-primary/5 p-5",
      className
    )}>
      <p className="font-medium text-foreground mb-4">{question}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            variant={selectedOption === option ? "default" : "outline"}
            size="sm"
            onClick={() => onSelect?.(option)}
            className="rounded-full"
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  )
}
