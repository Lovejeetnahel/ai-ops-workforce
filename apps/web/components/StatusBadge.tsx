import { AVAILABILITY_LABEL, Availability } from '../lib/product-status';

const CHIP_CLASS: Record<Availability, string> = {
  live: 'chip ok',
  beta: 'chip warn',
  limited: 'chip warn',
  'coming-soon': 'chip muted',
};

/** Renders the one honest badge every public page uses for feature/industry/integration status. */
export function StatusBadge({ status }: { status: Availability }) {
  return <span className={CHIP_CLASS[status]}>{AVAILABILITY_LABEL[status]}</span>;
}
