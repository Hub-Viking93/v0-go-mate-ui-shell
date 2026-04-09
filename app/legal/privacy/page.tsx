import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — GoMate",
}

export default function PrivacyPage() {
  return (
    <article className="prose prose-sm prose-slate dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: April 2026</p>

      <p>
        This Privacy Policy explains how GoMate (&quot;the Service&quot;) collects,
        uses, and protects your personal data.
      </p>
      <p>
        The Service is operated by GoMate Technologies (&quot;we&quot;, &quot;us&quot;,
        &quot;the Company&quot;), acting as the <strong>data controller</strong> under
        applicable data protection laws, including the EU General Data Protection
        Regulation (GDPR).
      </p>

      <h2>What We Collect</h2>

      <h3>Account data</h3>
      <ul>
        <li>Email address (for authentication)</li>
        <li>Name (if provided)</li>
      </ul>

      <h3>Profile data (provided during chat interview)</h3>
      <ul>
        <li>Citizenship, destination, current location</li>
        <li>Purpose of relocation (work, study, etc.)</li>
        <li>Family situation (spouse, children)</li>
        <li>Financial information (budget, savings)</li>
        <li>Work experience, education, language skills</li>
        <li>Visa history</li>
      </ul>

      <h3>Sensitive data</h3>
      <p>
        In some cases, you may voluntarily provide sensitive personal data, such as
        health-related information (GDPR Article 9). We only process such data:
      </p>
      <ul>
        <li>When you explicitly provide it during the chat interview</li>
        <li>For the sole purpose of generating personalized relocation guidance</li>
        <li>Based on your explicit consent</li>
      </ul>
      <p>
        You are <strong>not required</strong> to provide sensitive data to use the
        Service. If you prefer not to share health-related information, GoMate will
        still function fully.
      </p>

      <h3>Usage data</h3>
      <ul>
        <li>Pages visited, features used</li>
        <li>Plan status and progress</li>
      </ul>

      <h3>Generated data</h3>
      <ul>
        <li>AI-generated guides, checklists, and task lists</li>
        <li>Research results</li>
      </ul>

      <h2>Data Minimization</h2>
      <p>
        We only collect data necessary to provide the Service. We do not request
        unnecessary personal information, and you can skip optional profile fields
        at any time.
      </p>

      <h2>Legal Basis (GDPR)</h2>
      <p>We process personal data based on:</p>
      <ul>
        <li>
          <strong>Consent:</strong> when you voluntarily provide profile information
          during the chat interview
        </li>
        <li>
          <strong>Contract:</strong> to deliver the Service you have purchased
          (Pro Single or Pro+ subscription)
        </li>
        <li>
          <strong>Legitimate interest:</strong> to improve functionality, security,
          and performance of the Service
        </li>
      </ul>
      <p>
        Sensitive personal data (such as health information) is processed{" "}
        <strong>only with your explicit consent</strong>.
      </p>

      <h2>AI Processing</h2>
      <p>
        Your profile data is processed by third-party AI providers to generate
        personalized responses and recommendations. Specifically:
      </p>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Accessed via</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>OpenAI</td>
            <td>Chat interview, profile extraction</td>
            <td>OpenRouter</td>
          </tr>
          <tr>
            <td>Anthropic</td>
            <td>Guide generation, task enrichment</td>
            <td>OpenRouter</td>
          </tr>
        </tbody>
      </table>
      <p>Important:</p>
      <ul>
        <li>
          <strong>We do not use your data to train AI models.</strong> Data sent to
          AI providers is used solely to generate responses for you.
        </li>
        <li>
          AI-generated content may contain inaccuracies. Always verify with official
          sources before acting on any recommendation.
        </li>
      </ul>

      <h2>Other Third-Party Services</h2>
      <p>Your data is also processed by:</p>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Purpose</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Database, authentication</td>
            <td>EU/US</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Hosting, serverless functions</td>
            <td>US</td>
          </tr>
          <tr>
            <td>Firecrawl</td>
            <td>Web research (public sources only)</td>
            <td>US</td>
          </tr>
          <tr>
            <td>Stripe</td>
            <td>Payment processing</td>
            <td>US</td>
          </tr>
        </tbody>
      </table>
      <p>
        These providers process data under their own privacy policies and data
        processing agreements. Data transfers to the US are covered by the EU-US
        Data Privacy Framework or Standard Contractual Clauses.
      </p>

      <p>We do <strong>not</strong>:</p>
      <ul>
        <li>Sell your data to third parties</li>
        <li>Use your data for advertising</li>
        <li>Share your data with anyone not listed above</li>
        <li>Use your data to train AI models</li>
      </ul>

      <h2>How Long We Keep It</h2>
      <ul>
        <li>Account and profile data: as long as your account is active</li>
        <li>Generated content: as long as your account is active</li>
        <li>After account deletion: data is deleted within 30 days</li>
      </ul>
      <p>You can request deletion at any time by contacting us.</p>

      <h2>Your Rights (GDPR)</h2>
      <p>If you are in the EU/EEA, you have the right to:</p>
      <ul>
        <li>Access your data (request a copy)</li>
        <li>Correct inaccurate data</li>
        <li>Delete your data (&quot;right to be forgotten&quot;)</li>
        <li>Export your data (portability)</li>
        <li>Restrict or object to processing</li>
        <li>Withdraw consent at any time (without affecting the lawfulness of prior processing)</li>
        <li>Lodge a complaint with a supervisory authority</li>
      </ul>
      <p>
        To exercise any of these rights, contact: contact@gomaterelocate.com
      </p>

      <h2>Cookies</h2>
      <p>
        GoMate uses essential cookies for authentication and session management.
        We do not use tracking cookies or third-party analytics cookies.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. We will notify registered users of material
        changes via email.
      </p>

      <h2>Data Controller</h2>
      <p>
        GoMate Technologies is the data controller responsible for your personal data.
      </p>
      <p className="text-muted-foreground">
        Contact: contact@gomaterelocate.com
      </p>
    </article>
  )
}
