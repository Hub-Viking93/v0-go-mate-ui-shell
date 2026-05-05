import * as React from "react"
import { X, Plus, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LANGUAGE_LEVEL_OPTIONS,
  type LanguageLevel,
} from "@/lib/gomate/education-options"
import { cn } from "@/lib/utils"

const COMMON_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Polish",
  "Czech",
  "Greek",
  "Russian",
  "Ukrainian",
  "Turkish",
  "Arabic",
  "Hebrew",
  "Hindi",
  "Bengali",
  "Urdu",
  "Persian",
  "Chinese (Mandarin)",
  "Chinese (Cantonese)",
  "Japanese",
  "Korean",
  "Thai",
  "Vietnamese",
  "Indonesian",
  "Malay",
  "Filipino",
  "Croatian",
  "Romanian",
  "Hungarian",
  "Bulgarian",
  "Slovak",
  "Slovenian",
  "Lithuanian",
  "Latvian",
  "Estonian",
  "Icelandic",
  "Irish",
  "Catalan",
  "Basque",
  "Afrikaans",
  "Swahili",
]

export interface SpokenLanguage {
  language: string
  level: LanguageLevel
}

interface LanguagesInputProps {
  value: SpokenLanguage[]
  onChange: (languages: SpokenLanguage[]) => void
}

export function LanguagesInput({ value, onChange }: LanguagesInputProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const usedLanguages = new Set(value.map((v) => v.language.toLowerCase()))
  const availableLanguages = COMMON_LANGUAGES.filter(
    (l) => !usedLanguages.has(l.toLowerCase()),
  )

  const updateLevel = (idx: number, level: LanguageLevel) => {
    const next = [...value]
    next[idx] = { ...next[idx], level }
    onChange(next)
  }

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const addLanguage = (language: string) => {
    onChange([...value, { language, level: "intermediate" }])
    setPickerOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {value.map((entry, idx) => (
          <div
            key={`${entry.language}-${idx}`}
            className="flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-card pl-3 pr-1.5 py-1.5"
          >
            <span className="flex-1 text-sm font-medium truncate">{entry.language}</span>
            <Select
              value={entry.level}
              onValueChange={(v) => updateLevel(idx, v as LanguageLevel)}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_LEVEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeAt(idx)}
              aria-label={`Remove ${entry.language}`}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={pickerOpen}
            className={cn(
              "w-full justify-between h-10 px-3 font-normal text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {value.length === 0 ? "Add a language" : "Add another language"}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search languages…" />
            <CommandList>
              <CommandEmpty>No language found.</CommandEmpty>
              <CommandGroup>
                {availableLanguages.map((lang) => (
                  <CommandItem
                    key={lang}
                    value={lang}
                    onSelect={() => addLanguage(lang)}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    {lang}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
