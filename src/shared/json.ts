// The model is asked for bare JSON, but a stray code fence or sentence must not
// break parsing: keep everything from the first "{" (and up to the last "}"
// once the answer is complete).

export function jsonBody(text: string, complete: boolean): string {
  const start = text.indexOf('{');
  if (start === -1) return '';
  if (!complete) return text.slice(start);
  const end = text.lastIndexOf('}');
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}
