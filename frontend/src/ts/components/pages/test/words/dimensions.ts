export function outerWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return (
    element.getBoundingClientRect().width +
    parseFloat(style.marginLeft) +
    parseFloat(style.marginRight)
  );
}

export function outerHeight(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return (
    element.getBoundingClientRect().height +
    parseFloat(style.marginTop) +
    parseFloat(style.marginBottom)
  );
}

export function scrollToCenterOrTop(el: HTMLElement | null): void {
  if (!el) return;

  const elementHeight = el.offsetHeight;
  const windowHeight = window.innerHeight;

  el.scrollIntoView({
    block: elementHeight < windowHeight ? "center" : "start",
  });
}
