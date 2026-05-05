import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1940
const MAX_YEAR = CURRENT_YEAR - 15  // youngest reasonable applicant: 15

const YEARS: number[] = []
for (let y = MAX_YEAR; y >= MIN_YEAR; y--) YEARS.push(y)

interface YearOfBirthSelectProps {
  value: string | null
  onChange: (year: string) => void
  id?: string
}

export function YearOfBirthSelect({ value, onChange, id }: YearOfBirthSelectProps) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-10 w-32">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {YEARS.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
