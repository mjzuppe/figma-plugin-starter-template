import React, { DetailedHTMLProps } from 'react';
interface SelectInput extends DetailedHTMLProps<React.InputHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> {
  id: string;
  options: { value: any; label: string }[];
  defaultValue: any;
  placeholder?: string;
}

const Select = (props: SelectInput) => {
  const { id, options, defaultValue, placeholder, ...rest } = props;
  return (
    <div className="select">
      <select {...rest} defaultValue={defaultValue || null} id={id}>
        {placeholder && (
          <option selected={defaultValue === null || defaultValue === undefined} value={null} disabled>
            {placeholder}
          </option>
        )}
        {options.map((o: { value: any; label: string }, i) => (
          <option key={`type-${i}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export { Select };
