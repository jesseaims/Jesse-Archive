/** Field that records a key combination (e.g. "Ctrl+Shift+Space") as it is pressed. */
export default function ShortcutInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (shortcut: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Backspace', 'Delete'].includes(e.key))
            return;
          if (e.ctrlKey || e.altKey || e.metaKey) {
            e.preventDefault();
            onChange(
              [
                e.ctrlKey && 'Ctrl',
                e.altKey && 'Alt',
                e.shiftKey && 'Shift',
                e.metaKey && 'Super',
                e.code.startsWith('Key') ? e.code.slice(3) : e.code,
              ]
                .filter(Boolean)
                .join('+'),
            );
          }
        }}
      />
    </label>
  );
}
