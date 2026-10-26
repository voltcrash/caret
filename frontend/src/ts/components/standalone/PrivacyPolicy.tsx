import { StandaloneHeader } from "./StandaloneHeader";

export function PrivacyPolicy() {
  return (
    <>
      <StandaloneHeader label="Privacy Policy" />
      <main class="grid min-w-0 gap-6 wrap-break-word">
        <h1 class="text-3xl text-main">Privacy Policy</h1>
        <p>
          Caret is preparing a privacy policy for its own hosting and
          services. The policy inherited from Monkeytype does not describe this
          independent project. A complete Caret policy must be published
          before public accounts are offered.
        </p>
        <p>
          For questions about project data practices, use the repository
          discussions.
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
