import PublicClient from "../../components/PublicClient";
import { listPublicMessages } from "../../lib/messages";

export const dynamic = "force-dynamic";

async function safePublicMessages() {
  try {
    return await listPublicMessages();
  } catch {
    return [];
  }
}

export default async function PublicPage() {
  const messages = await safePublicMessages();
  return <PublicClient initialMessages={messages} />;
}
