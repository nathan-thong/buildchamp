import { BrandMark } from './BrandMark';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <BrandMark className="site-footer__mark" />
          <span>BuildChamp</span>
        </div>
        <div className="site-footer__notices">
          <p className="site-footer__notice">
            BuildChamp isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or
            opinions of Riot Games or anyone officially involved in producing or managing Riot Games
            properties. Riot Games, and all associated properties are trademarks or registered
            trademarks of Riot Games, Inc.
          </p>
          <p className="site-footer__notice">
            BuildChamp was created under Riot Games&apos; “Legal Jibber Jabber” policy using assets
            owned by Riot Games. Riot Games does not endorse or sponsor this project.
          </p>
        </div>
      </div>
    </footer>
  );
}
