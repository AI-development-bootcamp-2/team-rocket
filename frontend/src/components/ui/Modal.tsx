import { ReactNode } from 'react';

interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: 'default' | 'narrow';
  className?: string;
}

const SAFE_CSS_CLASS = /[^a-zA-Z0-9_\- ]/g;

export function Modal({ title, subtitle = null, headerExtra = null, icon = 'O', children, onClose, footer, size = 'default', className = '' }: ModalProps) {
  const safeClassName = className.replace(SAFE_CSS_CLASS, '');
  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className={`ui-modal${size === 'narrow' ? ' ui-modal--narrow' : ''}${safeClassName ? ` ${safeClassName}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="ui-modal__close" onClick={onClose} aria-label="סגירה">
          x
        </button>

        <header className="ui-modal__header">

          <div className="ui-modal__header-group">
            {icon && (
              <div className="ui-modal__icon" aria-hidden="true">
                {icon}
              </div>
            )}
            <div className="ui-modal__header-text">
              <h2 className="ui-modal__title">{title}</h2>
              {subtitle && <p className="ui-modal__subtitle">{subtitle}</p>}
            </div>
          </div>
          {headerExtra}
        </header>

        <div className="ui-modal__content">{children}</div>
        {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
