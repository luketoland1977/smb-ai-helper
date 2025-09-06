import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Send, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
}

const Chat = () => {
  const { agentId } = useParams();
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (agentId) {
      loadAgent();
    }
  }, [agentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadAgent = async () => {
    if (!agentId) return;

    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Agent not found",
        variant: "destructive",
      });
      return;
    }

    setAgent(data);
  };

  const startConversation = async () => {
    if (!agent || !customerName || !customerEmail) return;

    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert([{
          client_id: agent.id, // Note: This should be client_id from agent
          agent_id: agent.id,
          customer_name: customerName,
          customer_email: customerEmail,
          status: 'active'
        }])
        .select()
        .single();

      if (convError) throw convError;

      setConversationId(conversation.id);
      setIsStarted(true);

      // Add welcome message
      const welcomeMessage = {
        id: Date.now().toString(),
        content: `Hello ${customerName}! I'm ${agent.name}. How can I help you today?`,
        role: 'assistant' as const,
        created_at: new Date().toISOString()
      };

      setMessages([welcomeMessage]);

    } catch (error: any) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: newMessage,
      role: 'user',
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setLoading(true);

    try {
      // Save user message to database
      await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: userMessage.content,
          role: userMessage.role
        }]);

      // Call AI agent
      const { data, error } = await supabase.functions.invoke('chat-with-agent', {
        body: {
          message: userMessage.content,
          agent_id: agent?.id,
          conversation_id: conversationId,
          system_prompt: agent?.system_prompt
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: 'assistant',
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message to database
      await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: assistantMessage.content,
          role: assistantMessage.role
        }]);

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStarted) {
        sendMessage();
      } else {
        startConversation();
      }
    }
  };

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card p-4">
        <div className="max-w-4xl mx-auto flex items-center">
          <Bot className="h-8 w-8 text-primary mr-3" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4">
        {!isStarted ? (
          <Card className="max-w-md mx-auto mt-8">
            <CardHeader>
              <CardTitle>Start Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Name</label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name"
                  onKeyPress={handleKeyPress}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Enter your email"
                  onKeyPress={handleKeyPress}
                />
              </div>
              <Button 
                onClick={startConversation}
                className="w-full"
                disabled={!customerName || !customerEmail}
              >
                Start Chat
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col h-[calc(100vh-8rem)]">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex items-start space-x-2',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[70%] rounded-lg px-4 py-2',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-start space-x-2">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="flex items-center space-x-2 mt-4">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Chat;