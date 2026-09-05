import { describe, expect, it } from 'vitest';

import {
  dataDragonChampionUrl,
  fetchDataDragonSource,
  type SourceCache,
} from './data-dragon-source';
import { makeExceptionSource, TEST_DATA_DRAGON_VERSION } from './test-fixtures';

class MemoryCache implements SourceCache {
  private readonly values = new Map<string, unknown>();

  async read(key: string): Promise<unknown | undefined> {
    return this.values.get(key);
  }

  async write(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

function makeResponses() {
  const source = makeExceptionSource();
  const indexUrl = `https://ddragon.leagueoflegends.com/cdn/${TEST_DATA_DRAGON_VERSION}/data/en_US/champion.json`;
  const responses = new Map<string, unknown>([[indexUrl, source.summary]]);

  for (const [championId, champion] of Object.entries(source.details)) {
    responses.set(dataDragonChampionUrl(TEST_DATA_DRAGON_VERSION, championId), {
      type: 'champion',
      format: 'standAloneComplex',
      version: TEST_DATA_DRAGON_VERSION,
      data: { [championId]: champion },
    });
  }

  return { responses, source };
}

describe('fetchDataDragonSource', () => {
  it('fetches the index and details once, then serves the same source from cache', async () => {
    const { responses, source } = makeResponses();
    const cache = new MemoryCache();
    const fetchedUrls: string[] = [];
    const fetchJson = async (url: string): Promise<unknown> => {
      fetchedUrls.push(url);
      const response = responses.get(url);
      if (!response) {
        throw new Error(`Missing fixture response for ${url}`);
      }
      return response;
    };

    const first = await fetchDataDragonSource({
      version: TEST_DATA_DRAGON_VERSION,
      fetchJson,
      cache,
      concurrency: 2,
    });
    const second = await fetchDataDragonSource({
      version: TEST_DATA_DRAGON_VERSION,
      fetchJson,
      cache,
      concurrency: 2,
    });

    expect(fetchedUrls).toHaveLength(Object.keys(source.details).length + 1);
    expect(second).toEqual(first);
    expect(Object.keys(first.details)).toEqual([
      'Aphelios',
      'Elise',
      'Gnar',
      'Hwei',
      'Jayce',
      'Kayn',
      'Kled',
      'Nidalee',
      'NormalChamp',
      'RekSai',
      'Shyvana',
      'Viego',
    ]);
  });

  it('fails before fetching when the version is not explicit', async () => {
    await expect(
      fetchDataDragonSource({
        version: 'latest',
        fetchJson: async () => ({}),
      }),
    ).rejects.toThrow(/explicit x\.y\.z version/);
  });

  it('reports an invalid fetched response with its source URL and field path', async () => {
    const { responses } = makeResponses();
    const indexUrl = `https://ddragon.leagueoflegends.com/cdn/${TEST_DATA_DRAGON_VERSION}/data/en_US/champion.json`;
    const invalidIndex = JSON.parse(JSON.stringify(responses.get(indexUrl))) as {
      data: Record<string, Record<string, unknown>>;
    };
    invalidIndex.data.Hwei.name = '';
    responses.set(indexUrl, invalidIndex);

    await expect(
      fetchDataDragonSource({
        version: TEST_DATA_DRAGON_VERSION,
        fetchJson: async (url) => responses.get(url),
      }),
    ).rejects.toThrow(/champion index.*name/i);
  });
});
