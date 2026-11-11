import { Button, PageHeader } from '../../shared/components';
import './profile.css';

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL;

/**
 * Plain-language privacy notice. Keep it truthful: update it whenever the app starts collecting
 * something new (for example location or notifications). Have it reviewed before public launch.
 */
export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy notice" description="What Snacktic stores, why, and who can see it." />
      <div className="legal">
        <section>
          <h2>What we collect</h2>
          <ul>
            <li>When you create an account: your name, a nickname, your email address and a password. You can also add a WhatsApp number, which is needed only when you order a reward. Your password is stored in a scrambled form that nobody, including us, can read.</li>
            <li>As you use the app: your Crumb Points, gifts you send and receive, rewards you redeem and your game results.</li>
            <li>If you stay a guest: your game scores stay on your own device only.</li>
          </ul>
        </section>

        <section>
          <h2>Why we collect it</h2>
          <p>
            To run your account, let friends send you points using your username, keep your points safe and keep Snacktic free
            of abuse. We use your email for account messages such as password resets.
          </p>
        </section>

        <section>
          <h2>Who can see it</h2>
          <ul>
            <li>Other students can see your username, for example when they send you points.</li>
            <li>Your name and email can be seen only by the Snacktic owner. When you order a reward, the team members who handle orders can see your nickname, WhatsApp number and email for that order, so they can arrange delivery.</li>
            <li>We do not sell your information and we do not show ads.</li>
          </ul>
        </section>

        <section>
          <h2>Where it is kept</h2>
          <p>
            Your account and activity are stored with our hosting providers. The app also saves some things on your own device,
            such as preferences and game progress, so it works quickly and offline. To tailor your Home feed, the app also remembers
            on your device which kinds of events you open. That stays on your device and is not sent to us.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can ask to see, correct or delete your account and the personal details attached to it.
            {contactEmail ? (
              <>
                {' '}
                Contact us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
              </>
            ) : null}{' '}
            If we ever want to use something extra, such as your location, we will ask your permission first.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>If this notice changes, we will update this page. Last updated: 4 November 2026.</p>
        </section>

        <Button variant="secondary" to="/profile">
          Back to Profile
        </Button>
      </div>
    </>
  );
}
