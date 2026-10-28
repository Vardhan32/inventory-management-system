export default function FormField({ label, htmlFor, error, required, children, className = "" }) {
  return (
    <div className={`form-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
