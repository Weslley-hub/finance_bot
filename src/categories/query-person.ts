import { normalizeText } from './text-normalize';
import { FinanceQueryPerson } from './finance-query';

export type QueryMember = {
  id: string;
  name: string;
};

export type ResolvedQueryMember = {
  userId?: string;
  label: string;
  missing: 'spouse' | 'named' | null;
};

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function resolveQueryMember(input: {
  currentUserId: string;
  person: FinanceQueryPerson;
  memberHint?: string;
  members: QueryMember[];
}): ResolvedQueryMember {
  if (input.person === 'me') {
    return { userId: input.currentUserId, label: 'Você', missing: null };
  }

  if (input.person === 'family') {
    return { userId: undefined, label: 'Vocês', missing: null };
  }

  if (input.person === 'named') {
    const found = findMemberByHint(input.members, input.memberHint);
    if (!found) {
      return {
        userId: undefined,
        label: input.memberHint ?? 'essa pessoa',
        missing: 'named',
      };
    }

    return {
      userId: found.id,
      label: firstName(found.name),
      missing: null,
    };
  }

  const spouse = input.members.find((member) => member.id !== input.currentUserId);
  if (!spouse) {
    return { userId: undefined, label: 'Sua esposa', missing: 'spouse' };
  }

  return {
    userId: spouse.id,
    label: firstName(spouse.name),
    missing: null,
  };
}

export function findMemberByHint(
  members: QueryMember[],
  hint?: string,
): QueryMember | undefined {
  if (!hint) {
    return undefined;
  }

  const needle = normalizeText(hint);
  return members.find((member) => {
    const full = normalizeText(member.name);
    return full === needle || full.split(' ').includes(needle);
  });
}
