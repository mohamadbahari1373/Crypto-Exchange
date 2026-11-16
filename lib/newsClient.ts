import type { NewsApiResponse } from '@/lib/types';

export function isNewsApiResponse(data: unknown): data is NewsApiResponse {
  return typeof data === 'object' && data !== null
    && 'success' in data && data.success === true
    && 'articles' in data && Array.isArray(data.articles)
    && 'lastUpdated' in data && typeof data.lastUpdated === 'string'
    && 'total' in data && typeof data.total === 'number'
    && 'sources' in data && typeof data.sources === 'object' && data.sources !== null;
}

export async function fetchNewsData(signal?: AbortSignal): Promise<NewsApiResponse> {
  let response = await fetch('/api/cache_news.json', { cache: 'no-store', signal });
  if (response.status === 404) {
    response = await fetch('/api/news.php', { cache: 'no-store', signal });
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data: unknown = await response.json();
  if (!isNewsApiResponse(data)) {
    throw new Error('Invalid news response');
  }
  return data;
}
