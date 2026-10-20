export interface Usuario {
  id: string;
}

export class Fila<T extends Usuario> {
  private itens: T[] = [];

  entrar(item: T): void {
    if (!this.contem(item.id)) {
      this.itens.push(item);
    }
  }

  proximo(): T | undefined {
    return this.itens.shift();
  }

  tamanho(): number {
    return this.itens.length;
  }

  contem(id: string): boolean {
    return this.itens.some((item) => item.id === id);
  }

  remover(id: string): void {
    this.itens = this.itens.filter((item) => item.id !== id);
  }
}
