import { pictureUrl } from '../../services/pictures';
import { linkLabel, safeLink } from '../../shared/url';
import { isVideoFile, youtubeThumb } from '../../shared/video';
import { shareContent } from '../feed';
import { BillboardSocial } from './BillboardSocial';
import { BILLBOARD_SOCIAL_ENABLED } from './flags';
import type { BillboardPost } from './billboards.types';
import './billboards.css';

const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/**
 * One Billboard post. The layout decides how it looks, so the feed is never a pile of identical boxes. It always carries a
 * BILLBOARD tag, so it is never mistaken for an ad or an event, wherever it appears.
 */
export function BillboardCard({ post }: { post: BillboardPost }) {
  const link = post.linkUrl ? safeLink(post.linkUrl) : null;
  const video = post.videoUrl ? safeLink(post.videoUrl) : null;
  const thumb = video ? youtubeThumb(video) : null;
  const isFile = video ? isVideoFile(video) : false;

  return (
    <article className={`billboard billboard--${post.layout}${post.featured ? ' billboard--featured' : ''}`}>
      <header className="billboard__head">
        <span className="content-tag content-tag--billboard billboard__tag">BILLBOARD</span>
        {post.featured && <span className="billboard__star">Featured</span>}
        <span className="billboard__date">{when.format(new Date(post.publishAt))}</span>
      </header>

      {post.layout === 'image' && post.images[0] && <img className="billboard__hero" src={pictureUrl(post.images[0])} alt="" loading="lazy" decoding="async" />}

      {post.layout === 'gallery' && post.images.length > 0 && (
        <div className="billboard__gallery" role="group" aria-label="Swipe to see more pictures">
          {post.images.map((path) => (
            <img key={path} src={pictureUrl(path)} alt="" loading="lazy" decoding="async" />
          ))}
        </div>
      )}

      {post.layout === 'video' && video && (isFile ? (
        <video className="billboard__hero" src={video} controls preload="metadata" playsInline />
      ) : (
        <a className="billboard__video" href={video} target="_blank" rel="noopener noreferrer" aria-label={`Watch: ${post.title || 'video'}`}>
          {thumb ? <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="billboard__video-fallback">Watch</span>}
          <span className="billboard__play" aria-hidden="true"><span className="billboard__play-icon" /></span>
        </a>
      ))}

      <div className="billboard__body">
        {post.title && <h3>{post.title}</h3>}
        {post.body && <p className={post.layout === 'quote' ? 'billboard__quote' : undefined}>{post.body}</p>}
        {(post.layout === 'link' || (link && post.layout !== 'video')) && link && (
          <a className="billboard__link" href={link} target="_blank" rel="noopener noreferrer">
            <span>{post.linkLabel || 'Open the link'}</span>
            <small>{linkLabel(link)}</small>
          </a>
        )}
      </div>
      {BILLBOARD_SOCIAL_ENABLED && <BillboardSocial postId={post.id} />}
      <footer className="billboard__foot">
        <button type="button" className="link-button" onClick={() => void shareContent(post.title || 'Snacktic Billboard', post.title || post.body.slice(0, 80) || 'Something worth a look on Snacktic')}>
          Share
        </button>
      </footer>
    </article>
  );
}
