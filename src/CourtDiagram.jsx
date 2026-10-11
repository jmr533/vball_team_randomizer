import { getPlayerName, getPlayersPerCourt } from './gameHelpers';

export const MODE_NAMES = {
  '2v2': 'Doubles',
  '3v3': 'Triples',
  '4v4': 'Quads'
};

export function BallMark({ className = '' }) {
  return (
    <svg className={`ball-mark ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10.4" fill="var(--sun)" stroke="var(--ball-line)" strokeWidth="1.8" />
      <path
        d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4M12 12a12.6 12.6 0 0 1-8.7 5M16.8 13.6a16.55 16.55 0 0 1-9 7.5M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5"
        fill="none"
        stroke="var(--ball-line)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CourtSide({ side, players, slots, dealOffset }) {
  return (
    <div className={`court-side court-side-${side}`}>
      <span className="side-tag" aria-hidden="true">{side.toUpperCase()}</span>
      <span className="sr-only">Team {side.toUpperCase()}</span>
      <ul className="side-names">
        {players
          ? players.map((player, index) => (
            <li key={player.id} style={{ '--deal': dealOffset + index }}>{getPlayerName(player)}</li>
          ))
          : Array.from({ length: slots }, (_, index) => (
            <li key={index} className="slot-empty" aria-hidden="true" />
          ))}
      </ul>
    </div>
  );
}

/**
 * Top-down sand court. Pass `court` for a live matchup, or only `mode` +
 * `number` for an empty preview of an upcoming court.
 */
export function Court({ court, mode, number }) {
  const gameMode = court ? court.gameMode || '2v2' : mode;
  const courtNumber = court ? court.court : number;
  const teamSize = getPlayersPerCourt(gameMode) / 2;
  const isPreview = !court;

  return (
    <article
      className={`court ${isPreview ? 'court-preview' : 'court-live'}`}
      style={{ '--court': courtNumber - 1 }}
      aria-label={isPreview
        ? `Court ${courtNumber} ${gameMode}, waiting for players`
        : `Court ${courtNumber} ${gameMode} matchup`}
    >
      <header className="court-head">
        <span className="court-no">{courtNumber}</span>
        <span className="court-fmt">{MODE_NAMES[gameMode]} <span>{gameMode}</span></span>
      </header>
      <div className="court-sand">
        <CourtSide side="a" players={court?.team1} slots={teamSize} dealOffset={0} />
        <div className="court-net" role="separator" aria-label="net" />
        <CourtSide side="b" players={court?.team2} slots={teamSize} dealOffset={teamSize} />
      </div>
    </article>
  );
}
