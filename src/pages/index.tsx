import BeatForm from "@/components/BeatForm";
import Head from "next/head";
import "@/styles/globals.css";
export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <Head><title>ONYX — Intake</title></Head>
      <div className="max-w-3xl mx-auto">
        <BeatForm/>
        <div className="mt-8 p-4 text-sm opacity-70">
          <p>1) Lier une chaîne: /api/oauth/start?clientId=YOUR_CLIENT_ID</p>
          <p>2) Revenez ici et créez un beat.</p>
        </div>
      </div>
    </div>
  );
}
