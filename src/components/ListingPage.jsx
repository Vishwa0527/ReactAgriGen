import { Icon } from './Icon';

/**
 * Reusable listing page shell.
 * Props: title, subtitle, columns[], data[], onAdd, addLabel, onEdit, onDelete, filterSlot, idPrefix
 *   idPrefix — used to generate stable element IDs for QA automation
 *              e.g. "vt" → vt-btn-add, vt-btn-edit-{row.id}, vt-btn-delete-{row.id}
 */
export function ListingPage({ title, subtitle, columns, data, onAdd, addLabel = 'Add New', onEdit, onDelete, filterSlot, idPrefix = 'list' }) {
  const hasActions = !!(onEdit || onDelete);
  return (
    <div className="fade-up">
      <div className="page-title-bar">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {onAdd && (
          <button
            id={`${idPrefix}-btn-add`}
            className="btn btn-primary"
            onClick={onAdd}
          >
            <Icon name="plus" /> {addLabel}
          </button>
        )}
      </div>

      <div className="card">
        {filterSlot && (
          <>
            <div className="card-body">{filterSlot}</div>
            <hr className="divider" />
          </>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" id={`${idPrefix}-table`}>
            <thead>
              <tr>
                {columns.map(c => <th key={c.key}>{c.label}</th>)}
                {hasActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={columns.length + (hasActions ? 1 : 0)}>
                  <div className="empty-state">
                    <Icon name="search" /><p>No records found.</p>
                  </div>
                </td></tr>
              ) : data.map((row) => (
                <tr key={row.id} id={`${idPrefix}-row-${row.id}`}>
                  {columns.map(c => (
                    <td key={c.key}>{c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}</td>
                  ))}
                  {hasActions && (
                    <td>
                      <div className="table-actions">
                        {onEdit && (
                          <button
                            id={`${idPrefix}-btn-edit-${row.id}`}
                            className="btn-icon"
                            title="Edit"
                            onClick={() => onEdit(row)}
                          >
                            <Icon name="edit" style={{ width: 15, height: 15 }} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            id={`${idPrefix}-btn-delete-${row.id}`}
                            className="btn-icon"
                            title="Delete"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => onDelete(row)}
                          >
                            <Icon name="trash" style={{ width: 15, height: 15 }} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
