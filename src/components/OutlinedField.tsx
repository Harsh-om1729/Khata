import { useId } from 'preact/hooks';
import { Icon } from './Icon';

interface Common {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

type Props = Common &
  (
    // inputMode, not type, picks the keypad: Preact types each input type separately, and the keypad is all that differs here.
    | { kind?: 'text'; inputMode?: 'text' | 'tel' | 'numeric'; maxLength?: number; upperCase?: boolean }
    | { kind: 'multiline'; maxLength?: number }
    | { kind: 'select'; options: { value: string; label: string }[]; placeholder: string }
  );

/** Outlined box with a label that floats up once there is text. A mistake is written in words under the box, never shown by colour alone. */
export function OutlinedField(props: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const { label, value, onChange, error } = props;
  const shared = {
    id,
    class: 'ofield__input',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };

  const control = () => {
    switch (props.kind) {
      case 'select':
        return (
          <select {...shared} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
            <option value="">{props.placeholder}</option>
            {props.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case 'multiline':
        return <textarea {...shared} rows={3} placeholder=" " maxLength={props.maxLength} value={value} onInput={(e) => onChange(e.currentTarget.value)} />;
      default: {
        const upper = props.upperCase === true;
        return (
          <input
            {...shared}
            type="text"
            inputMode={props.inputMode}
            autoCapitalize={upper ? 'characters' : undefined}
            placeholder=" "
            maxLength={props.maxLength}
            value={value}
            onInput={(e) => onChange(upper ? e.currentTarget.value.toUpperCase() : e.currentTarget.value)}
          />
        );
      }
    }
  };

  return (
    <div class={['ofield', props.kind === 'select' && 'ofield--select', error && 'ofield--error'].filter(Boolean).join(' ')}>
      {control()}
      <label for={id} class="ofield__label">
        {label}
      </label>
      {error && (
        <p id={errorId} class="ofield__error">
          <Icon name="warning" />
          {error}
        </p>
      )}
    </div>
  );
}
