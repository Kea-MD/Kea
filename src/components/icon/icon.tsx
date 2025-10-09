import styles from './icon.module.css';

interface IconProps {
  name: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  weight?: 'light'| 'normal' | 'medium' | 'semibold' | 'bold';
}

export function Icon({ name, className = "", size = 'medium', weight = 'normal' }: IconProps) {
  const sizeClass = styles[size];
  const weightClass = styles[weight];

  return (
    <span className={`material-symbols-outlined ${sizeClass} ${weightClass} ${className}`}>
      {name}
    </span>
  );
}