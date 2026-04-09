import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Disclaimer — GoMate",
}

export default function DisclaimerPage() {
  return (
    <article className="prose prose-sm prose-slate dark:prose-invert max-w-none">
      <h1>Disclaimer</h1>
      <p className="text-muted-foreground">Last updated: April 2026</p>

      <p>
        GoMate is an informational guidance platform operated by GoMate Technologies.
      </p>

      <h2>What GoMate Provides</h2>
      <p>
        GoMate is designed to help you understand, organize, and navigate the
        international relocation process by combining structured data, publicly
        available information, and AI-assisted analysis into a single system.
      </p>
      <p>
        GoMate is a decision-support tool. It is <strong>not</strong> a legal service,
        immigration consultancy, tax advisor, or financial advisor.
      </p>

      <h2>No Professional Relationship</h2>
      <p>
        Use of GoMate does not create any client, advisor, legal, or fiduciary
        relationship between you and GoMate Technologies. The Service is provided
        on an informational basis only.
      </p>

      <h2>Information Accuracy</h2>
      <p>
        While we strive to provide accurate and up-to-date information, the content
        may not always reflect the latest legal or administrative changes and may not
        fully apply to your specific situation.
      </p>
      <p>
        All information presented in GoMate — including visa recommendations, deadline
        estimates, cost of living data, document checklists, and settling-in tasks — is
        based on publicly available sources, third-party data providers, and AI analysis.
        You are responsible for verifying critical information with official authorities
        before acting on it.
      </p>

      <h2>AI-Generated Content</h2>
      <p>
        GoMate uses AI systems (including models provided by OpenAI and Anthropic) to
        analyze and synthesize information. While these systems are designed to provide
        useful and structured outputs, they can produce inaccuracies. Always verify
        critical information with official sources before taking action.
      </p>

      <h2>No Guarantee of Outcomes</h2>
      <p>
        GoMate does not guarantee any specific relocation outcome, including visa
        approval, compliance status, tax registration success, or successful completion
        of administrative processes. Deadlines, requirements, and legal obligations
        vary by country, nationality, visa type, and individual circumstances.
      </p>

      <h2>Limitation of Reliance</h2>
      <p>
        You agree that any decisions or actions taken based on information provided
        by GoMate are made at your own discretion and risk.
      </p>
      <p>
        GoMate Technologies shall not be held liable for any outcomes resulting from
        reliance on the Service, including but not limited to:
      </p>
      <ul>
        <li>Missed deadlines or requirements</li>
        <li>Fines, penalties, or legal consequences</li>
        <li>Visa denials or immigration issues</li>
        <li>Financial losses</li>
        <li>Any actions taken based on GoMate&apos;s output</li>
      </ul>

      <h2>Multi-Jurisdiction Notice</h2>
      <p>
        The Service is intended for informational use across multiple jurisdictions.
        Users are responsible for complying with all local laws applicable to their
        situation in both their origin and destination countries. GoMate does not
        represent that its content is appropriate, accurate, or legally valid in any
        particular jurisdiction.
      </p>

      <h2>By Using GoMate, You Acknowledge That</h2>
      <ol>
        <li>GoMate is a decision-support tool, not a professional advisory service</li>
        <li>No professional relationship is created by your use of the Service</li>
        <li>You are responsible for verifying all information with official sources</li>
        <li>GoMate does not guarantee any specific relocation outcome</li>
        <li>All decisions and actions based on GoMate&apos;s output are at your own risk</li>
      </ol>

      <h2>Professional Advice</h2>
      <p>
        For legal advice about your specific situation, consult a qualified
        immigration lawyer or advisor in your destination country.
      </p>

      <p className="text-muted-foreground">
        For questions about this disclaimer: contact@gomaterelocate.com
      </p>
    </article>
  )
}
