/** Union-Find determinístico para componentes conectados */
export class UnionFind {
  private parent = new Map<string, string>()
  private rank = new Map<string, number>()

  constructor(ids: string[]) {
    const sorted = [...ids].sort()
    for (const id of sorted) {
      this.parent.set(id, id)
      this.rank.set(id, 0)
    }
  }

  find(id: string): string {
    const p = this.parent.get(id)
    if (!p) throw new Error(`ID desconocido en UnionFind: ${id}`)
    if (p !== id) {
      const root = this.find(p)
      this.parent.set(id, root)
      return root
    }
    return id
  }

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return

    const rankA = this.rank.get(ra) ?? 0

    if (ra < rb) {
      this.parent.set(rb, ra)
    } else if (rb < ra) {
      this.parent.set(ra, rb)
    } else {
      this.parent.set(rb, ra)
      this.rank.set(ra, rankA + 1)
    }
  }

  components(): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    for (const id of this.parent.keys()) {
      const root = this.find(id)
      const list = groups.get(root) ?? []
      list.push(id)
      groups.set(root, list)
    }
    for (const list of groups.values()) list.sort()
    return groups
  }
}
