import type { Metadata } from "next";
import { MessagesManager } from "@/components/admin/messages-manager";

export const metadata: Metadata = { title: "Messages" };

export default function AdminMessagesPage() {
  return <MessagesManager />;
}
