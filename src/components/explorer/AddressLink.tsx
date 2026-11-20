import { Link } from 'react-router-dom';
import { CopyButton } from '@/components/ui/Copy';
import { paths } from '@/lib/paths';
import { cn, shortHash } from '@/lib/utils';

interface AddressLinkProps {
  address: string;
  /** Height of the transaction the visitor comes from: widens the account's history around it. */
  at?: number;
  head?: number;
  tail?: number;
  /** Show the whole address instead of a shortened one. */
  full?: boolean;
  /** Hide the copy button (dense tables). */
  noCopy?: boolean;
  className?: string;
}

/** Validator operator addresses (`…valoper1…`) open the validator page; every other address opens the account page. */
export const addressPath = (address: string, at?: number): string => (address.includes('valoper1') ? paths.validator(address) : paths.account(address, at));

/** An address as a link: monospaced, always left-to-right (also inside right-to-left languages), with a copy button. */
export function AddressLink({ address, at, head = 8, tail = 5, full, noCopy, className }: AddressLinkProps) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1', className)}>
      <Link to={addressPath(address, at)} title={address} className="ltr-isolate truncate font-mono text-[12px] text-cyan hover:underline">
        {full ? address : shortHash(address, head, tail)}
      </Link>
      {noCopy ? null : <CopyButton value={address} />}
    </span>
  );
}
