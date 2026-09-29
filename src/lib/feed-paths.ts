// Public feed route paths. Kept in a dependency-free module so client
// components can import them without pulling the digest workflow (and its
// filesystem access) into the client bundle.
export const rssFeedPath = "/feed.xml";
export const jsonFeedPath = "/feed.json";

export function topicFeedPath(tagId: string): string {
  return `/topics/${tagId}/feed.xml`;
}

export const weeklyReviewFeedPath = "/digest/weekly/feed.xml";

/** Every published technology signal, newest first. */
export const signalFeedPath = "/technologies/feed.xml";
