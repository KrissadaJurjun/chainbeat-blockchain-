import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { Panel } from '@/components/ui/Panel';
import { useFormat } from '@/hooks/useFormat';
import type { OtpPurpose } from '@/services/auth/types';
import { useOtpStore, type InboxMessage } from '@/stores/otpStore';
import { wrapSm } from './styles';

/** Not a real mailbox: `.example` is a reserved top-level domain that can never resolve. */
export const DEMO_SENDER = 'ChainBeat Demo <no-reply@chainbeat.example>';

const SUBJECT: Record<OtpPurpose, string> = {
  register: 'auth.inbox.registerSubject',
  'reset-password': 'auth.inbox.resetSubject',
  'recover-username': 'auth.inbox.recoverSubject',
};
const BODY: Record<OtpPurpose, string> = {
  register: 'auth.inbox.registerBody',
  'reset-password': 'auth.inbox.resetBody',
  'recover-username': 'auth.inbox.recoverBody',
};

function Message({ message }: { message: InboxMessage }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const notice = message.kind === 'no-account';
  return (
    <li className="rounded-xl border border-line bg-card/40 p-3.5 text-[12.5px]">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 text-[11.5px] text-fg-3">
        <dt>{t('auth.inbox.from')}</dt>
        <dd dir="ltr" className="ltr-isolate break-words text-fg-2">
          {DEMO_SENDER}
        </dd>
        <dt>{t('auth.inbox.to')}</dt>
        <dd dir="ltr" className="ltr-isolate break-words text-fg-2">
          {message.to}
        </dd>
        <dd className="col-span-2 tabular-nums">{fmt.time(message.sentAt)}</dd>
      </dl>
      <h3 className="mt-2.5 font-semibold text-fg">{t(notice ? 'auth.inbox.noAccountSubject' : SUBJECT[message.purpose])}</h3>
      <p className="mt-1 leading-relaxed text-fg-2">{t(notice ? 'auth.inbox.noAccountBody' : BODY[message.purpose])}</p>
      {message.code ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-active-line bg-active/40 px-3 py-2">
            <span className="text-[11.5px] text-fg-3">{t('auth.inbox.codeLabel')}</span>
            <span data-testid="inbox-code" dir="ltr" className="font-mono text-[22px] font-bold tabular-nums tracking-[0.28em] text-fg">
              {message.code}
            </span>
            <CopyButton value={message.code} label={t('auth.inbox.copyCode')} className="ms-auto" />
          </div>
          <p className="mt-2 text-[11.5px] text-fg-3">{t('auth.inbox.validFor', { count: message.validForMinutes })}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-fg-3">{t('auth.inbox.neverShare')}</p>
        </>
      ) : null}
    </li>
  );
}

/**
 * The stand-in for an email inbox. This build has no mail server and no SMS gateway, so every message the "send a code"
 * buttons produce is shown here, on the page, and goes nowhere else.
 */
export function DemoInbox() {
  const { t } = useTranslation();
  const messages = useOtpStore((s) => s.inbox);
  const arrivals = useOtpStore((s) => s.arrivals);
  const clear = useOtpStore((s) => s.clearInbox);

  return (
    <Panel id="demo-inbox" tabIndex={-1} aria-labelledby="demo-inbox-title" className="p-4 outline-none sm:p-5">
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="icon-tile size-9">
          <Mail className="size-[18px]" aria-hidden />
        </span>
        <h2 id="demo-inbox-title" className="font-display text-[15px] font-semibold text-fg">
          {t('auth.inbox.title')}
        </h2>
        <DemoBadge />
      </header>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-fg-3">{t('auth.inbox.description')}</p>
      {/* a fresh live region per delivery, so screen readers announce every new message */}
      <p key={arrivals} role="status" className="sr-only">
        {arrivals > 0 ? t('auth.inbox.arrived') : ''}
      </p>
      {messages.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-fg-3">{t('auth.inbox.empty')}</p>
      ) : (
        <>
          <ol className="mt-4 space-y-3" aria-label={t('auth.inbox.title')}>
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </ol>
          <Button variant="ghost" size="sm" className={`mt-3 ${wrapSm}`} onClick={clear}>
            {t('auth.inbox.clear')}
          </Button>
        </>
      )}
    </Panel>
  );
}

/** Scrolls the inbox into view and moves focus to it (used by the "Go to the Demo inbox" button on small screens). */
export function focusDemoInbox(): void {
  const el = document.getElementById('demo-inbox');
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.focus({ preventScroll: true });
}
