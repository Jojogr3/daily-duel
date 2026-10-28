/** Renders the right game for a puzzle, loading the dictionary first for Word Rush. */
import type { AnyMoves, AnyPuzzle, Dictionary } from '@daily-duel/engine';
import { useEffect, useState } from 'react';
import { loadDictionary } from '../services/dictionary';
import { ColorFloodGame } from './ColorFloodGame';
import { ErrorBox, Loading } from './ui';
import { WordRushGame } from './WordRushGame';

export function GameHost({ puzzle, startedAt, onFinish }: { puzzle: AnyPuzzle; startedAt: number; onFinish(moves: AnyMoves): void }) {
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (puzzle.mode !== 'word-rush') return;
    loadDictionary().then(setDict, () => setError('Could not load the word list.'));
  }, [puzzle.mode]);

  if (puzzle.mode === 'color-flood') return <ColorFloodGame puzzle={puzzle} startedAt={startedAt} onFinish={onFinish} />;
  if (error) return <ErrorBox message={error} />;
  if (!dict) return <Loading label="Loading words…" />;
  return <WordRushGame puzzle={puzzle} dict={dict} startedAt={startedAt} onFinish={onFinish} />;
}
