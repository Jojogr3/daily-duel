/** Share links (https://dailyduel.app/p/<mode>/<date> or dailyduel://p/<mode>/<date>) land here. */
import { isMode } from '@daily-duel/engine';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SharedPuzzleLink() {
  const { mode, date } = useLocalSearchParams<{ mode: string; date: string }>();
  if (!isMode(mode)) return <Redirect href="/" />;
  return <Redirect href={{ pathname: '/play/[mode]', params: { mode, date, source: 'share' } }} />;
}
