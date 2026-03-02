// Source linker - detects topics from user messages and returns relevant official sources

import { getOfficialSources, type CountryOfficialSources } from "./official-sources"

// Topic detection patterns
const topicPatterns: Record<keyof CountryOfficialSources, RegExp[]> = {
  immigration: [
    /immigra/i,
    /residence\s*permit/i,
    /settle/i,
    /permanent\s*residen/i,
    /citizenship/i,
    /naturali/i,
  ],
  visaPortal: [
    /visa/i,
    /entry\s*permit/i,
    /travel\s*document/i,
    /work\s*permit/i,
    /student\s*visa/i,
    /tourist\s*visa/i,
    /schengen/i,
  ],
  housing: [
    /hous/i,
    /apartment/i,
    /flat/i,
    /rent/i,
    /accomm/i,
    /property/i,
    /real\s*estate/i,
    /where\s*to\s*live/i,
  ],
  banking: [
    /bank/i,
    /financ/i,
    /money/i,
    /account/i,
    /transfer/i,
    /currency/i,
  ],
  employment: [
    /job/i,
    /work/i,
    /employ/i,
    /career/i,
    /salary/i,
    /hire/i,
    /recruit/i,
    /profession/i,
  ],
  healthcare: [
    /health/i,
    /medical/i,
    /insurance/i,
    /doctor/i,
    /hospital/i,
    /clinic/i,
    /nhs/i,
  ],
  education: [
    /education/i,
    /university/i,
    /college/i,
    /school/i,
    /study/i,
    /degree/i,
    /masters/i,
    /phd/i,
    /course/i,
  ],
  tax: [
    /tax/i,
    /income/i,
    /fiscal/i,
    /deduct/i,
    /vat/i,
  ],
  safety: [
    /safe/i,
    /crime/i,
    /security/i,
    /emergency/i,
    /danger/i,
  ],
  embassyFinder: [
    /embassy/i,
    /consulate/i,
    /diplomatic/i,
  ],
}

// Detect topics from a message
export function detectTopics(message: string): (keyof CountryOfficialSources)[] {
  const detectedTopics: (keyof CountryOfficialSources)[] = []
  
  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        detectedTopics.push(topic as keyof CountryOfficialSources)
        break
      }
    }
  }
  
  return detectedTopics
}

// Get relevant sources based on message content and destination
export function getRelevantSources(
  message: string,
  destination: string | null
): { topic: string; url: string; name: string }[] {
  if (!destination) return []
  
  const sources = getOfficialSources(destination)
  if (!sources) return []
  
  const topics = detectTopics(message)
  if (topics.length === 0) return []
  
  const nameMap: Record<keyof CountryOfficialSources, string> = {
    immigration: "Immigration Authority",
    visaPortal: "Visa Portal",
    housing: "Housing Portal",
    banking: "Banking Authority",
    employment: "Employment Services",
    healthcare: "Healthcare System",
    education: "Education Portal",
    tax: "Tax Authority",
    safety: "Safety Information",
    embassyFinder: "Embassy Finder",
  }
  
  return topics
    .filter((topic) => sources[topic])
    .map((topic) => ({
      topic,
      url: sources[topic] as string,
      name: nameMap[topic],
    }))
}

// Format sources for display in chat
export function formatSourcesForChat(
  sources: { topic: string; url: string; name: string }[]
): string {
  if (sources.length === 0) return ""
  
  const links = sources
    .map((s) => `- [${s.name}](${s.url})`)
    .join("\n")
  
  return `\n\n**Official Sources:**\n${links}`
}
