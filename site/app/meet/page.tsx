"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const configuracao: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};
const usuarioTurn = process.env.NEXT_PUBLIC_TURN_USUARIO;
const senhaTurn = process.env.NEXT_PUBLIC_TURN_SENHA;

const configuracaoComTurn: RTCConfiguration = {
  iceServers: [
    ...(configuracao.iceServers ?? []),
    ...(usuarioTurn && senhaTurn
      ? [
          {
            urls: "turn:global.relay.metered.ca:80",
            username: usuarioTurn,
            credential: senhaTurn,
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: usuarioTurn,
            credential: senhaTurn,
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: usuarioTurn,
            credential: senhaTurn,
          },
          {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: usuarioTurn,
            credential: senhaTurn,
          },
        ]
      : []),
  ],
};
interface Mensagem {
  de: "eu" | "outro";
  texto: string;
}

export default function TelaDeVideo() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [online, setOnline] = useState(0);
  const [status, setStatus] = useState("Ligando a câmera...");
  const [ciclo, setCiclo] = useState(0);
  const [cameraPronta, setCameraPronta] = useState(false);

  const videoLocal = useRef<HTMLVideoElement>(null);
  const videoRemoto = useRef<HTMLVideoElement>(null);
  const streamLocal = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const salaRef = useRef("");

  useEffect(() => {
    let cancelado = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: true })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamLocal.current = stream;
        if (videoLocal.current) videoLocal.current.srcObject = stream;
        setCameraPronta(true);
      })
      .catch(() => {
        setStatus(
          "Não foi possível acessar a câmera e o microfone. Permita o acesso e recarregue a página."
        );
      });
    return () => {
      cancelado = true;
      streamLocal.current?.getTracks().forEach((t) => t.stop());
      streamLocal.current = null;
    };
  }, []);

  useEffect(() => {
    if (!cameraPronta || !streamLocal.current) return;
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!url) {
      setStatus("Endereço do servidor não configurado.");
      return;
    }

    const stream = streamLocal.current;
    const socket = io(url);
    socketRef.current = socket;
    const pc = new RTCPeerConnection(configuracaoComTurn);
    const pendentes: RTCIceCandidateInit[] = [];
    let remotoDefinido = false;

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (videoRemoto.current) videoRemoto.current.srcObject = e.streams[0];
      setStatus("Conectado");
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && salaRef.current) {
        socket.emit("ice-candidates", salaRef.current, e.candidate);
      }
    };

    const aplicarPendentes = async () => {
      remotoDefinido = true;
      while (pendentes.length > 0) {
        const c = pendentes.shift();
        if (c) {
          try {
            await pc.addIceCandidate(c);
          } catch {}
        }
      }
    };

    socket.on("connect", () => {
      setStatus("Procurando alguém...");
      socket.emit("join");
    });

    socket.on("joined", ({ room }: { room: string }) => {
      salaRef.current = room;
      setStatus("Par encontrado, conectando...");
    });

    socket.on("send-offer", async () => {
      try {
        const oferta = await pc.createOffer();
        await pc.setLocalDescription(oferta);
        socket.emit("offer", salaRef.current, oferta);
      } catch {}
    });

    socket.on("offer", async (oferta: RTCSessionDescriptionInit) => {
      try {
        await pc.setRemoteDescription(oferta);
        await aplicarPendentes();
        const resposta = await pc.createAnswer();
        await pc.setLocalDescription(resposta);
        socket.emit("answer", salaRef.current, resposta);
      } catch {}
    });

    socket.on("answer", async (resposta: RTCSessionDescriptionInit) => {
      try {
        await pc.setRemoteDescription(resposta);
        await aplicarPendentes();
      } catch {}
    });

    socket.on("ice-candidates", async (candidato: RTCIceCandidateInit) => {
      if (remotoDefinido) {
        try {
          await pc.addIceCandidate(candidato);
        } catch {}
      } else {
        pendentes.push(candidato);
      }
    });

    socket.on("message", (t: string) => {
      setMensagens((anteriores) => [...anteriores, { de: "outro", texto: t }]);
    });

    socket.on("user-count", (n: number) => setOnline(n));

    socket.on("leaveRoom", () => setCiclo((c) => c + 1));

    return () => {
      salaRef.current = "";
      socket.removeAllListeners();
      socket.disconnect();
      pc.close();
      if (videoRemoto.current) videoRemoto.current.srcObject = null;
      setMensagens([]);
    };
  }, [cameraPronta, ciclo]);

  const enviar = () => {
    const t = texto.trim();
    if (!t || !salaRef.current) return;
    socketRef.current?.emit("message", salaRef.current, t);
    setMensagens((anteriores) => [...anteriores, { de: "eu", texto: t }]);
    setTexto("");
  };

  const caixaDeVideo = {
    background: "#334155",
    borderRadius: "16px",
    overflow: "hidden",
    height: "38vh",
  } as const;

  const estiloVideo = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  } as const;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "12px",
        gap: "10px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Chat Aleatório</strong>
        <span style={{ color: "#a1a1aa" }}>Online: {online}</span>
      </div>

      <div style={caixaDeVideo}>
        <video ref={videoRemoto} autoPlay playsInline style={estiloVideo} />
      </div>

      <div style={caixaDeVideo}>
        <video ref={videoLocal} autoPlay playsInline muted style={estiloVideo} />
      </div>

      <div style={{ color: "#a1a1aa", textAlign: "center" }}>{status}</div>

      <div
        style={{
          flexGrow: 1,
          minHeight: "80px",
          maxHeight: "22vh",
          overflowY: "auto",
          background: "#27272a",
          borderRadius: "16px",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {mensagens.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.de === "eu" ? "flex-end" : "flex-start",
              background: m.de === "eu" ? "#3b82f6" : "#e5e7eb",
              color: m.de === "eu" ? "#ffffff" : "#000000",
              padding: "8px 12px",
              borderRadius: "14px",
              maxWidth: "80%",
              wordBreak: "break-word",
            }}
          >
            {m.texto}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => setCiclo((c) => c + 1)}
          style={{
            background: "#22c55e",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 16px",
            fontWeight: 700,
          }}
        >
          PULAR
        </button>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviar();
          }}
          placeholder="Digite sua mensagem..."
          style={{
            flexGrow: 1,
            minWidth: 0,
            background: "#3f3f46",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "12px",
          }}
        />
        <button
          onClick={enviar}
          style={{
            background: "#3b82f6",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 16px",
            fontWeight: 700,
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
