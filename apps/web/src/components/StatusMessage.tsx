type StatusMessageProps = {
  children: string;
  tone?: 'error' | 'success';
};

export function StatusMessage({ children, tone = 'error' }: StatusMessageProps) {
  return <div className={`status-message ${tone}`}>{children}</div>;
}
