// `/network?focus=<node id>` — the deep link into the whole-network view.
//
// The parameter only ever selects a node the page is already rendering: an
// unknown id, a draft, or anything malformed resolves to "no focus", exactly
// as if the parameter were absent. Nothing here reads or writes storage; the
// same URL shows every reader the same thing.

export const NETWORK_PATH = "/network";
export const NETWORK_FOCUS_PARAM = "focus";

// Real ids run to about 110 characters (workspace-published signals carry the
// imported candidate's URL in theirs). Anything far past that is not an id.
const MAX_FOCUS_LENGTH = 300;

type SearchParamValue = string | string[] | undefined;

/** The raw `focus` value, trimmed, or `undefined` when it cannot be an id. */
export function parseNetworkFocusParam(
  value: SearchParamValue
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();

  if (!trimmed || trimmed.length > MAX_FOCUS_LENGTH) {
    return undefined;
  }

  return trimmed;
}

/**
 * The id of the node to open with, or `null`. Only ids present in `nodes` —
 * the published graph the page renders — are accepted.
 */
export function resolveNetworkFocus(
  value: SearchParamValue,
  nodes: ReadonlyArray<{ id: string }>
): string | null {
  const id = parseNetworkFocusParam(value);

  if (!id) {
    return null;
  }

  return nodes.some((node) => node.id === id) ? id : null;
}

/** Link target for "show this item in the network". */
export function buildNetworkFocusHref(id: string): string {
  return `${NETWORK_PATH}?${new URLSearchParams({
    [NETWORK_FOCUS_PARAM]: id
  }).toString()}`;
}

/**
 * The address-bar URL (path + query + hash) after the selection changes:
 * `focus` set to the selected id, or removed when nothing is selected. Every
 * other parameter and the hash are kept as they were.
 */
export function withNetworkFocus(
  currentHref: string,
  focusId: string | null
): string {
  const url = new URL(currentHref, "http://localhost");

  if (focusId) {
    url.searchParams.set(NETWORK_FOCUS_PARAM, focusId);
  } else {
    url.searchParams.delete(NETWORK_FOCUS_PARAM);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
