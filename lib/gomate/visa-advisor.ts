// Legal disclaimer for visa advice

export const VISA_DISCLAIMER = `**Disclaimer:** This information is for general guidance only and does not constitute legal advice. Immigration laws and requirements change frequently. Always verify information with official government sources and consider consulting a licensed immigration advisor for your specific situation.`

export const VISA_DISCLAIMER_SHORT = `*Always verify with official sources. This is not legal advice.*`

// Format disclaimer for chat
export function getVisaDisclaimer(short = false): string {
  return short ? VISA_DISCLAIMER_SHORT : VISA_DISCLAIMER
}
