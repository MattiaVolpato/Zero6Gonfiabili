export const favorites = {
  set: new Set(), // contiene itemId favoriti dell'utente loggato
  async refresh() {
    try {
      const r = await fetch("/api/favorites", { credentials: "include" });
      if (!r.ok) {
        this.set.clear();
        return;
      }
      const ids = await r.json();
      this.set = new Set(ids.map(Number));
    } catch {
      this.set.clear();
    }
  },
  has(id) {
    return this.set.has(Number(id));
  },
  async add(id) {
    const r = await fetch(`/api/favorites/${id}`, {
      method: "POST",
      credentials: "include",
    });
    if (r.ok || r.status === 204) this.set.add(Number(id));
  },
  async remove(id) {
    const r = await fetch(`/api/favorites/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok || r.status === 204) this.set.delete(Number(id));
  },
};
