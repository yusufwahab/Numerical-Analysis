export function MarkdownCell({ children, className = '' }) {
  return (
    <div className={`cell markdown-cell ${className}`}>
      {children}
    </div>
  )
}

export function CodeCell({ index, code }) {
  return (
    <div className="cell code-cell">
      <div className="cell-gutter">In&nbsp;[{index}]:</div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

export function OutputCell({ index, children }) {
  return (
    <div className="cell output-cell">
      <div className="cell-gutter">Out[{index}]:</div>
      <div>{children}</div>
    </div>
  )
}
