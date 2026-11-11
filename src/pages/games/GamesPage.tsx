import { classicGames, classicSlots, isEventActive, specialEvents } from '../../games/registry';
import { Button, Card, PageHeader } from '../../shared/components';
import './games.css';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

/**
 * The game-selection page. Two separate areas:
 *  - Classic games: four permanent slots.
 *  - Special events: limited-time campaigns that appear and disappear on their own.
 * Individual games live in src/games/<game-id>/, special events in src/special-events/.
 */
export default function GamesPage() {
  const activeEvents = specialEvents.filter((event) => isEventActive(event));

  return (
    <>
      <PageHeader tone="pistachio" title="Games" description="Four games that are always here, plus limited-time events." />

      <section className="games-section" aria-labelledby="classic-heading">
        <h2 id="classic-heading">Classic games</h2>
        <ul className="slot-grid">
          {classicSlots.map(({ slot, plannedName }) => {
            const game = classicGames.find((g) => g.slot === slot);
            return (
              <li key={slot}>
                {game ? (
                  <Card as="article" className="slot-card">
                    <h3>{game.title}</h3>
                    <p className="text-secondary text-small">{game.summary}</p>
                    <p className="text-xs text-secondary">About {game.estimatedSeconds} seconds</p>
                    {game.modes && game.modes.length > 0 && (
                      <p className="slot-card__modes">
                        {game.modes.map((m) => (
                          <span key={m.id} className={`badge ${m.dailyChallenge ? '' : 'badge--minor'} badge--small`}>
                            {m.dailyChallenge ? `${m.label} · daily` : m.label}
                          </span>
                        ))}
                      </p>
                    )}
                    <Button to={`/games/${game.id}`}>Play</Button>
                  </Card>
                ) : (
                  <div className="slot-card slot-card--empty">
                    <p className="text-xs text-secondary">Game {slot}</p>
                    <h3>{plannedName}</h3>
                    <p className="text-secondary text-small">Coming soon</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="games-section" aria-labelledby="events-heading">
        <h2 id="events-heading">Special events</h2>
        <p className="text-secondary text-small">
          Limited-time games. They show up for a little while, then they're gone.
        </p>
        {activeEvents.length === 0 ? (
          <p className="events-none text-secondary">No special events right now. Check back soon.</p>
        ) : (
          <ul className="event-list">
            {activeEvents.map((event) => (
              <li key={event.id}>
                <Card as="article" tone="dark" className="event-card">
                  <span className="badge">Limited time</span>
                  <h3>{event.title}</h3>
                  <p>{event.summary}</p>
                  <p className="event-card__meta text-xs">Ends {formatDate(event.endsAt)}</p>
                  <Button to={`/games/events/${event.id}`}>Join in</Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
