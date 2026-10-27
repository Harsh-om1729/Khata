import type { DraftBill } from '../bill';
import { useI18n } from '../i18n';
import { BillLine } from './BillLine';
import { Icon } from './Icon';

interface Props {
  bill: DraftBill;
  onBack: () => void;
  onQty: (lineId: string, qtyMilli: number) => void;
  onPrice: (lineId: string, pricePaise: number) => void;
  onRemove: (lineId: string) => void;
  onMakeDefault: (lineId: string) => Promise<void>;
  onPay: () => void;
}

export function BillReview({ bill, onBack, onQty, onPrice, onRemove, onMakeDefault, onPay }: Props) {
  const { t } = useI18n();
  return (
    <section class="catalog">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onBack}>
          <Icon name="plus" />
          {t.addMore}
        </button>
      </header>
      <h2>{t.bill}</h2>
      {bill.lines.length === 0 && <p class="hint">{t.billEmpty}</p>}
      <ul class="bill-lines">
        {bill.lines.map((line) => (
          <BillLine
            key={line.id}
            line={line}
            onQty={(qty) => onQty(line.id, qty)}
            onPrice={(price) => onPrice(line.id, price)}
            onRemove={() => onRemove(line.id)}
            onMakeDefault={() => onMakeDefault(line.id)}
          />
        ))}
      </ul>
      {bill.lines.length > 0 && (
        <button type="button" class="btn btn--primary btn--big" onClick={onPay}>
          <Icon name="cash" />
          {t.takePayment}
        </button>
      )}
    </section>
  );
}
