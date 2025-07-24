import React from 'react';

export interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export interface ContainerProps extends LayoutProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export interface FlexProps extends LayoutProps {
  direction?: 'row' | 'col';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  gap?: number;
}

const maxWidthStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

const alignStyles = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyStyles = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'lg',
  className = '',
}) => {
  const maxWidthClasses = maxWidthStyles[maxWidth];
  const combinedClassName = `mx-auto px-4 ${maxWidthClasses} ${className}`.trim();

  return <div className={combinedClassName}>{children}</div>;
};

export const Flex: React.FC<FlexProps> = ({
  children,
  direction = 'row',
  align = 'start',
  justify = 'start',
  wrap = false,
  gap = 0,
  className = '',
}) => {
  const directionClass = direction === 'col' ? 'flex-col' : 'flex-row';
  const alignClass = alignStyles[align];
  const justifyClass = justifyStyles[justify];
  const wrapClass = wrap ? 'flex-wrap' : 'flex-nowrap';
  const gapClass = gap > 0 ? `gap-${gap}` : '';

  const combinedClassName =
    `flex ${directionClass} ${alignClass} ${justifyClass} ${wrapClass} ${gapClass} ${className}`.trim();

  return <div className={combinedClassName}>{children}</div>;
};

export const Grid: React.FC<LayoutProps & { cols?: number; gap?: number }> = ({
  children,
  cols = 1,
  gap = 4,
  className = '',
}) => {
  const gridColsClass = `grid-cols-${cols}`;
  const gapClass = `gap-${gap}`;
  const combinedClassName = `grid ${gridColsClass} ${gapClass} ${className}`.trim();

  return <div className={combinedClassName}>{children}</div>;
};

export const Stack: React.FC<LayoutProps & { spacing?: number }> = ({
  children,
  spacing = 4,
  className = '',
}) => {
  const spaceClass = `space-y-${spacing}`;
  const combinedClassName = `${spaceClass} ${className}`.trim();

  return <div className={combinedClassName}>{children}</div>;
};
