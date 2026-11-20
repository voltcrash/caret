import { createBinding } from "../../app/binding";

/**
 * Typing actions that shared commands trigger. The typing feature binds them
 * while the palette is mounted; unbound, they do nothing.
 */
type CommandlineTypingHost = {
  restart: () => void;
  isRouteActive: () => boolean;
  blur: () => void;
  reloadPaceCaret: () => Promise<void>;
};

const host = createBinding<CommandlineTypingHost>();

export const bindCommandlineTypingHost = host.bind;

export function restartTest(): void {
  host.get()?.restart();
}

export function isTypingRouteActive(): boolean {
  return host.get()?.isRouteActive() ?? false;
}

export function blurTest(): void {
  host.get()?.blur();
}

export async function reloadPaceCaret(): Promise<void> {
  await host.get()?.reloadPaceCaret();
}
