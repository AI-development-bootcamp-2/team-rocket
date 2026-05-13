import { Button } from './Button.jsx';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="ui-state-card" role="status">
      <div className="ui-state-card__icon" aria-hidden="true">
        O
      </div>
      <h2 className="ui-state-card__title">{title}</h2>
      <p className="ui-state-card__description">{description}</p>
      {actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
