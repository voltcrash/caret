import { StandaloneHeader } from "./StandaloneHeader";

export function PrivacyPolicy() {
  return (
    <>
      <StandaloneHeader label="Privacy Policy" />
      <main class="grid min-w-0 gap-6 wrap-break-word">
        <h1 class="text-3xl text-main">Privacy Policy</h1>
        <p>
          Caret is an independent, open-source typing test operated by the
          maintainer of voltcrash/caret. This policy describes Caret’s own
          website and optional accounts. Updated November 1, 2026.
        </p>
        <h2 class="text-xl text-main">What we store</h2>
        <p>
          Guest preferences, custom text, uploaded fonts/backgrounds and
          practice history stay in your browser. A limited presentation cookie
          stores ordinary generated words and appearance settings for the
          initial page; custom text is excluded. Pending signed-in results are
          stored locally until submission succeeds or you discard them.
        </p>
        <p>
          If you sign in with Google or GitHub, we store your provider identity,
          email, chosen username, sessions, preferences and typing results in
          PostgreSQL hosted by Neon. Cloudflare hosts the website and processes
          requests, IP addresses and security information. Public profiles and
          leaderboards expose the information you choose to make public; email
          addresses and session tokens are not public.
        </p>
        <h2 class="text-xl text-main">Typing evidence and diagnostics</h2>
        <p>
          Result submissions can include compressed typing event logs, including
          target and entered text, to validate scores. Avoid entering
          confidential content into account-backed tests. Raw timing samples for
          anticheat calibration are off by default. Ordinary database audits
          expire after 30 days; important security and moderation audits expire
          after 90 days. Results remain until you reset or delete your account.
        </p>
        <p>
          Optional Sentry error/performance reporting and host-provided Google
          Analytics run only with your consent. You can withdraw consent in
          Settings → privacy → update cookie preferences. Error reports may
          include your account ID and username when signed in. Sentry session
          replay is not enabled. Essential authentication and security storage
          remains necessary for signed-in use.
        </p>
        <h2 class="text-xl text-main">Your controls</h2>
        <p>
          You can export results, edit your profile, opt out of leaderboards,
          revoke sessions, reset account data or delete the account in Settings.
          Deletion removes application and authentication records and their
          dependent results. A minimal deletion audit is retained under the
          security-audit schedule. Banned identities may retain hashed abuse
          blocklist entries. Browser data can be removed through your browser’s
          site-data controls. Infrastructure providers may retain operational
          logs or backups under their own retention policies.
        </p>
        <p>
          For questions or data requests, contact the maintainer through the
          repository. Do not post personal data publicly; use the repository’s
          private security-reporting channel for sensitive concerns.
        </p>
        <p>
          <a
            class="text-main underline"
            href="https://github.com/voltcrash/caret/discussions"
          >
            Visit project discussions
          </a>
        </p>
        <a class="text-sub underline" href="/">
          Back to Caret
        </a>
      </main>
    </>
  );
}
