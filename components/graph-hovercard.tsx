'use client';
// One hover card, shared by the editor graph and the read-only shared map. The
// parent owns the hover state — this file only decides what a target reads like and
// keeps the card inside the canvas it belongs to.
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Connection, Entity } from '@/lib/intelligence';
export type HoverTarget =
  | {
      kind: 'entity';
      x: number;
      y: number;
      entity: Entity;
      degree: number;
      notes: number;
    }
  | {
      kind: 'connection';
      x: number;
      y: number;
      connection: Connection;
      from?: Entity;
      to?: Entity;
    }
  | {
      kind: 'group';
      x: number;
      y: number;
      label: string;
      dimension: string;
      count: number;
      members: string[];
      primary: boolean;
    };
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
function EntityBody({
  entity,
  degree,
  notes,
}: {
  entity: Entity;
  degree: number;
  notes: number;
}) {
  const profile = entity.profile;
  const facts = (
    [
      ['Connections', degree + (degree === 1 ? ' link' : ' links')],
      ['Notes', String(notes)],
      ...(profile
        ? ([
            ['Business area', profile.vertical],
            ['Headquarters', profile.hq],
            ['Stage', profile.stage],
            ['Customer', profile.targetCustomer],
          ] as [string, string][])
        : []),
    ] as [string, string][]
  ).filter(([, value]) => Boolean(value));
  return (
    <>
      <header>
        <i style={{ background: entity.color }} />
        <strong>{entity.name}</strong>
        <span className="hovercard-kind">{entity.kind}</span>
      </header>
      {entity.description && <p>{entity.description}</p>}
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <footer>
        <span>{entity.followed ? 'Following' : 'Not followed'}</span>
        {hostOf(entity.source) && <span>{hostOf(entity.source)}</span>}
      </footer>
    </>
  );
}
function ConnectionBody({
  connection,
  from,
  to,
}: {
  connection: Connection;
  from?: Entity;
  to?: Entity;
}) {
  return (
    <>
      <header>
        <span
          className={
            'hovercard-status' +
            (connection.status === 'Hypothesis' ? ' is-hypothesis' : '')
          }
        >
          {connection.status}
        </span>
        <span className="hovercard-date">{connection.date}</span>
      </header>
      <p className="hovercard-relation">
        <strong>{from?.name ?? connection.from}</strong>
        <em>{connection.label}</em>
        <strong>{to?.name ?? connection.to}</strong>
      </p>
      <p className="hovercard-evidence">{connection.evidence}</p>
      <footer>
        <span>Evidence</span>
        {hostOf(connection.url) && <span>{hostOf(connection.url)}</span>}
      </footer>
    </>
  );
}
function GroupBody({
  label,
  dimension,
  count,
  members,
  primary,
}: {
  label: string;
  dimension: string;
  count: number;
  members: string[];
  primary: boolean;
}) {
  return (
    <>
      <header>
        <strong>{label}</strong>
        <span className="hovercard-kind">{dimension}</span>
      </header>
      <p>
        {count === 1 ? '1 entity shares' : count + ' entities share'} this
        value.{' '}
        {primary
          ? 'This grouping placed them on the board.'
          : 'Lines run to the piles it overlaps with.'}
      </p>
      <p className="hovercard-members">
        {members.slice(0, 8).join(', ')}
        {members.length > 8 ? ' and ' + (members.length - 8) + ' more' : ''}
      </p>
      <footer>
        <span>Grouping</span>
        <span>Click to list them</span>
      </footer>
    </>
  );
}
export function GraphHoverCard({ target }: { target: HoverTarget | null }) {
  const card = useRef<HTMLDivElement>(null);
  // Measured after the card renders: its own box, and the canvas it must stay inside.
  const [size, setSize] = useState({
    width: 300,
    height: 180,
    limitWidth: 0,
    limitHeight: 0,
  });
  useLayoutEffect(() => {
    if (!card.current || !target) return;
    const box = card.current.getBoundingClientRect(),
      parent = card.current.parentElement,
      next = {
        width: box.width,
        height: box.height,
        limitWidth: parent?.clientWidth ?? 0,
        limitHeight: parent?.clientHeight ?? 0,
      };
    setSize((current) =>
      Math.abs(current.width - next.width) < 1 &&
      Math.abs(current.height - next.height) < 1 &&
      current.limitWidth === next.limitWidth &&
      current.limitHeight === next.limitHeight
        ? current
        : next,
    );
  }, [target]);
  if (!target) return null;
  // The card follows the cursor but never leaves the canvas: it flips to the other
  // side once it would overflow rather than being clipped at the edge.
  const gap = 16,
    flipX =
      size.limitWidth > 0 && target.x + gap + size.width > size.limitWidth,
    flipY =
      size.limitHeight > 0 && target.y + gap + size.height > size.limitHeight,
    left = Math.max(8, flipX ? target.x - gap - size.width : target.x + gap),
    top = Math.max(8, flipY ? target.y - gap - size.height : target.y + gap);
  return (
    <div
      ref={card}
      className="graph-hovercard"
      role="tooltip"
      style={{ left, top } as CSSProperties}
    >
      {target.kind === 'entity' ? (
        <EntityBody
          entity={target.entity}
          degree={target.degree}
          notes={target.notes}
        />
      ) : target.kind === 'group' ? (
        <GroupBody
          label={target.label}
          dimension={target.dimension}
          count={target.count}
          members={target.members}
          primary={target.primary}
        />
      ) : (
        <ConnectionBody
          connection={target.connection}
          from={target.from}
          to={target.to}
        />
      )}
    </div>
  );
}
