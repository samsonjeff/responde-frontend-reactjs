import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, TriangleAlert } from 'lucide-react';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold tracking-tight text-slate-900 mt-10 mb-3">
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed text-slate-600 mb-3">
      {children}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mb-3 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-600">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0071E3]" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10 sm:px-8 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0071E3] hover:text-[#0060c9] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to Home
        </Link>

        <div className="mt-8 border-b border-slate-200 pb-8">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#0071E3]">
            <FileText className="h-4 w-4" strokeWidth={2} />
            <span>Responde &middot; MDRRMO Talisay, Batangas</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Terms of Use
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Effective Date: [Insert date of deployment]
          </p>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3.5">
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} />
          <p className="text-sm leading-relaxed text-amber-800">
            <strong className="font-semibold">Draft for legal review.</strong> These terms are a working draft
            prepared from the RESPONDE system description and must be reviewed and approved by the MDRRMO
            before publication.
          </p>
        </div>

        <div className="mt-6">
          <SectionTitle>1. Acceptance of These Terms</SectionTitle>
          <Body>
            By submitting an incident report through the RESPONDE Messenger Bot, commenting on the official
            MDRRMO Talisay Facebook Page for emergency purposes, or using the RESPONDE Command Dashboard, you
            agree to these Terms of Use and to the processing of your information as described in our{' '}
            <Link to="/privacy" className="font-semibold text-[#0071E3] hover:underline">
              Privacy Policy
            </Link>
            .
          </Body>

          <SectionTitle>2. Purpose and Eligibility</SectionTitle>
          <Body>
            RESPONDE exists solely to receive disaster-related incident reports from residents and to help the
            Municipal Disaster Risk Reduction and Management Office (MDRRMO) of Talisay, Batangas coordinate
            emergency response. Reports must describe genuine incidents or requests for assistance. Knowingly
            submitting false reports, prank messages, or spam may be referred to the proper authorities.
          </Body>

          <SectionTitle>3. Proper Use</SectionTitle>
          <BulletList
            items={[
              'Provide accurate information, especially the barangay, landmark, and contact details when asked;',
              'Do not use the Messenger Bot to send abusive, threatening, or obscene content;',
              'Do not attempt to access accounts, dashboards, or data you are not authorized to use; and',
              'Do not interfere with the operation of the System, including automated scraping or flooding the bot with messages.',
            ]}
          />

          <SectionTitle>4. Your Data</SectionTitle>
          <Body>
            Incident reports, conversation records, and account information are handled as described in our{' '}
            <Link to="/privacy" className="font-semibold text-[#0071E3] hover:underline">
              Privacy Policy
            </Link>
            , in accordance with Republic Act No. 10173 (Data Privacy Act of 2012). Analytics shown on the
            platform are aggregated and do not identify individuals.
          </Body>

          <SectionTitle>5. Authorized Dashboard Accounts</SectionTitle>
          <Body>
            Access to the Command Dashboard is limited to authorized MDRRMO personnel. Account holders must keep
            their usernames, passwords, and one-time passwords confidential, must not share accounts, and must
            promptly report suspected unauthorized access. Accounts are deactivated when the holder is no longer
            authorized.
          </Body>

          <SectionTitle>6. Availability and Emergencies</SectionTitle>
          <Body>
            RESPONDE is provided on a best-effort basis to support disaster response. It does not replace direct
            emergency hotlines. In life-threatening situations, always call 911 or the MDRRMO hotline at
            (043) 773-0248. Every report is reviewed by an authorized officer; automated classifications are
            suggestions only and no dispatch is made by the System alone.
          </Body>

          <SectionTitle>7. Changes to These Terms</SectionTitle>
          <Body>
            We may update these Terms when the System or applicable policies change. The updated version will be
            posted on this page with a new effective date. Continued use of the System after an update takes effect
            constitutes acceptance of the revised Terms.
          </Body>

          <SectionTitle>8. Contact</SectionTitle>
          <Body>
            For questions about these Terms, contact the MDRRMO at{' '}
            <a href="mailto:responde@talisay.gov.ph" className="font-semibold text-[#0071E3] hover:underline">
              responde@talisay.gov.ph
            </a>
            .
          </Body>
        </div>
      </div>
    </div>
  );
}
