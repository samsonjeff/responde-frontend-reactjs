import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

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

function BulletList({ items }: { items: React.ReactNode[] }) {
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

const COLLECTION_ROWS: Array<[string, string]> = [
  [
    'Residents reporting through the Messenger Bot',
    'Facebook Page-Scoped ID (PSID) and public profile name; the content of your conversation with the bot; reported barangay, landmark, or location description; type of incident (e.g., Search and Rescue, Medical, Food and Water, Infrastructure); description of the situation; contact number if you choose to provide it; and the date and time of the report.',
  ],
  [
    'Public comments on the official MDRRMO Talisay Facebook Page',
    'Commenter\u2019s public display name, the text of the public comment, any location mentioned in it, and the date and time it was posted. Only publicly visible comments on the official MDRRMO Talisay Page are collected. We do not access private messages, personal profiles, private groups, or any other page.',
  ],
  [
    'Authorized MDRRMO personnel (Dashboard users)',
    'Full name, username, official email address, phone number (optional), profile photo when signing in with Google, assigned role, login timestamps, one-time password (OTP) verification records, and actions performed within the System (e.g., verifying, editing, rejecting, or resolving reports).',
  ],
  [
    'Visitors of the RESPONDE public website',
    'Basic technical information automatically sent by your browser, such as device type, browser version, and IP address, used only for security and service availability monitoring.',
  ],
];

const CONTACT_ROWS: Array<[string, React.ReactNode]> = [
  ['Office', 'Municipal Disaster Risk Reduction and Management Office (MDRRMO), Municipality of Talisay, Batangas'],
  ['Data Protection Officer', '[Insert name of designated DPO]'],
  ['Email', <a key="e" href="mailto:responde@talisay.gov.ph" className="text-[#0071E3] hover:underline">responde@talisay.gov.ph</a>],
  ['Address', '[Insert MDRRMO office address], Talisay, Batangas'],
  ['Facebook Page', 'Official MDRRMO Talisay Facebook Page'],
];

export default function PrivacyPolicy() {
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
            <ShieldCheck className="h-4 w-4" strokeWidth={2} />
            <span>Responde &middot; MDRRMO Talisay, Batangas</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Automated Disaster Intake and Geospatial Mapping System
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Effective Date: [Insert date of deployment] &nbsp;|&nbsp; Last Updated: [Insert date]
          </p>
        </div>

        <div className="mt-6">
          <Body>
            RESPONDE (&ldquo;the System,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is a disaster intake and
            geospatial mapping platform operated for the Municipal Disaster Risk Reduction and Management
            Office (MDRRMO) of Talisay, Batangas. The System receives disaster-related incident reports from
            residents through a Facebook Messenger Bot, collects publicly posted comments from the official
            MDRRMO Talisay Facebook Page, classifies these reports using Natural Language Processing (NLP),
            and displays verified incidents on a web-based Command Dashboard used by authorized MDRRMO personnel.
          </Body>
          <Body>
            We respect your right to privacy. This Privacy Policy explains what personal information we collect,
            why we collect it, how it is used and protected, and what rights you have over it, in accordance with
            Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, its Implementing Rules and
            Regulations, and the issuances of the National Privacy Commission (NPC).
          </Body>

          <SectionTitle>1. Who Is Responsible for Your Information</SectionTitle>
          <Body>
            The MDRRMO of the Municipality of Talisay, Batangas acts as the Personal Information Controller (PIC)
            of the data processed by RESPONDE. The System was developed by student researchers of Batangas State
            University &ndash; The National Engineering University, JPLPC&ndash;Malvar Campus, College of Informatics
            and Computing Sciences, who act as Personal Information Processors (PIP) only for the purposes of system
            development, testing, and maintenance under the agreement executed with the MDRRMO.
          </Body>

          <SectionTitle>2. Information We Collect</SectionTitle>
          <Body>The information collected depends on how you interact with RESPONDE:</Body>
          <div className="mb-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#1B365D] text-white">
                  <th className="w-1/3 px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Information Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {COLLECTION_ROWS.map(([source, info]) => (
                  <tr key={source} className="align-top">
                    <td className="px-4 py-3 font-semibold text-slate-900">{source}</td>
                    <td className="px-4 py-3 leading-relaxed text-slate-600">{info}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Body>
            <strong className="font-semibold text-slate-900">Note:</strong> RESPONDE does not intentionally collect
            sensitive personal information such as religious affiliation, political opinion, or government-issued
            identification numbers. Health-related information may be included only when a resident voluntarily
            describes a medical emergency, and such information is used solely to coordinate the appropriate response.
          </Body>

          <SectionTitle>3. How We Use Your Information</SectionTitle>
          <Body>Your information is used only for legitimate disaster risk reduction and emergency response purposes, namely:</Body>
          <BulletList
            items={[
              'To receive, record, and acknowledge your incident report;',
              'To ask follow-up questions when a report is incomplete (e.g., missing barangay or location);',
              'To classify reports by incident type and urgency level using NLP;',
              'To allow MDRRMO officers to review, verify, and act on reports before dispatching response teams;',
              'To display verified incidents on the barangay-level geospatial map of Talisay;',
              'To produce statistical (descriptive and prescriptive) analytics on incident frequency and high-risk areas for disaster preparedness and resource planning;',
              'To authenticate MDRRMO personnel, protect accounts through Two-Factor Authentication, and keep audit records of actions taken in the System; and',
              'To monitor system uptime and maintain the security and reliability of the platform.',
            ]}
          />
          <Body>
            Analytics and reports generated by the System present aggregated data (e.g., number of incidents per
            barangay) and do not identify individual residents.
          </Body>

          <SectionTitle>4. Legal Basis for Processing</SectionTitle>
          <Body>Personal information is processed under the following lawful criteria provided in Sections 12 and 13 of the Data Privacy Act of 2012:</Body>
          <BulletList
            items={[
              <span key="a"><strong className="font-semibold text-slate-900">Consent</strong> &ndash; You voluntarily send a report to the MDRRMO through the Messenger Bot.</span>,
              <span key="b"><strong className="font-semibold text-slate-900">Vital interest</strong> &ndash; Processing is necessary to protect the life and health of the data subject or another person during an emergency.</span>,
              <span key="c"><strong className="font-semibold text-slate-900">Public function</strong> &ndash; Processing is necessary for the MDRRMO to perform its mandate under Republic Act No. 10121 (Philippine Disaster Risk Reduction and Management Act of 2010).</span>,
            ]}
          />

          <SectionTitle>5. Automated Processing</SectionTitle>
          <Body>
            RESPONDE uses an NLP model to automatically suggest the incident type, urgency level, and location of a
            report. These results are suggestions only. No rescue dispatch or official decision is made by the System
            alone; every report is reviewed by an authorized MDRRMO officer, who may correct the classification
            before the incident is marked as verified and shown on the map.
          </Body>

          <SectionTitle>6. Sharing and Disclosure</SectionTitle>
          <Body>We do not sell, rent, or trade your personal information. Information may be shared only with:</Body>
          <BulletList
            items={[
              'Authorized MDRRMO personnel, barangay officials, and emergency responders who need it to respond to an incident;',
              'Other government agencies involved in disaster response, when necessary to protect life and property;',
              'Service providers that host or operate parts of the System (such as Meta Platforms for the Messenger Platform, Supabase for cloud database hosting, Google for account sign-in, and uptime monitoring services), which process data only as needed to provide their services; and',
              'Authorities, when required by law, court order, or a lawful request from a government agency.',
            ]}
          />

          <SectionTitle>7. Data Storage and Security</SectionTitle>
          <Body>We implement reasonable organizational, physical, and technical measures to protect personal information against loss, misuse, and unauthorized access, including:</Body>
          <BulletList
            items={[
              'Encrypted connections (HTTPS) between users and the System;',
              'Two-Factor Authentication using a 6-digit one-time password sent to the official email of MDRRMO personnel;',
              'Secure, httpOnly session cookies for signed-in Dashboard users;',
              'Role-based access control, so that each user can only view or modify data allowed by their assigned role;',
              'Database access policies that restrict reading and changing incident records to authenticated personnel; and',
              'Activity logs that record changes made to incident reports.',
            ]}
          />
          <Body>
            While we take these steps, no system connected to the internet can be guaranteed to be completely secure.
            In the event of a personal data breach, the MDRRMO will notify the National Privacy Commission and
            affected individuals as required by NPC Circular No. 16-03.
          </Body>

          <SectionTitle>8. Data Retention</SectionTitle>
          <Body>
            Incident reports and conversation records are kept only for as long as necessary to respond to the incident
            and to support disaster planning and reporting. Personal details of residents are retained for [insert
            retention period agreed with the MDRRMO, e.g., three (3) years] after the incident is resolved, after which
            they are securely deleted or anonymized. Anonymized statistical data may be kept longer for historical
            analytics. Accounts of MDRRMO personnel are deactivated when they are no longer authorized to use the System.
          </Body>

          <SectionTitle>9. Cookies</SectionTitle>
          <Body>
            The RESPONDE Command Dashboard uses essential session cookies only to keep authorized personnel signed in
            securely. These cookies are required for the System to function and are not used for advertising or tracking.
          </Body>

          <SectionTitle>10. Your Rights as a Data Subject</SectionTitle>
          <Body>Under the Data Privacy Act of 2012, you have the right to:</Body>
          <BulletList
            items={[
              'Be informed of whether and how your personal information is being processed;',
              'Access the personal information we hold about you;',
              'Object to the processing of your personal information, subject to legal and emergency-response limits;',
              'Correct any inaccurate or incomplete information;',
              'Erasure or blocking of information that is no longer necessary or was unlawfully obtained;',
              'Data portability to obtain a copy of your information in an electronic format;',
              'Damages for any harm caused by inaccurate, unlawfully obtained, or unauthorized use of your information; and',
              'File a complaint with the National Privacy Commission (www.privacy.gov.ph).',
            ]}
          />
          <Body>
            Please note that some requests may be limited when the information is still needed to respond to an ongoing
            emergency or is required to be kept by law.
          </Body>

          <SectionTitle>11. Children&rsquo;s Privacy</SectionTitle>
          <Body>
            RESPONDE is intended for use by the general public during emergencies. If a report is submitted by a minor,
            the information is used only to provide assistance. Parents or guardians may contact us to request correction
            or deletion of a minor&rsquo;s information.
          </Body>

          <SectionTitle>12. Changes to This Privacy Policy</SectionTitle>
          <Body>
            We may update this Privacy Policy when the System or applicable laws change. The updated version will be
            posted on this page with a new &ldquo;Last Updated&rdquo; date.
          </Body>

          <SectionTitle>13. Contact Us</SectionTitle>
          <Body>
            For questions, requests, or concerns about this Privacy Policy or your personal information, please contact:
          </Body>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#1B365D] text-white">
                  <th className="w-1/3 px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {CONTACT_ROWS.map(([label, detail]) => (
                  <tr key={label} className="align-top">
                    <td className="px-4 py-3 font-semibold text-slate-900">{label}</td>
                    <td className="px-4 py-3 leading-relaxed text-slate-600">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
