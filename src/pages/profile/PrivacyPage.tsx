import { Button, PageHeader } from '../../shared/components';
import './profile.css';

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'snacktic.service@gmail.com';

/**
 * Plain-language privacy notice. Keep it truthful: update it whenever the app starts collecting something new.
 * Have it reviewed before public launch.
 */
export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy notice" description="What Snacktic stores, why, and who can see it." />
      <div className="legal">
        <section>
          <h2>What we collect</h2>
          <ul>
            <li>
              When you create an account: your name, a nickname, your email address and a password (stored scrambled, so nobody can read it). You can also add a WhatsApp number. It is needed only when you order a reward, and it is saved
              with the Nigeria country code (+234) if you leave it out.
            </li>
            <li>As you use the app: your Crumb Points and their history, gifts you send and receive, rewards and digital items you get, where an order should be delivered, and your game results and progress.</li>
            <li>Invites: if you open a friend's Find a Friend invite link, we remember who invited you, so they can earn their points.</li>
            <li>Support and feedback: what you write when you report a problem or send an idea, an optional screenshot, your phone and browser type, and the app version. You can also send a report without an account.</li>
            <li>Ads: we count how many people see and tap each ad. These are plain totals. For a signed-in student we also note which ads they have already been paid for, so nobody is paid twice.</li>
            <li>If you stay a guest: your game scores stay on your own device only.</li>
          </ul>
        </section>

        <section>
          <h2>Location and notifications</h2>
          <ul>
            <li>The weather card asks your phone for its location (the phone asks your permission). It is used to show the weather where you are, and it stays on your device.</li>
            <li>
              If you turn on notifications, we store a private address for your phone so we can message it, your notification choices, and your approximate location (rounded to about 10 km) so the morning weather is for your area. Turn
              notifications off in Profile and the address is removed.
            </li>
          </ul>
        </section>

        <section>
          <h2>Why we collect it</h2>
          <p>
            To run your account, let friends send you points using your username, keep your points safe, deliver the rewards you order, fix problems you report, and keep Snacktic free of abuse. We use your email for account messages such as
            password resets.
          </p>
        </section>

        <section>
          <h2>Who can see it</h2>
          <ul>
            <li>Other students can see your nickname, for example when they send you points, or on the Find a Friend leaderboard.</li>
            <li>Your name and email can be seen only by the Snacktic owner. When you order a reward, the team members who handle orders can see your nickname, WhatsApp number, email and delivery place for that order, so they can arrange delivery.</li>
            <li>The owner and team members who manage feedback can see the reports you send, including who sent them and any screenshot.</li>
            <li>We do not sell your information. Snacktic shows ads from advertisers. Advertisers do not receive your personal details, only overall counts of views and taps.</li>
          </ul>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <ul>
            <li>Orders that have been handed over or cancelled are removed automatically after a few days. Old messages and old game records are also removed automatically.</li>
            <li>Your Crumb Points history is kept so your balance always stays correct.</li>
            <li>Feedback is kept until the team has dealt with it and deletes it.</li>
          </ul>
        </section>

        <section>
          <h2>Where it is kept</h2>
          <p>
            Your account and activity are stored with our hosting providers. The app also saves some things on your own device, such as preferences, your chosen place for the weather and game progress, so it works quickly and offline. To
            tailor your Home feed, the app also remembers on your device which kinds of events you open. That stays on your device and is not sent to us.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can turn any notification off in Profile, say no to location, and ask to see, correct or delete your account and the personal details attached to it. Contact us at{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>If this notice changes, we will update this page. Last updated: 16 November 2026.</p>
        </section>

        <Button variant="secondary" to="/profile">
          Back to Profile
        </Button>
      </div>
    </>
  );
}
