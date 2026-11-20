import { useLiveFindFriend } from '../../features/find-a-friend';
import { AdCard, useRotatedAds, weaveAds } from '../../features/ads';
import { CrossEvent } from '../../features/events';
import { CrossBonus } from '../../features/bonus';
import { CrossFeature } from '../../features/cross';
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
  const findFriend = useLiveFindFriend();
  const ads = useRotatedAds('games');

  return (
    <>
      <PageHeader tone="pistachio" title="Games" description="Pick a game and play." />

      <section className="games-section" aria-labelledby="classic-heading">
        <h2 id="classic-heading">Classic games</h2>
        <ul className="slot-grid">
          {weaveAds(classicSlots, ads).map((entry) => {
            if (entry.kind === 'ad') {
              return (
                <li key={entry.key}>
                  <AdCard ad={entry.ad} />
                </li>
              );
            }
            const { slot, plannedName } = entry.item;
            const game = classicGames.find((g) => g.slot === slot);
            return (
              <li key={slot}>
                {game ? (
                  <Card as="article" className="slot-card slot-card--compact">
                    <h3>{game.title}</h3>
                    <Button to={`/games/${game.id}`}>Play</Button>
                  </Card>
                ) : (
                  <div className="slot-card slot-card--empty slot-card--compact">
                    <h3>{plannedName}</h3>
                    <p className="text-secondary text-small">Coming soon</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <CrossEvent />
      <CrossFeature section="games" />
      <CrossBonus section="games" />

      <section className="games-section" aria-labelledby="events-heading">
        <h2 id="events-heading">Special events</h2>
        <p className="text-secondary text-small">
          Limited-time games. They show up for a little while, then they're gone.
        </p>
        {activeEvents.length === 0 && !findFriend ? (
          <p className="events-none text-secondary">No special events right now. Check back soon.</p>
        ) : (
          <ul className="event-list">
            {findFriend && (
              <li>
                <Card as="article" tone="dark" className="event-card">
                  <span className="badge">Live now</span>
                  <h3>{findFriend.name}</h3>
                  <p>Scan friends' codes and earn Crumb Points for every friend you find.</p>
                  <p className="event-card__meta text-xs">Ends {formatDate(findFriend.endsAt)}</p>
                  <Button to="/find-a-friend">Join in</Button>
                </Card>
              </li>
            )}
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
