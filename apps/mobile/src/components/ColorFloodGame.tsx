import {
  applyFlood,
  COLOR_FLOOD_MAX_TAPS,
  floodRegion,
  isSolved,
  type ColorFloodMove,
  type ColorFloodPuzzle,
} from '@daily-duel/engine';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { FLOOD_COLORS, FLOOD_SYMBOLS, font, radius, space, useTheme } from '../theme';
import { Row, Small } from './ui';

interface Props {
  puzzle: ColorFloodPuzzle;
  startedAt: number;
  onFinish(moves: ColorFloodMove[]): void;
}

export function ColorFloodGame({ puzzle, startedAt, onFinish }: Props) {
  const t = useTheme();
  const { settings } = useApp();
  const [cells, setCells] = useState<number[]>(puzzle.cells);
  const [moves, setMoves] = useState<ColorFloodMove[]>([]);
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);

  const region = useMemo(() => floodRegion(cells, puzzle.size), [cells, puzzle.size]);
  const current = cells[0] ?? 0;
  const taps = moves.length;
  const outOfTaps = taps >= COLOR_FLOOD_MAX_TAPS;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const tap = (color: number) => {
    if (finished.current || color === current || outOfTaps) return;
    const next = applyFlood(cells, puzzle.size, color);
    const move = { color, t: Date.now() - startedAt };
    const nextMoves = [...moves, move];
    setCells(next);
    setMoves(nextMoves);
    if (settings.haptics && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (isSolved(next) || nextMoves.length >= COLOR_FLOOD_MAX_TAPS) {
      finished.current = true;
      if (settings.haptics && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setTimeout(() => onFinish(nextMoves), 450); // let the last fill land visually
    }
  };

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const underPar = taps <= puzzle.par;

  return (
    <View style={{ gap: space(2) }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Small>Taps</Small>
          <Text style={[font.title, font.mono, { color: underPar ? t.ink : t.you }]}>
            {taps}
            <Text style={{ fontSize: 16, color: t.muted }}> / par {puzzle.par}</Text>
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Small>Time</Small>
          <Text style={[font.title, font.mono, { color: t.ink }]}>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </Text>
        </View>
      </Row>

      <View
        style={{ aspectRatio: 1, width: '100%', flexDirection: 'row', flexWrap: 'wrap', borderRadius: radius.md, overflow: 'hidden' }}
        accessibilityLabel={`Board, ${region.size} of ${cells.length} cells flooded`}
      >
        {cells.map((c, i) => (
          <View
            key={i}
            style={{
              width: `${100 / puzzle.size}%`,
              aspectRatio: 1,
              backgroundColor: FLOOD_COLORS[c],
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: region.has(i) ? 0 : 0.5,
              borderColor: '#00000010',
            }}
          >
            <Text style={{ color: '#FFFFFF', opacity: 0.35, fontSize: 11 }}>{FLOOD_SYMBOLS[c]}</Text>
          </View>
        ))}
      </View>

      <Small style={{ textAlign: 'center' }}>
        {outOfTaps ? 'Out of taps' : 'Tap a colour to grow your area from the top-left corner'}
      </Small>

      <Row style={{ justifyContent: 'space-between' }}>
        {FLOOD_COLORS.slice(0, puzzle.colors).map((color, i) => {
          const disabled = i === current || finished.current;
          return (
            <Pressable
              key={color}
              onPress={() => tap(i)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${i + 1}`}
              style={({ pressed }) => ({
                flex: 1,
                aspectRatio: 1,
                marginHorizontal: 3,
                borderRadius: radius.md,
                backgroundColor: color,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled ? 0.3 : pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>{FLOOD_SYMBOLS[i]}</Text>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}
