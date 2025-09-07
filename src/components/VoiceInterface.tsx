import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';

interface VoiceInterfaceProps {
  agentId?: string;
  onSpeakingChange?: (speaking: boolean) => void;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ agentId, onSpeakingChange }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatRef = useRef<RealtimeChat | null>(null);

  const handleMessage = (event: any) => {
    console.log('Received message:', event);
    
    // Handle different event types
    if (event.type === 'response.audio.delta') {
      setIsSpeaking(true);
      onSpeakingChange?.(true);
    } else if (event.type === 'response.audio.done') {
      setIsSpeaking(false);
      onSpeakingChange?.(false);
    } else if (event.type === 'conversation.item.created') {
      console.log('Item created:', event);
    }
  };

  const startConversation = async () => {
    setIsConnecting(true);
    try {
      chatRef.current = new RealtimeChat(handleMessage);
      await chatRef.current.init(agentId);
      setIsConnected(true);
      
      toast({
        title: "Connected",
        description: "Voice interface is ready - start speaking!",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const endConversation = () => {
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsSpeaking(false);
    onSpeakingChange?.(false);
    
    toast({
      title: "Disconnected",
      description: "Voice conversation ended",
    });
  };

  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-card">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Phone className="w-5 h-5" />
        Real-time Voice Agent
      </div>
      
      <div className="text-sm text-muted-foreground text-center">
        {!isConnected 
          ? "Connect to start a real-time voice conversation" 
          : isSpeaking 
            ? "AI is speaking..." 
            : "Listening - speak naturally"
        }
      </div>

      <div className="flex gap-3">
        {!isConnected ? (
          <Button 
            onClick={startConversation}
            disabled={isConnecting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isConnecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Connecting...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Start Voice Chat
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={endConversation}
            variant="destructive"
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            End Call
          </Button>
        )}
      </div>

      {isConnected && (
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          {isSpeaking ? 'AI Speaking' : 'Ready to listen'}
        </div>
      )}
    </div>
  );
};

export default VoiceInterface;