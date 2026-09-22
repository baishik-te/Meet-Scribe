import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ConnectionVM } from '../../types/viewModels';
import { resolvePartner } from '../resolvePartner';

// Original (unfixed) resolution as it shipped in Meetings.tsx — the preservation baseline.
function resolvePartnerOriginal(c: ConnectionVM) {
  return c.requester!.id === c.receiverId ? c.receiver! : c.requester!;
}

type Perspective = 'requester' | 'receiver';

interface RawConn {
  currentUserId: string;
  peerId: string;
  currentName: string;
  currentEmail: string;
  peerName: string;
  peerEmail: string;
  connId: string;
}

const rawConnArb: fc.Arbitrary<RawConn> = fc
  .record({
    currentUserId: fc.uuid(),
    peerId: fc.uuid(),
    currentName: fc.string({ minLength: 1 }),
    currentEmail: fc.emailAddress(),
    peerName: fc.string({ minLength: 1 }),
    peerEmail: fc.emailAddress(),
    connId: fc.uuid(),
  })
  .filter((r) => r.currentUserId !== r.peerId);

function build(r: RawConn, perspective: Perspective, withContact: boolean): ConnectionVM {
  const me = { id: r.currentUserId, name: r.currentName, email: r.currentEmail };
  const peer = { id: r.peerId, name: r.peerName, email: r.peerEmail };
  const requester = perspective === 'requester' ? me : peer;
  const receiver = perspective === 'requester' ? peer : me;
  return {
    id: r.connId,
    status: 'ACCEPTED',
    myRole: perspective === 'requester' ? 'SENDER' : 'RECEIVER',
    contact: withContact ? peer : (undefined as unknown as ConnectionVM['contact']),
    requester,
    receiver,
    receiverId: receiver.id,
  };
}

describe('resolvePartner — Fix Checking (Property 1)', () => {
  it('never returns the current user and always returns the counterpart', () => {
    fc.assert(
      fc.property(
        rawConnArb,
        fc.constantFrom<Perspective>('requester', 'receiver'),
        fc.boolean(),
        (r, perspective, withContact) => {
          const conn = build(r, perspective, withContact);
          const partner = resolvePartner(conn, r.currentUserId);
          expect(partner.id).not.toBe(r.currentUserId);
          expect(partner.id).toBe(r.peerId);
        },
      ),
    );
  });
});

describe('resolvePartner — Preservation (Property 2)', () => {
  it('receiver-side resolution matches the original behavior', () => {
    fc.assert(
      fc.property(rawConnArb, (r) => {
        // Receiver perspective: original returns c.requester (the counterpart).
        const conn = build(r, 'receiver', true);
        const original = resolvePartnerOriginal(conn);
        const fixed = resolvePartner(conn, r.currentUserId);
        expect(fixed.id).toBe(original.id);
        expect(fixed.id).toBe(r.peerId);
      }),
    );
  });

  it('fallback (no contact) still yields the counterpart from both perspectives', () => {
    fc.assert(
      fc.property(rawConnArb, fc.constantFrom<Perspective>('requester', 'receiver'), (r, perspective) => {
        const conn = build(r, perspective, false);
        const partner = resolvePartner(conn, r.currentUserId);
        expect(partner.id).toBe(r.peerId);
      }),
    );
  });
});
