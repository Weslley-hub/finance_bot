import { resolveQueryMember } from './query-person';

const members = [
  { id: 'wes', name: 'Weslley Silva' },
  { id: 'ana', name: 'Ana Costa' },
];

describe('resolveQueryMember', () => {
  it('filtra o próprio gasto', () => {
    expect(
      resolveQueryMember({
        currentUserId: 'wes',
        person: 'me',
        members,
      }),
    ).toEqual({ userId: 'wes', label: 'Você', missing: null });
  });

  it('soma a família inteira', () => {
    expect(
      resolveQueryMember({
        currentUserId: 'wes',
        person: 'family',
        members,
      }),
    ).toEqual({ userId: undefined, label: 'Vocês', missing: null });
  });

  it('pega o outro membro como esposa', () => {
    expect(
      resolveQueryMember({
        currentUserId: 'wes',
        person: 'spouse',
        members,
      }),
    ).toEqual({ userId: 'ana', label: 'Ana', missing: null });
  });

  it('acha pelo primeiro nome', () => {
    expect(
      resolveQueryMember({
        currentUserId: 'wes',
        person: 'named',
        memberHint: 'Ana',
        members,
      }),
    ).toEqual({ userId: 'ana', label: 'Ana', missing: null });
  });

  it('avisa se o outro membro ainda não falou no grupo', () => {
    expect(
      resolveQueryMember({
        currentUserId: 'wes',
        person: 'spouse',
        members: [{ id: 'wes', name: 'Weslley' }],
      }).missing,
    ).toBe('spouse');
  });
});
