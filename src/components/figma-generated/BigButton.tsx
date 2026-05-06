import React from 'react';
import styles from './BigButton.module.css';

interface BigButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  isLoading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

/**
 * BigButton — Figma design system primary action button.
 * Primary: #142A3F navy background, white text.
 * Secondary: transparent background, navy border.
 * Matches FIGMA_COMPONENT_LIBRARY.md §4 BigButton spec.
 */
export const BigButton: React.FC<BigButtonProps> = ({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
  isLoading = false,
  type = 'button',
  fullWidth = false,
}) => {
  const classNames = [
    styles.button,
    styles[variant],
    fullWidth ? styles.fullWidth : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={classNames}
      aria-busy={isLoading}
      dir="rtl"
    >
      {isLoading ? (
        <span className={styles.loadingDot} aria-hidden="true" />
      ) : null}
      <span>{label}</span>
    </button>
  );
};
