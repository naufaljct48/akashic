
const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

export interface RelatedItem {
  id: number;
  relationType: string;
  title: string;
  countryOfOrigin: string;
  type: string;
  format: string;
  coverImage?: string;
}

export interface RecommendationItem {
  id: number;
  title: string;
  countryOfOrigin: string;
  type: string;
  format: string;
  averageScore?: number;
  coverImage?: string;
  votes: number;
}

export interface ComicGraphData {
  relations: RelatedItem[];
  recommendations: RecommendationItem[];
}

const memoryCache = new Map<number, ComicGraphData>();

const GRAPH_QUERY = `
query GetComicRelationsAndRecs($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    relations {
      edges {
        relationType
        node {
          id
          title {
            english
            romaji
          }
          countryOfOrigin
          type
          format
          coverImage {
            medium
          }
        }
      }
    }
    recommendations(sort: RATING_DESC, perPage: 25) {
      nodes {
        rating
        mediaRecommendation {
          id
          title {
            english
            romaji
          }
          countryOfOrigin
          type
          format
          averageScore
          coverImage {
            medium
          }
        }
      }
    }
  }
}
`;

/**
 * Fetch official community recommendations and relations for a comic (0-token cost).
 */
export async function getComicGraphData(sourceId: number): Promise<ComicGraphData> {
  if (memoryCache.has(sourceId)) {
    return memoryCache.get(sourceId)!;
  }

  try {
    const res = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: GRAPH_QUERY,
        variables: { id: sourceId },
      }),
    });

    if (!res.ok) {
      return { relations: [], recommendations: [] };
    }

    const json = await res.json();
    const media = json.data?.Media;
    if (!media) return { relations: [], recommendations: [] };

    const relations: RelatedItem[] = (media.relations?.edges || [])
      .map((edge: any) => ({
        id: edge.node?.id,
        relationType: edge.relationType,
        title: edge.node?.title?.english || edge.node?.title?.romaji || 'Unknown',
        countryOfOrigin: edge.node?.countryOfOrigin || 'JP',
        type: edge.node?.type || 'MANGA',
        format: edge.node?.format || 'MANGA',
        coverImage: edge.node?.coverImage?.medium,
      }))
      .filter((r: RelatedItem) => r.title !== 'Unknown');

    const recommendations: RecommendationItem[] = (media.recommendations?.nodes || [])
      .filter((node: any) => node.mediaRecommendation)
      .map((node: any) => {
        const rec = node.mediaRecommendation;
        return {
          id: rec.id,
          title: rec.title?.english || rec.title?.romaji || 'Unknown',
          countryOfOrigin: rec.countryOfOrigin || 'JP',
          type: rec.countryOfOrigin === 'KR' ? 'MANHWA' : rec.countryOfOrigin === 'CN' ? 'MANHUA' : 'MANGA',
          format: rec.format || 'MANGA',
          averageScore: rec.averageScore,
          coverImage: rec.coverImage?.medium,
          votes: node.rating || 0,
        };
      });

    const result: ComicGraphData = { relations, recommendations };
    memoryCache.set(sourceId, result);
    return result;
  } catch (err) {
    console.warn('[RecommendationGraph] Failed to fetch graph:', err);
    return { relations: [], recommendations: [] };
  }
}
