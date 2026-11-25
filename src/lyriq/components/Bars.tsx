import type { ComponentProps } from 'react';

function Bars({
  className,
  bars = 3,
  ...props
}: ComponentProps<'span'> & { bars?: number }) {
  return (
    <span
      role="status"
      className={['inline-flex items-stretch gap-[5%]', className].filter(Boolean).join(' ')}
      {...props}
    >
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="inline-block h-full rounded-[1px] bg-current"
          style={{
            width: `${100 / bars}%`,
            animation: 'loading-ui-wave-bars var(--duration, 1.2s) ease-in-out infinite',
            animationDelay: `calc(var(--delay, 0.2s) * ${index})`,
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </span>
  );
}

export { Bars };
