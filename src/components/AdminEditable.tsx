import React from 'react';
import { Pencil } from 'lucide-react';

interface AdminEditableProps {
  adminMode: boolean;
  label: string;
  onEdit: () => void;
  className?: string;
  inline?: boolean;
  children: React.ReactNode;
}

export function AdminEditable({
  adminMode,
  label,
  onEdit,
  className = '',
  inline = false,
  children,
}: AdminEditableProps) {
  if (!adminMode) {
    return inline ? <span className={className}>{children}</span> : <div className={className}>{children}</div>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit();
  };

  if (inline) {
    return (
      <span
        className={`admin-edit-zone inline-flex items-center ${className}`}
        onClick={handleClick}
        title={`Click to edit ${label}`}
      >
        <button
          type="button"
          className="admin-edit-tag"
          onClick={handleClick}
          aria-label={`Edit ${label}`}
        >
          <Pencil className="w-3 h-3" />
          {label}
        </button>
        {children}
      </span>
    );
  }

  return (
    <div
      className={`admin-edit-zone ${className}`}
      onClick={handleClick}
      title={`Click to edit ${label}`}
    >
      <button
        type="button"
        className="admin-edit-tag"
        onClick={handleClick}
        aria-label={`Edit ${label}`}
      >
        <Pencil className="w-3 h-3" />
        Edit {label}
      </button>
      {children}
    </div>
  );
}
