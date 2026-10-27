import { Icon } from './Icon';

export function Alert({ text }: { text: string }) {
  return (
    <p class="alert" role="alert">
      <Icon name="warning" />
      {text}
    </p>
  );
}
