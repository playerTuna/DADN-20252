type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

export function Toggle({ checked, onChange, disabled = false, loading = false, label }: ToggleProps) {
  const dimmed = disabled || loading;

  return (
    <label className={label ? 'toggle-row' : 'toggle-only'}>
      {label ? <span className="toggle-label">{label}</span> : null}
      <button
        type="button"
        className={`toggle ${checked ? 'is-on' : ''}`}
        aria-pressed={checked}
        aria-label={label ?? 'Công tắc'}
        disabled={dimmed}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
      {loading ? <span className="mini-spinner" aria-label="Đang cập nhật" /> : null}
    </label>
  );
}
