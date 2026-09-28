/**
 * The option a select should hold when the list it picks from can shrink.
 *
 * The digest editor's 手动添加 select lists the technologies not yet in the
 * digest, so adding one removes it from the list on the next refresh — while
 * the component still holds its id. The browser then shows the first option,
 * and until 2026-09-28 a second click re-sent the id already added (reporting
 * success) instead of the technology on screen.
 *
 * Keeps `heldId` while it is still listed, and otherwise falls back to the
 * first option, which is what the browser displays; `""` when the list is
 * empty.
 */
export function keepListedOption(
  options: readonly { id: string }[],
  heldId: string
): string {
  return options.some((option) => option.id === heldId)
    ? heldId
    : (options[0]?.id ?? "");
}
