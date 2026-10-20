import http from "http";
import express from "express";
import cors from "cors";
import { Server, Socket } from "socket.io";
import { GerenteDeSalas } from "./Salas";

const origemPermitida = process.env.ORIGEM_PERMITIDA || "*";
const porta = Number(process.env.PORT) || 8000;

const app = express();
app.use(cors({ origin: origemPermitida }));

app.get("/", (_req, res) => {
  res.json({ status: "Servidor funcionando" });
});

const servidor = http.createServer(app);

const io = new Server(servidor, {
  cors: { origin: origemPermitida, methods: ["GET", "POST"] },
});

const gerente = new GerenteDeSalas(io);

io.on("connection", (socket: Socket) => {
  socket.on("join", () => {
    gerente.entrar(socket.id);
  });

  socket.on("message", (salaId: string, texto: string) => {
    gerente.repassar("message", salaId, socket.id, texto);
  });

  socket.on("offer", (salaId: string, oferta: unknown) => {
    gerente.repassar("offer", salaId, socket.id, oferta);
  });

  socket.on("answer", (salaId: string, resposta: unknown) => {
    gerente.repassar("answer", salaId, socket.id, resposta);
  });

  socket.on("ice-candidates", (salaId: string, candidato: unknown) => {
    gerente.repassar("ice-candidates", salaId, socket.id, candidato);
  });

  socket.on("leaveRoom", () => {
    gerente.sair(socket.id);
  });

  socket.on("disconnect", () => {
    gerente.desconectar(socket.id);
  });
});

servidor.listen(porta, "0.0.0.0", () => {
  console.log("Servidor ouvindo na porta", porta);
});
