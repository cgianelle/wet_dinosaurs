import type { Classroom, Cell } from '../model/types'

export function DistanceLine({ classroom, line }: { classroom: Classroom; line: { from: string; to: string; label: string } }) {
  const from = classroom.desks.find((d) => d.id === line.from)?.cell
  const to = classroom.desks.find((d) => d.id === line.to)?.cell
  if (!from || !to) return null
  const { columns, rows } = classroom.grid
  const centre = (cell: Cell) => ({ x: ((cell.column + 0.5) / columns) * 100, y: ((cell.row + 0.5) / rows) * 100 })
  const a = centre(from)
  const b = centre(to)
  return (
    <div className="distance-line" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="distance-label" style={{ left: `${(a.x + b.x) / 2}%`, top: `${(a.y + b.y) / 2}%` }}>
        {line.label}
      </span>
    </div>
  )
}
