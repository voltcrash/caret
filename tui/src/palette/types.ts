type CommandInput = {
  placeholder?: string;
  defaultValue?: () => string;
  /** Returns an error to keep the palette open on the input. */
  submit: (value: string) => string | undefined | Promise<string | undefined>;
};

export type Command = {
  id: string;
  display: string;
  alias?: string;
  /** Built when opened, so lists follow account and config changes. */
  subgroup?: () => CommandGroup;
  input?: CommandInput;
  exec?: () => void | Promise<void>;
  active?: () => boolean;
  available?: () => boolean;
  /** Keeps the palette open after running. */
  sticky?: boolean;
  /** Dim hint after the display, e.g. "web only". */
  note?: string;
};

export type CommandGroup = { title: string; list: Command[] };
