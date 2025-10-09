import { Icon } from './icon/icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  alt?: string;
  iconVariant?: 'filled' | 'outlined';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  icon,
  alt,
  iconVariant = 'filled',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonVariants.compose(variant),
        size === 'sm' && 'text-sm p-2',
        size === 'lg' && 'text-lg p-4',
        icon && 'flex items-center gap-2',
        className
      )}
      {...props}
    >
      {icon && <Icon name={icon} variant={iconVariant} size="sm" />}
      {children}
    </button>
  );
}
