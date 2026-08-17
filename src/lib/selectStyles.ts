import type { StylesConfig } from 'react-select';

/**
 * Shared theme-aware styles for react-select components in Placify CRM.
 * Seamlessly adapts to Dark Mode (default) and Light Mode using CSS theme variables.
 */
export const sharedSelectStyles: StylesConfig<any, boolean> = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: 'var(--bg-tertiary)',
    borderColor: state.isFocused ? 'var(--color-accent-blue)' : 'var(--border)',
    borderRadius: '16px',
    padding: '2px 8px',
    fontSize: '0.875rem',
    fontWeight: 500,
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 173, 140, 0.2)' : 'none',
    borderWidth: '1px',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: 'var(--color-accent-blue)',
    },
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    zIndex: 100,
    padding: '4px',
  }),
  menuList: (provided) => ({
    ...provided,
    backgroundColor: 'var(--bg-secondary)',
    padding: '4px',
    borderRadius: '12px',
    maxHeight: '260px',
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? 'var(--color-accent-blue)'
      : state.isFocused
        ? 'rgba(0, 173, 140, 0.15)'
        : 'transparent',
    color: state.isSelected ? '#FFFFFF' : 'var(--text-primary)',
    borderRadius: '10px',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    fontSize: '0.875rem',
    fontWeight: state.isSelected ? 600 : 400,
    padding: '10px 14px',
    margin: '2px 0',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    opacity: state.isDisabled ? 0.5 : 1,
    '&:active': {
      backgroundColor: 'var(--color-accent-blue)',
      color: '#FFFFFF',
    },
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'var(--text-primary)',
    fontWeight: 500,
  }),
  multiValue: (provided) => ({
    ...provided,
    backgroundColor: 'var(--color-accent-blue)',
    borderRadius: '8px',
    padding: '2px 6px',
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.75rem',
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    color: '#FFFFFF',
    borderRadius: '4px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      color: '#FFFFFF',
    },
  }),
  input: (provided) => ({
    ...provided,
    color: 'var(--text-primary)',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  }),
  indicatorSeparator: (provided) => ({
    ...provided,
    backgroundColor: 'var(--border)',
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    color: state.isFocused ? 'var(--color-accent-blue)' : 'var(--text-muted)',
    '&:hover': {
      color: 'var(--text-primary)',
    },
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    '&:hover': {
      color: 'var(--color-accent-red)',
    },
  }),
  noOptionsMessage: (provided) => ({
    ...provided,
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    padding: '12px',
  }),
  loadingMessage: (provided) => ({
    ...provided,
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    padding: '12px',
  }),
};
