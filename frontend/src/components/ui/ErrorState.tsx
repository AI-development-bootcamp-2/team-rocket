// @ts-nocheck
import { Button } from './Button';

export function ErrorState({ title, description, actionLabel = 'לנסות שוב', onAction }) {
  return (
    <div className="ui-state-card ui-state-card--error" role="alert">
      <div className="ui-state-card__icon" aria-hidden="true">
        !
      </div>
      <h2 className="ui-state-card__title">{title}</h2>
      <p className="ui-state-card__description">{description}</p>
      <Button variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}


