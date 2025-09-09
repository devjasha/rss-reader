import { fetchAndParseRss, RssFeed } from "./RssParser";

export { RssFeed, RssItem } from "./RssParser";

/**
 * Fetch and parse RSS data for use with TanStack Query
 * @param url - RSS feed URL
 * @returns Promise with parsed RSS feed data
 */
export const fetchRssData = async (url: string): Promise<RssFeed> => {
  try {
    const feed = await fetchAndParseRss(url);
    return feed;
  } catch (error) {
    console.error("TanStack Query RSS error:", error);
    throw error;
  }
};
