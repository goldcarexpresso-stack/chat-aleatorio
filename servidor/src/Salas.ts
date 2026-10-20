import { Server } from "socket.io";
import { randomUUID } from "crypto";
import { Fila } from "./Fila";

interface Sala {
  usuario1: string;
  usuario2: string;
}

export class GerenteDeSalas {
  private salas = new Map<string, Sala>();
  private fila = new Fila();
  private online = new Set<string>();

  constructor(private io: Server) {}

  entrar(socketId: string): void {
    this.sair(socketId);
    this.online.add(socketId);
    this.fila.entrar({ id: socketId });
    this.parear();
    this.avisarContagem();
  }

  private parear(): void {
    while (this.fila.tamanho() > 1) {
      const a = this.fila.proximo();
      const b = this.fila.proximo();
      if (!a || !b) return;
      const salaId = randomUUID();
      this.salas.set(salaId, { usuario1: a.id, usuario2: b.id });
      this.io.to(a.id).to(b.id).emit("joined", { room: salaId });
      this.io.to(a.id).emit("send-offer");
    }
  }

  private outro(salaId: string, socketId: string): string | undefined {
    const sala = this.salas.get(salaId);
    if (!sala) return undefined;
    if (sala.usuario1 === socketId) return sala.usuario2;
    if (sala.usuario2 === socketId) return sala.usuario1;
    return undefined;
  }

  repassar(evento: string, salaId: string, socketId: string, dados: unknown): void {
    const destino = this.outro(salaId, socketId);
    if (destino) {
      this.io.to(destino).emit(evento, dados);
    }
  }

  sair(socketId: string): void {
    this.fila.remover(socketId);
    for (const [salaId, sala] of Array.from(this.salas.entries())) {
      if (sala.usuario1 === socketId || sala.usuario2 === socketId) {
        this.salas.delete(salaId);
        this.io.to(sala.usuario1).to(sala.usuario2).emit("leaveRoom");
      }
    }
  }

  desconectar(socketId: string): void {
    this.sair(socketId);
    this.online.delete(socketId);
    this.avisarContagem();
  }

  private avisarContagem(): void {
    this.io.emit("user-count", this.online.size);
  }
}
