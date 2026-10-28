import {
  isAdjacent8,
  MIN_WORD_LENGTH,
  scoreWord,
  wordForPath,
  type Dictionary,
  type WordRushMove,
  type WordRushPuzzle,
} from '@daily-duel/engine';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useApp } from '../state/AppContext';
import { font, radius, space, useTheme } from '../theme';
import { Row, Small } from './ui';

type Flash = { kind: 'good' | 'dupe' | 'bad'; text: string } | null;

interface Props {
  puzzle: WordRushPuzzle;
  dict: Dictionary;
  /** Client-clock ms when the round started. */
  startedAt: number;
  onFinish(moves: WordRushMove[]): void;
}

/** Only the inner part of each tile counts as a hit, so diagonal drags don't clip neighbours. */
const HIT_RADIUS = 0.38;

export function WordRushGame({ puzzle, dict, startedAt, onFinish }: Props) {
  const t = useTheme();
  const { settings } = useApp();
  const size = puzzle.size;
  const [path, setPath] = useState<number[]>([]);
  const [moves, setMoves] = useState<WordRushMove[]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [now, setNow] = useState(Date.now());
  /** Grid width, and the grid's page offset worked out from the first touch of each drag. */
  const box = useRef({ x: 0, y: 0, w: 1 });
  const pathRef = useRef<number[]>([]);
  const movesRef = useRef<WordRushMove[]>([]);
  const finished = useRef(false);

  const endsAt = startedAt + puzzle.durationMs;
  const remaining = Math.max(0, endsAt - now);
  const found = useMemo(() => new Set(moves.map((m) => wordForPath(puzzle.tiles, m.path))), [moves, puzzle.tiles]);
  const score = useMemo(() => [...found].reduce((s, w) => s + scoreWord(w), 0), [found]);

  const buzz = useCallback(
    (kind: 'tick' | 'good' | 'bad') => {
      if (!settings.haptics || Platform.OS === 'web') return;
      if (kind === 'tick') Haptics.selectionAsync().catch(() => {});
      else Haptics.notificationAsync(kind === 'good' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    },
    [settings.haptics],
  );

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinish(movesRef.current);
  }, [onFinish]);

  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endsAt) finish();
    }, 200);
    return () => clearInterval(id);
  }, [endsAt, finish]);

  const tileAt = (pageX: number, pageY: number): number | null => {
    const { x, y, w } = box.current;
    const cell = w / size;
    const cx = (pageX - x) / cell;
    const cy = (pageY - y) / cell;
    const col = Math.floor(cx);
    const row = Math.floor(cy);
    if (col < 0 || row < 0 || col >= size || row >= size) return null;
    const dx = cx - (col + 0.5);
    const dy = cy - (row + 0.5);
    if (dx * dx + dy * dy > HIT_RADIUS * HIT_RADIUS) return null;
    return row * size + col;
  };

  const extend = (index: number | null) => {
    if (index === null) return;
    const p = pathRef.current;
    const last = p[p.length - 1];
    if (last === index) return;
    if (p.length >= 2 && p[p.length - 2] === index) {
      // Dragged back onto the previous tile: undo one step.
      pathRef.current = p.slice(0, -1);
    } else if (p.includes(index)) {
      return;
    } else if (last === undefined || isAdjacent8(last, index, size)) {
      pathRef.current = [...p, index];
      buzz('tick');
    } else {
      return;
    }
    setPath(pathRef.current);
  };

  const submitPath = () => {
    const p = pathRef.current;
    pathRef.current = [];
    setPath([]);
    if (p.length === 0 || finished.current) return;
    const word = wordForPath(puzzle.tiles, p);
    if (word.length < MIN_WORD_LENGTH) return;
    if (!dict.has(word)) {
      setFlash({ kind: 'bad', text: word.toUpperCase() });
      buzz('bad');
      return;
    }
    const already = movesRef.current.some((m) => wordForPath(puzzle.tiles, m.path) === word);
    if (already) {
      setFlash({ kind: 'dupe', text: `${word.toUpperCase()} · already found` });
      buzz('bad');
      return;
    }
    const move = { path: p, t: Math.min(Date.now() - startedAt, puzzle.durationMs) };
    movesRef.current = [...movesRef.current, move];
    setMoves(movesRef.current);
    setFlash({ kind: 'good', text: `${word.toUpperCase()} +${scoreWord(word)}` });
    buzz('good');
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          // Tiles ignore touches, so locationX/Y are relative to the grid itself.
          const { pageX, pageY, locationX, locationY } = e.nativeEvent;
          box.current = { ...box.current, x: pageX - locationX, y: pageY - locationY };
          pathRef.current = [];
          extend(tileAt(pageX, pageY));
        },
        onPanResponderMove: (e) => extend(tileAt(e.nativeEvent.pageX, e.nativeEvent.pageY)),
        onPanResponderRelease: submitPath,
        onPanResponderTerminate: submitPath,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzle, dict],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    box.current = { ...box.current, w: e.nativeEvent.layout.width };
  };

  const current = wordForPath(puzzle.tiles, path).toUpperCase();
  const secs = Math.ceil(remaining / 1000);
  const flashColor = flash?.kind === 'good' ? t.good : flash?.kind === 'dupe' ? t.warn : t.muted;

  return (
    <View style={{ gap: space(2) }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Small>Score</Small>
          <Text style={[font.title, font.mono, { color: t.ink }]}>{score}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Small>Time</Small>
          <Text style={[font.title, font.mono, { color: secs <= 10 ? t.you : t.ink }]} accessibilityLiveRegion="polite">
            0:{String(secs).padStart(2, '0')}
          </Text>
        </View>
      </Row>

      <View style={{ height: 36, alignItems: 'center', justifyContent: 'center' }}>
        {current ? (
          <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: 2, color: t.ink }}>{current}</Text>
        ) : flash ? (
          <Text style={{ fontSize: 18, fontWeight: '700', color: flashColor }}>{flash.text}</Text>
        ) : (
          <Small>Drag across touching letters to make words</Small>
        )}
      </View>

      <View
        onLayout={onLayout}
        {...responder.panHandlers}
        style={{ aspectRatio: 1, width: '100%', flexDirection: 'row', flexWrap: 'wrap' }}
        accessibilityLabel="Letter grid"
      >
        {puzzle.tiles.map((face, i) => {
          const active = path.includes(i);
          return (
            <View key={i} style={{ pointerEvents: 'none', width: `${100 / size}%`, aspectRatio: 1, padding: 5 }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: radius.md,
                  backgroundColor: active ? t.tileActive : t.tile,
                  borderWidth: 1,
                  borderColor: active ? t.tileActive : t.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.06,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 1,
                }}
              >
                <Text style={{ fontSize: face === 'qu' ? 28 : 34, fontWeight: '800', color: active ? '#FFFFFF' : t.tileInk }}>
                  {face === 'qu' ? 'Qu' : face.toUpperCase()}
                </Text>
                {face.length > 0 ? (
                  <Text style={{ position: 'absolute', right: 8, bottom: 4, fontSize: 10, color: active ? '#FFFFFFAA' : t.muted }}>
                    {scoreHint(face)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[...found].reverse().map((w) => (
          <View key={w} style={{ backgroundColor: t.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: t.ink, fontWeight: '600', fontSize: 13 }}>{w.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Rare letters get a tiny marker so players learn where the long words hide. */
function scoreHint(face: string): string {
  return face === 'qu' || face === 'x' || face === 'z' || face === 'j' || face === 'k' ? '★' : '';
}
