export default function DeleteConfirmModal({ confirmDelete, setConfirmDelete, onDelete }) {
  if (!confirmDelete) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={() => setConfirmDelete(null)}
    >
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-foreground mb-2">Delete User</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete <strong>{confirmDelete.name}</strong> ({confirmDelete.email})? This cannot be
          undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onDelete(confirmDelete.id)}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
