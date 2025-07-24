import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../src/components/Input';

describe('Input', () => {
  it('renders input correctly', () => {
    render(<Input placeholder='Enter text' />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label='Email' />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders error message when provided', () => {
    render(<Input error='This field is required' />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders helper text when provided and no error', () => {
    render(<Input helperText='Enter your email address' />);
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
  });

  it('prioritizes error over helper text', () => {
    render(<Input error='This field is required' helperText='Enter your email address' />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.queryByText('Enter your email address')).not.toBeInTheDocument();
  });

  it('applies variant classes correctly', () => {
    render(<Input variant='filled' />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('bg-gray-100');
  });

  it('applies size classes correctly', () => {
    render(<Input size='lg' />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('px-4', 'py-3', 'text-lg');
  });

  it('applies error styles when error is present', () => {
    render(<Input error='Error message' />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-red-500');
  });

  it('handles value changes', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test value' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('handles disabled state', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
