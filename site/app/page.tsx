import Link from "next/link";

export default function PaginaInicial() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2.2rem", margin: "0 0 12px" }}>Chat Aleatório</h1>
      <p style={{ color: "#a1a1aa", maxWidth: "420px", margin: "0 0 28px" }}>
        Converse por vídeo e texto com pessoas aleatórias. Toque no botão e
        aguarde o par.
      </p>
      <Link
        href="/meet"
        style={{
          background: "#3b82f6",
          color: "#ffffff",
          padding: "16px 28px",
          borderRadius: "12px",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Começar a conversar
      </Link>
    </main>
  );
}
