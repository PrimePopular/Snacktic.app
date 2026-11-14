import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { isAdminRole, isOwnerRole, roleLabel, useAuth } from '../features/authentication';
import type { Role } from '../features/authentication';
import { Link } from '../core/router';
import { Button, EmptyState, Loading, Logo, Modal } from '../shared/components';
import { AdsPage } from './pages/AdsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { CampusPage } from './pages/CampusPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DailyNotificationsPage } from './pages/DailyNotificationsPage';
import { EventsPage } from './pages/EventsPage';
import { purgeEndedEvents } from '../features/events';
import { FeedbackPage } from './pages/FeedbackPage';
import { FindFriendAdminPage } from './pages/FindFriendAdminPage';
import { GameChallengesPage } from './pages/GameChallengesPage';
import { GamesAdminPage } from './pages/GamesAdminPage';
import { PlacesPage } from './pages/PlacesPage';
import { PointsAdminPage } from './pages/PointsAdminPage';
import { RewardsAdminPage } from './pages/RewardsAdminPage';
import { ShareLinkPage } from './pages/ShareLinkPage';
import { StorageCleanupPage } from './pages/StorageCleanupPage';
import { ShopsPage } from './pages/ShopsPage';
import { StudentsPage } from './pages/StudentsPage';
import { TeamPage } from './pages/TeamPage';
import './admin.css';

/**
 * Administrative dashboard (separate from the student app).
 *
 * SECURITY: this code ships in the same static bundle as the student app, so hiding the route
 * protects nothing by itself. Real protection is in the database: Row Level Security on every
 * table and owner/admin checks inside the functions. The checks below only decide what to
 * display. Never trust them for security.
 */
type Tab = 'students' | 'team' | 'announcements' | 'events' | 'places' | 'shops' | 'ads' | 'findfriend' | 'share' | 'campus' | 'gamechallenges' | 'dailynotes' | 'cleanup' | 'feedback' | 'categories' | 'rewards' | 'points' | 'games';

function Shell({ role, children }: { role?: Role; children: ReactNode }) {
  return (
    <div className="admin-shell">
      <header className="admin-bar">
        <Logo size={32} showWordmark tone="light" />
        <span className="admin-bar__tag">{role ? roleLabel(role) : 'Admin'}</span>
        <Link to="/" className="admin-bar__back">
          Back to the app
        </Link>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}

interface Section {
  id: Tab;
  label: string;
  group: 'Content' | 'Owner only';
}

const sections: Section[] = [
  { id: 'announcements', label: 'News & announcements', group: 'Content' },
  { id: 'events', label: 'Events', group: 'Content' },
  { id: 'places', label: 'Places', group: 'Content' },
  { id: 'shops', label: 'Shops', group: 'Content' },
  { id: 'feedback', label: 'Feedback', group: 'Content' },
  { id: 'categories', label: 'Categories', group: 'Content' },
  { id: 'rewards', label: 'Rewards and orders', group: 'Content' },
  { id: 'students', label: 'Students', group: 'Owner only' },
  { id: 'team', label: 'Team', group: 'Owner only' },
  { id: 'ads', label: 'Ads', group: 'Owner only' },
  { id: 'findfriend', label: 'Find a Friend', group: 'Owner only' },
  { id: 'share', label: 'Share link (QR code)', group: 'Owner only' },
  { id: 'campus', label: 'Campus location (weather)', group: 'Owner only' },
  { id: 'gamechallenges', label: 'Game challenges', group: 'Owner only' },
  { id: 'dailynotes', label: 'Daily notifications', group: 'Owner only' },
  { id: 'cleanup', label: 'Storage cleanup', group: 'Owner only' },
  { id: 'points', label: 'Points and limits', group: 'Owner only' },
  { id: 'games', label: 'Game points', group: 'Owner only' },
];

function Dashboard({ role }: { role: Role }) {
  const owner = isOwnerRole(role);
  const available = sections.filter((s) => owner || s.group === 'Content');
  const [tab, setTab] = useState<Tab>(owner ? 'students' : 'announcements');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTitleId = useId();
  // Events that ended are removed (with their pictures) whenever an admin opens the dashboard.
  useEffect(() => {
    void purgeEndedEvents();
  }, []);
  const current = available.find((s) => s.id === tab) ?? available[0];

  return (
    <Shell role={role}>
      <div className="admin-switcher">
        <p className="admin-switcher__current">{current.label}</p>
        <Button variant="secondary" onClick={() => setMenuOpen(true)}>
          Menu
        </Button>
      </div>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} labelledBy={menuTitleId}>
        <div className="admin-menu">
          <h2 id={menuTitleId}>Go to</h2>
          {(['Content', 'Owner only'] as const).map((group) => {
            const items = available.filter((s) => s.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="admin-menu__group">
                <p className="admin-menu__heading">{group}</p>
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={s.id === tab ? 'page' : undefined}
                    onClick={() => {
                      setTab(s.id);
                      setMenuOpen(false);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            );
          })}
          <Button variant="ghost" onClick={() => setMenuOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>

      {tab === 'students' && owner && <StudentsPage />}
      {tab === 'team' && owner && <TeamPage />}
      {tab === 'rewards' && <RewardsAdminPage />}
      {tab === 'points' && owner && <PointsAdminPage />}
      {tab === 'games' && owner && <GamesAdminPage />}
      {tab === 'announcements' && <AnnouncementsPage />}
      {tab === 'events' && <EventsPage />}
      {tab === 'places' && <PlacesPage />}
      {tab === 'shops' && <ShopsPage />}
      {tab === 'feedback' && <FeedbackPage />}
      {tab === 'ads' && owner && <AdsPage />}
      {tab === 'findfriend' && owner && <FindFriendAdminPage />}
      {tab === 'share' && owner && <ShareLinkPage />}
      {tab === 'campus' && owner && <CampusPage />}
      {tab === 'gamechallenges' && owner && <GameChallengesPage />}
      {tab === 'dailynotes' && owner && <DailyNotificationsPage />}
      {tab === 'cleanup' && owner && <StorageCleanupPage />}
      {tab === 'categories' && <CategoriesPage />}
    </Shell>
  );
}

export default function AdminApp() {
  const auth = useAuth();

  useEffect(() => {
    document.title = 'Admin · Snacktic';
  }, []);

  if (auth.status === 'loading') {
    return (
      <Shell>
        <Loading label="Checking your access" />
      </Shell>
    );
  }

  if (auth.status === 'unconfigured') {
    return (
      <Shell>
        <EmptyState title="The database isn't connected yet">
          Add your Supabase keys to .env.local and restart the app.
        </EmptyState>
      </Shell>
    );
  }

  if (auth.status === 'signed-out') {
    return (
      <Shell>
        <EmptyState title="Sign in to continue" action={<Button to="/profile">Go to Profile</Button>}>
          Sign in with your admin account from the Profile tab, then come back here.
        </EmptyState>
      </Shell>
    );
  }

  if (auth.status === 'error' || !auth.profile) {
    return (
      <Shell>
        <EmptyState title="We couldn't check your access" action={<Button onClick={auth.retry}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      </Shell>
    );
  }

  if (!isAdminRole(auth.profile.role)) {
    return (
      <Shell>
        <EmptyState title="This area is for the Snacktic team" action={<Button to="/">Back to the app</Button>}>
          Your account doesn't have access here.
        </EmptyState>
      </Shell>
    );
  }

  return <Dashboard role={auth.profile.role} />;
}
