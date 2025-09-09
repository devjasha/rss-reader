export interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  guid?: string;
  featuredImage?: string;
  images?: string[];
  cleanContent?: string;
}

export interface RssFeed {
  title: string;
  description: string;
  link: string;
  items: RssItem[];
}

/**
 * Simple XML text extraction helper
 * Extracts content between XML tags using regex, handles CDATA sections
 */
function getTextBetweenTags(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "is");
  const match = xml.match(regex);
  if (!match) return "";

  let content = match[1].trim();

  // Handle CDATA sections (common in BBC and other feeds)
  const cdataRegex = /<!\[CDATA\[(.*?)\]\]>/is;
  const cdataMatch = content.match(cdataRegex);
  if (cdataMatch) {
    content = cdataMatch[1].trim();
  }

  return content;
}

/**
 * Extract all RSS items from XML
 * Finds all <item>...</item> blocks
 */
function getAllItems(xml: string): string[] {
  const items: string[] = [];
  const itemRegex = /<item[^>]*>(.*?)<\/item>/gis;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    items.push(match[1]);
  }

  return items;
}

/**
 * Extract image URLs from HTML content and media tags
 */
function extractImages(html: string): string[] {
  if (!html) return [];

  const images: string[] = [];

  // Extract from HTML img tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    // Filter out small icons, tracking pixels, and ads
    if (
      (src &&
        !src.includes("feedburner") &&
        !src.includes("pixel") &&
        !src.includes("1x1") &&
        !src.includes("tracking") &&
        !src.match(/\d+x\d+/)) ||
      (src.match(/(\d+)x(\d+)/) && parseInt(src.match(/(\d+)x(\d+)/)[1]) > 100)
    ) {
      images.push(src);
    }
  }

  return images;
}

/**
 * Extract media:thumbnail URL from RSS item XML
 */
function extractMediaThumbnail(itemXml: string): string | undefined {
  const mediaThumbnailRegex =
    /<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i;
  const match = itemXml.match(mediaThumbnailRegex);
  return match ? match[1] : undefined;
}

/**
 * Clean HTML tags and entities from text while preserving structure
 */
export function cleanHtmlContent(html: string): string {
  if (!html) return "";

  return (
    html
      // Remove script and style tags completely
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      // Remove comments
      .replace(/<!--.*?-->/gs, "")
      // Remove images (we'll handle them separately)
      .replace(/<img[^>]*>/gi, "")
      // Remove other media elements
      .replace(/<(video|audio|iframe|embed|object)[^>]*>.*?<\/\1>/gi, "")
      // Convert block elements to line breaks
      .replace(
        /<\/?(div|p|br|h[1-6]|article|section|header|footer|nav|main)[^>]*>/gi,
        "\n",
      )
      .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/li>/gi, "")
      // Convert formatting tags to text equivalents
      .replace(/<strong[^>]*>|<b[^>]*>/gi, "")
      .replace(/<\/strong>|<\/b>/gi, "")
      .replace(/<em[^>]*>|<i[^>]*>/gi, "")
      .replace(/<\/em>|<\/i>/gi, "")
      // Remove remaining HTML tags (more aggressive)
      .replace(/<[^>]*>/g, "")
      // Decode HTML entities (more comprehensive)
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/&apos;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&hellip;/g, "…")
      .replace(/&#\d+;/g, " ") // Numeric entities
      .replace(/&[a-zA-Z]+;/g, " ") // Other named entities
      // Clean up whitespace
      .replace(/\n\s*\n/g, "\n\n") // Multiple newlines to double
      .replace(/\n{3,}/g, "\n\n") // Max 2 newlines
      .replace(/[ \t]+/g, " ") // Multiple spaces to single
      .replace(/^\s*\n/g, "") // Remove leading newlines
      .trim()
  );
}

/**
 * Legacy function for compatibility - now uses cleanHtmlContent
 */
function stripHtml(html: string): string {
  return cleanHtmlContent(html);
}

/**
 * Parse RSS XML string into structured feed object
 * @param xmlText - Raw RSS XML string
 * @returns Parsed RSS feed with items
 */
export function parseRssXml(xmlText: string): RssFeed {
  try {
    // Extract feed-level information (takes first occurrence for channel info)
    const feedTitle = getTextBetweenTags(xmlText, "title") || "Unknown Feed";
    const feedDescription = getTextBetweenTags(xmlText, "description") || "";
    const feedLink = getTextBetweenTags(xmlText, "link") || "";

    // Extract all RSS items
    const itemsXml = getAllItems(xmlText);

    const items: RssItem[] = itemsXml.map((itemXml) => {
      // Extract raw content from multiple possible fields
      const rawDescription = getTextBetweenTags(itemXml, "description") || "";
      const contentEncoded =
        getTextBetweenTags(itemXml, "content:encoded") || "";
      const content = getTextBetweenTags(itemXml, "content") || "";

      // Use the richest content available
      const richContent = contentEncoded || content || rawDescription;

      // Extract images from the rich content and media:thumbnail
      const contentImages = extractImages(richContent);
      const mediaThumbnail = extractMediaThumbnail(itemXml);

      // Combine images, prioritize media:thumbnail if available
      const allImages = mediaThumbnail
        ? [mediaThumbnail, ...contentImages]
        : contentImages;
      const featuredImage = allImages.length > 0 ? allImages[0] : undefined;

      // Clean content for display (preserving structure)
      const cleanContent = cleanHtmlContent(richContent);

      return {
        title: getTextBetweenTags(itemXml, "title") || "No Title",
        description: cleanHtmlContent(rawDescription), // Clean description for display
        cleanContent: cleanContent, // New clean content field
        link: getTextBetweenTags(itemXml, "link") || "",
        pubDate:
          getTextBetweenTags(itemXml, "pubDate") ||
          getTextBetweenTags(itemXml, "published") ||
          "",
        guid: getTextBetweenTags(itemXml, "guid") || undefined,
        featuredImage: featuredImage,
        images: allImages.length > 0 ? allImages : undefined,
      };
    });

    const feed: RssFeed = {
      title: feedTitle,
      description: stripHtml(feedDescription),
      link: feedLink,
      items,
    };

    return feed;
  } catch (error) {
    throw new Error(`Failed to parse RSS XML: ${error.message}`);
  }
}

/**
 * Utility function to fetch and parse RSS feed from URL
 * @param url - RSS feed URL
 * @returns Promise with parsed RSS feed
 */
export async function fetchAndParseRss(url: string): Promise<RssFeed> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch RSS feed`);
  }

  const xmlText = await response.text();

  const feed = parseRssXml(xmlText);

  return feed;
}
