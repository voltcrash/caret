import { vi } from "vite-plus/test";

import { bindTypingHost } from "../../src/ts/typing-host";

type TypingHost = Parameters<typeof bindTypingHost>[0];

/** Binds a typing route host of spies; returns the release. */
export function bindTestTypingHost(
  overrides: Partial<TypingHost> = {},
): () => void {
  return bindTypingHost({
    isRouteActive: () => true,
    restart: vi.fn(),
    blur: vi.fn(),
    reloadPaceCaret: vi.fn(async () => undefined),
    updateHints: vi.fn(),
    isNoQuitActive: () => false,
    ...overrides,
  });
}
