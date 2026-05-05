import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EDUCATION_OPTIONS } from "@/lib/gomate/education-options"

interface EducationSelectProps {
  value: string | null
  onChange: (value: string) => void
  id?: string
}

export function EducationSelect({ value, onChange, id }: EducationSelectProps) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-10">
        <SelectValue placeholder="Select your highest level of education" />
      </SelectTrigger>
      <SelectContent>
        {EDUCATION_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
