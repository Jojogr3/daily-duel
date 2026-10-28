import { MODE_NAMES, scoreLine, shareText, tierFor } from '@daily-duel/engine';
import { router } from 'expo-router';
import { Share, Text, View } from 'react-native';
import { config } from '../config';
import { AdBanner } from '../services/ads';
import type { DuelSummary } from '../services/types';
import { useApp } from '../state/AppContext';
import { radius, space, useTheme } from '../theme';
import { Body, Button, Card, Pill, Row, Small, Title } from './ui';

const VERDICT = {
  win: { title: 'You won!', emoji: '🏆' },
  loss: { title: 'So close.', emoji: '⚔️' },
  draw: { title: "It's a tie.", emoji: '🤝' },
} as const;

export function ResultView({ summary }: { summary: DuelSummary }) {
  const t = useTheme();
  const { subscribed, profile } = useApp();
  const v = VERDICT[summary.outcome];
  const delta = summary.ratingAfter - summary.ratingBefore;
  const tierBefore = tierFor(summary.ratingBefore).name;
  const tierAfter = tierFor(summary.ratingAfter).name;
  const youLine = scoreLine(summary.you, summary.par);
  const rivalLine = scoreLine(summary.rival, summary.par);

  const share = async () => {
    const message = shareText({
      mode: summary.mode,
      dateKey: summary.dateKey,
      outcome: summary.outcome,
      rivalTier: summary.rivalInfo.tier,
      scoreLine: youLine,
      streak: summary.streak.current,
      linkBase: config.linkBase,
    });
    await Share.share({ message }).catch(() => {});
  };

  return (
    <View style={{ gap: space(2) }}>
      <View style={{ alignItems: 'center', gap: space(0.5), paddingTop: space(1) }}>
        <Text style={{ fontSize: 56 }}>{v.emoji}</Text>
        <Title>{v.title}</Title>
        <Small>
          {MODE_NAMES[summary.mode]} · {summary.dateKey}
        </Small>
      </View>

      <Row style={{ gap: space(1.5), alignItems: 'stretch' }}>
        <Card style={{ flex: 1, backgroundColor: t.youSoft, borderColor: summary.outcome === 'win' ? t.you : t.line }}>
          <Small>You</Small>
          <Body style={{ fontWeight: '800' }}>{profile?.name ?? 'You'}</Body>
          <Body>{youLine}</Body>
        </Card>
        <Card style={{ flex: 1, backgroundColor: t.rivalSoft, borderColor: summary.outcome === 'loss' ? t.rival : t.line }}>
          <Small>Rival</Small>
          <Row style={{ gap: 6 }}>
            <Body style={{ fontWeight: '800' }}>{summary.rivalInfo.name}</Body>
            {summary.rivalInfo.isBot ? <Small>🤖</Small> : null}
          </Row>
          <Body>{rivalLine}</Body>
        </Card>
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body muted>Rating</Body>
          <Body style={{ fontWeight: '700', color: delta >= 0 ? t.good : t.you }}>
            {summary.ratingAfter} ({delta >= 0 ? '+' : ''}
            {delta})
          </Body>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body muted>Tier</Body>
          <Row>
            <Body style={{ fontWeight: '700' }}>{tierAfter}</Body>
            {tierAfter !== tierBefore ? <Pill label={delta > 0 ? 'Promoted!' : 'Dropped'} color={delta > 0 ? t.good : t.surfaceAlt} textColor={delta > 0 ? '#FFFFFF' : t.ink} /> : null}
          </Row>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body muted>Streak</Body>
          <Body style={{ fontWeight: '700' }}>🔥 {summary.streak.current} day{summary.streak.current === 1 ? '' : 's'}</Body>
        </Row>
        {summary.rank ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Body muted>Today's leaderboard</Body>
            <Body style={{ fontWeight: '700' }}>#{summary.rank}</Body>
          </Row>
        ) : null}
      </Card>

      {summary.milestone ? (
        <View style={{ backgroundColor: t.warn, borderRadius: radius.lg, padding: space(2), alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>🎉 {summary.milestone}-day streak badge unlocked!</Text>
        </View>
      ) : null}

      <Button label="Share result" onPress={share} />
      <Row style={{ gap: space(1.5) }}>
        <Button label="Leaderboard" kind="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/leaderboard', params: { mode: summary.mode } })} />
        <Button label="Home" kind="secondary" style={{ flex: 1 }} onPress={() => router.dismissTo('/')} />
      </Row>
      <AdBanner hidden={subscribed} />
    </View>
  );
}
