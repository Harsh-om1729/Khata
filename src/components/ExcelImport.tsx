import { useEffect, useState } from 'preact/hooks';
import { applyImport } from '../excel/apply';
import { countPlan, planImport, type ImportPlan, type Problem, type RawRow } from '../excel/plan';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import { useAuthor } from '../staff/use-author';
import { Alert } from './Alert';
import { Icon } from './Icon';

type State =
  | { name: 'idle' }
  | { name: 'reading' }
  | { name: 'preview'; rows: RawRow[]; plan: ImportPlan }
  | { name: 'saving' }
  | { name: 'done'; added: number; updated: number };

export function ExcelImport({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { db, loadExcel } = useServices();
  const author = useAuthor();
  const [state, setState] = useState<State>({ name: 'idle' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Start fetching the Excel code now, so it is ready by the time a file is chosen.
    loadExcel().catch(() => {});
  }, []);

  const problemText: Record<Problem, string> = {
    company: t.problemCompany,
    name: t.problemName,
    unit: t.problemUnit,
    price: t.problemPrice,
    repeat: t.problemRepeat,
    tooLong: t.problemTooLong,
  };

  const workbook = async () => {
    try {
      return await loadExcel();
    } catch {
      setError(t.excelLoadFailed);
      return null;
    }
  };

  const template = async () => {
    setError(null);
    (await workbook())?.downloadTemplate();
  };

  const picked = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError(null);
    setState({ name: 'reading' });
    const excel = await workbook();
    if (!excel) return setState({ name: 'idle' });
    try {
      const rows = excel.readProducts(await file.arrayBuffer());
      if (!rows) {
        setError(t.excelWrongFile);
        return setState({ name: 'idle' });
      }
      const plan = planImport(rows, await db.companies.toArray(), await db.items.toArray());
      setState({ name: 'preview', rows, plan });
    } catch {
      setError(t.excelWrongFile);
      setState({ name: 'idle' });
    }
  };

  const save = async (rows: RawRow[]) => {
    setState({ name: 'saving' });
    try {
      const result = await applyImport(db, author, rows);
      setState({ name: 'done', added: result.add, updated: result.update });
    } catch {
      setError(t.saveFailed);
      setState({ name: 'idle' });
    }
  };

  return (
    <section class="catalog excel">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onBack}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h2>{t.excelTitle}</h2>
      {error && <Alert text={error} />}

      {state.name === 'idle' && (
        <>
          <p class="hint">{t.excelHowTo}</p>
          <button type="button" class="btn" onClick={() => void template()}>
            <Icon name="download" />
            {t.downloadTemplate}
          </button>
          <label class="btn btn--primary">
            <Icon name="upload" />
            {t.chooseExcel}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              class="visually-hidden"
              onChange={(e) => void picked(e.currentTarget)}
            />
          </label>
        </>
      )}

      {(state.name === 'reading' || state.name === 'saving') && <p class="hint">{t.excelWorking}</p>}

      {state.name === 'preview' && <Preview plan={state.plan} problemText={problemText} onSave={() => void save(state.rows)} onCancel={() => setState({ name: 'idle' })} />}

      {state.name === 'done' && (
        <>
          <p class="done" role="status">
            <Icon name="check" />
            {t.importDone} {t.previewAdd}: {state.added} · {t.previewUpdate}: {state.updated}
          </p>
          <button type="button" class="btn btn--primary" onClick={onBack}>
            {t.back}
          </button>
        </>
      )}
    </section>
  );
}

interface PreviewProps {
  plan: ImportPlan;
  problemText: Record<Problem, string>;
  onSave: () => void;
  onCancel: () => void;
}

function Preview({ plan, problemText, onSave, onCancel }: PreviewProps) {
  const { t } = useI18n();
  const counts = countPlan(plan);
  const toSave = counts.add + counts.update;
  return (
    <>
      <h3>{t.previewTitle}</h3>
      <ul class="counts" data-testid="import-counts">
        <li>
          <Icon name="plus" /> {t.previewAdd}: <strong data-testid="count-add">{counts.add}</strong>
        </li>
        <li>
          <Icon name="edit" /> {t.previewUpdate}: <strong data-testid="count-update">{counts.update}</strong>
        </li>
        <li>
          <Icon name="check" /> {t.previewSkip}: <strong data-testid="count-skip">{counts.skip}</strong>
        </li>
        <li>
          <Icon name="warning" /> {t.previewErrors}: <strong data-testid="count-errors">{counts.errors}</strong>
        </li>
        {plan.newCompanies.length > 0 && (
          <li>
            <Icon name="plus" /> {t.previewNewCompanies}: <strong>{plan.newCompanies.join(', ')}</strong>
          </li>
        )}
      </ul>
      {plan.errors.length > 0 && (
        <ul class="phone-list" data-testid="import-errors">
          {plan.errors.map((e) => (
            <li key={e.row} class="phone">
              <strong>
                {t.rowLabel} {e.row}
              </strong>
              <span>
                {problemText[e.problem]}
                {e.firstRow !== undefined && ` ${e.firstRow}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {toSave === 0 && <p class="hint">{t.nothingToSave}</p>}
      <div class="row-actions">
        <button type="button" class="btn btn--primary-inline" disabled={toSave === 0} onClick={onSave}>
          <Icon name="check" />
          {t.confirmImport} ({toSave})
        </button>
        <button type="button" class="btn" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </>
  );
}
