/**
 * Loads the bundled Word Rush dictionary once. The file is ~1.7 MB of text and
 * builds into a compact trie of a few MB, so it's loaded lazily the first time
 * a Word Rush board is needed.
 */
import { buildDictionary, type Dictionary } from '@daily-duel/engine';
import { Asset } from 'expo-asset';

let loading: Promise<Dictionary> | null = null;

export function loadDictionary(): Promise<Dictionary> {
  if (!loading) {
    loading = (async () => {
      const asset = Asset.fromModule(require('../../assets/words.txt'));
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      const text = await (await fetch(uri)).text();
      return buildDictionary(text);
    })();
    loading.catch(() => {
      loading = null; // allow a retry after a failure
    });
  }
  return loading;
}
