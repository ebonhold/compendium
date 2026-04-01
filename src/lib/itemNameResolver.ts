export interface ItemNameResolver {
  resolve(itemId: number): string | undefined;
}

export class StaticItemNameResolver implements ItemNameResolver {
  constructor(private map: Record<number, string>) {}
  resolve(itemId: number): string | undefined {
    return this.map[itemId];
  }
}
