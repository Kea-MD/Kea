import Link from "next/link";

export default function Home() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Welcome to TyprMD</h1>
      <p>The better way to write Markdown</p>
      <div style={{ marginTop: "2rem" }}>
        <Link
          href="/editor"
          style={{
            padding: "1rem 2rem",
            backgroundColor: "#0070f3",
            color: "white",
            textDecoration: "none",
            borderRadius: "0.5rem",
            marginRight: "1rem"
          }}
        >
          Open Editor
        </Link>
        <Link
          href="/home"
          style={{
            padding: "1rem 2rem",
            backgroundColor: "#f5f5f5",
            color: "#333",
            textDecoration: "none",
            borderRadius: "0.5rem"
          }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}
