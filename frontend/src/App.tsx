import { ChatRuntimeProvider } from "@/providers/ChatRuntimeProvider";
import { ChatPage } from "@/components/chat/ChatPage";

function App() {
  return (
    <ChatRuntimeProvider>
      <ChatPage />
    </ChatRuntimeProvider>
  );
}

export default App;
