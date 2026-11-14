import { lazy, Suspense, useState } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { navigate } from '../../core/router';
import { useAuth } from '../../features/authentication';
import { RetryPicker } from '../../games/shared/RetryPicker';
import { submitGameResult } from '../../features/points';
import type { AwardOutcome } from '../../features/points';
import type { GameDefinition, GameProps, GameResult } from '../../games/game.types';
import { findGame } from '../../games/registry';
import { playCoin } from '../../services/sound';
import { Button, Card, EmptyState, Loading, PageHeader } from '../../shared/components';
import './games.css';

const loaded = new Map<string, LazyExoticComponent<ComponentType<GameProps>>>();

function componentFor(game: GameDefinition) {
  let component = loaded.get(game.id);
  if (!component) {
    component = lazy(game.load);
    loaded.set(game.id, component);
  }
  return component;
}

type Outcome = AwardOutcome | 'sending';

/** What to tell the student about the points for this round. */
function PointsMessage({ outcome }: { outcome: Outcome }) {
  if (outcome === 'sending') return <p className="text-secondary">Checking your result…</p>;

  if (outcome.status === 'awarded') {
    if (outcome.points > 0) {
      return (
        <div className="game-result__points">
          <p className="game-result__plus">+{outcome.points} Crumb Points</p>
          <p className="text-secondary text-small">
            {outcome.reason === 'challenge'
              ? 'Daily challenge done! Come back tomorrow for a new one, or try again today for Crumb Points.'
              : outcome.reason === 'milestone'
                ? 'New score milestone reached!'
                : outcome.reason === 'daily_first'
                  ? 'Daily bonus! Replays today earn fewer points.'
                  : 'Replays earn fewer points than your first round of the day.'}
          </p>
        </div>
      );
    }
    if (outcome.reason === 'cap_reached') {
      return <p className="text-secondary">You've reached today's points limit for this game. Come back tomorrow for the full daily bonus.</p>;
    }
    if (outcome.reason === 'already_recorded') return <p className="text-secondary">This result was already counted.</p>;
    if (outcome.reason === 'score_too_low') return <p className="text-secondary">No points this time. Better luck next time!</p>;
    return null; // this game is not giving points
  }

  if (outcome.status === 'queued') {
    return outcome.why === 'guest' ? (
      <div className="game-result__points">
        <p className="game-result__plus">Points waiting for you</p>
        <p className="text-secondary text-small">Create an account within 24 hours and this score is checked and added to your points.</p>
        <Button to="/profile">Create an account</Button>
      </div>
    ) : (
      <p className="text-secondary">You're offline. We'll add your points as soon as you reconnect.</p>
    );
  }

  return <p className="form-error">We couldn't add points for this round: {outcome.message}</p>;
}

/**
 * Loads and runs one game, then shows its result and pays points through the central points
 * service. A game never changes a balance itself: it only reports its result.
 */
export function GameHost({ id }: { id: string }) {
  const auth = useAuth();
  const game = findGame(id);
  const [result, setResult] = useState<GameResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [round, setRound] = useState(0);
  const [start, setStart] = useState<GameProps['start']>(undefined);
  const [problem, setProblem] = useState<string | null>(null);

  const isDaily = Boolean(result && game?.modes?.find((m) => m.id === result.mode)?.dailyChallenge);

  if (!game) {
    return (
      <EmptyState title="That game isn't available" action={<Button to="/games">Back to games</Button>}>
        It may have been removed or the link is out of date.
      </EmptyState>
    );
  }

  function handleFinish(finished: GameResult) {
    setResult(finished);
    setOutcome('sending');
    setProblem(null);
    void submitGameResult(finished, auth.status === 'signed-in').then((o) => {
      setOutcome(o);
      if (o.status === 'awarded' && o.points > 0) playCoin();
    });
  }

  /** Straight back into the same mode, with no picker in between. */
  function begin(attemptId?: string) {
    if (!result) return;
    setStart({ mode: result.mode, attemptId });
    setResult(null);
    setOutcome(null);
    setProblem(null);
    setRound((r) => r + 1);
  }

  const GameComponent = componentFor(game);

  return (
    <>
      <PageHeader title={game.title} description={game.instructions} />
      <Suspense fallback={<Loading label="Loading game" />}>
        <GameComponent key={round} start={start} onFinish={handleFinish} onExit={() => navigate('/games')} />
      </Suspense>
      {result && (
        <div className="game-overlay" role="dialog" aria-modal="true" aria-label={`${game.title} result`}>
          <Card tone="warm" className="game-result">
            <h2 className="game-result__title">{game.title}</h2>
            <p className="text-secondary">{isDaily ? 'Daily Challenge' : 'Your score'}</p>
            <p className="game-result__score">{result.score}</p>
            {outcome && <PointsMessage outcome={outcome} />}
            {problem && (
              <p className="form-error" role="alert">
                {problem}
              </p>
            )}
            {isDaily ? (
              <RetryPicker key={result.finishedAt} gameId={game.id} mode={result.mode} onStart={(attemptId) => begin(attemptId)} />
            ) : (
              <Button onClick={() => begin()}>Play again</Button>
            )}
            <div className="game-result__actions">
              <Button variant="secondary" to="/games">
                Leave game
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
