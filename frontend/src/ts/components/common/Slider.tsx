import { createEffect, createSignal, JSXElement } from "solid-js";

type Props = {
  id?: string;
  label: string;
  ref?: (el: HTMLInputElement) => void;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  onEveryChange?: (value: number) => void;
  text?: (value: number) => string | JSXElement;
};

export function Slider(props: Props): JSXElement {
  const [value, setValue] = createSignal(0);
  createEffect(() => setValue(props.value));

  const textToDisplay = () => {
    if (props.text) {
      return props.text(value());
    }
    return value();
  };

  return (
    <div class="grid w-full min-w-0 grid-cols-[3ch_minmax(0,1fr)] items-center gap-4">
      <div>{textToDisplay()}</div>
      <input
        id={props.id}
        aria-label={props.label}
        ref={props.ref}
        type="range"
        // horizontal drags go to the slider on touch; vertical swipes still scroll the page
        class="touch-pan-y"
        min={props.min}
        max={props.max}
        value={value()}
        step={props.step}
        onInput={(e) => {
          const newValue = Number(e.target.value);
          setValue(newValue);
          props.onEveryChange?.(newValue);
        }}
        onChange={(e) => props.onChange?.(Number(e.target.value))}
      />
    </div>
  );
}
