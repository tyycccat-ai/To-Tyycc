import HomeClient from "../components/HomeClient";
import { listPublicMessages } from "../lib/messages";

export const dynamic = "force-dynamic";

async function safePublicMessages() {
  try {
    return await listPublicMessages();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const messages = await safePublicMessages();
  return <HomeClient initialMessages={messages} />;
}
