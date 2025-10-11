import { Icon } from '../icon/icon';
import styles from './button.module.css';

interface ButtonProps {
  icon?: string;
  text?: string;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function Button({
  icon,
  text,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = '',
  onClick
}: ButtonProps) {

  const buttonClasses = [
    styles.button,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClasses}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon && <Icon name={icon} size={size} className={styles.icon} />}
      {text && <span className={styles.text}>{text}</span>}
    </button>
  );
}