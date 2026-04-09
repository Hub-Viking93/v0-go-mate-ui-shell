import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — GoMate",
}

export default function TermsPage() {
  return (
    <article className="prose prose-sm prose-slate dark:prose-invert max-w-none">
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: April 2026</p>

      <p>
        These terms govern your use of GoMate (&quot;the Service&quot;), operated by
        GoMate Technologies (&quot;we&quot;, &quot;us&quot;, &quot;the Company&quot;).
      </p>
      <p>By using GoMate, you agree to these terms.</p>

      <h2>1. What GoMate Is</h2>
      <p>
        GoMate is an informational guidance tool that helps users explore and organize
        publicly available information about international relocation.
      </p>
      <p>
        GoMate is <strong>not</strong> a legal service, immigration consultancy, financial
        advisor, or government authority. We do not provide legal advice.
      </p>
      <p>
        Use of GoMate does not create any client, advisor, or fiduciary relationship
        between you and GoMate Technologies. The Service is provided on an
        informational basis only.
      </p>

      <h2>2. Your Responsibility</h2>
      <p>You are responsible for:</p>
      <ul>
        <li>Verifying all information with official sources before acting on it</li>
        <li>Making your own decisions about your relocation</li>
        <li>Consulting qualified professionals when needed</li>
        <li>Ensuring the information you provide to GoMate is accurate</li>
        <li>Complying with all laws applicable to your situation in your origin and destination countries</li>
      </ul>
      <p>
        We provide information to help you navigate the process. The final decisions
        and actions are yours.
      </p>

      <h2>3. No Guarantees</h2>
      <p>
        We do our best to provide accurate, up-to-date information. However:
      </p>
      <ul>
        <li>Information may be incomplete, outdated, or incorrect</li>
        <li>AI-generated content can contain errors</li>
        <li>Legal requirements change frequently</li>
        <li>Your specific situation may differ from general guidance</li>
      </ul>
      <p>
        We do not guarantee the accuracy, completeness, or applicability of any
        information provided through GoMate.
      </p>

      <h2>4. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law:</p>
      <p>
        GoMate Technologies, its operators, and its affiliates shall not be liable for
        any direct, indirect, incidental, or consequential damages arising from your
        use of the Service. This includes, but is not limited to:
      </p>
      <ul>
        <li>Missed deadlines or requirements</li>
        <li>Fines, penalties, or legal consequences</li>
        <li>Visa denials or immigration issues</li>
        <li>Financial losses</li>
        <li>Any actions taken based on information from GoMate</li>
      </ul>
      <p>Your use of GoMate is at your own risk.</p>

      <h2>5. Data and Privacy</h2>
      <p>
        We collect personal data to provide the Service. See our{" "}
        <a href="/legal/privacy">Privacy Policy</a> for full details on what we
        collect, why, and how it is processed.
      </p>

      <h2>6. Payment and Refunds</h2>
      <p>Paid plans (Pro Single, Pro+) are billed as described at the time of purchase.</p>
      <ul>
        <li>Pro Single is a one-time payment of $29 for access to a single relocation plan with full pre-move intelligence</li>
        <li>Pro+ is a recurring subscription ($29/month, or discounted for 3-month, 6-month, or annual plans) with unlimited plans and full post-arrival features</li>
        <li>
          Refund requests are handled on a case-by-case basis within 14 days of
          purchase if the Service has not been substantially used
        </li>
      </ul>
      <p>
        You can cancel Pro+ at any time. Cancellation takes effect at the end of the
        current billing period.
      </p>

      <h2>7. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use GoMate to provide immigration services to others</li>
        <li>Resell or redistribute GoMate&apos;s output commercially</li>
        <li>Attempt to extract or scrape data from GoMate systematically</li>
        <li>Use GoMate for any unlawful purpose</li>
      </ul>

      <h2>8. Jurisdiction</h2>
      <p>
        The Service is intended for informational use across multiple jurisdictions.
        Users are responsible for complying with local laws applicable to their
        situation. GoMate does not represent that the Service is appropriate or
        available for use in any particular jurisdiction.
      </p>

      <h2>9. Changes to Terms</h2>
      <p>
        We may update these terms. Continued use after changes constitutes acceptance.
        We will notify registered users of material changes.
      </p>

      <h2>10. Governing Law</h2>
      <p>These terms are governed by the laws of Sweden.</p>

      <p className="text-muted-foreground">
        For questions: contact@gomaterelocate.com
      </p>
    </article>
  )
}
