import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const WebSocketTest = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const connectWebSocket = () => {
    try {
      console.log('Attempting to connect to WebSocket...');
      
      // Test WebSocket connection directly
      const wsUrl = 'wss://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-integration?callSid=test123&from=+1234567890&to=+18447890436';
      
      console.log('WebSocket URL:', wsUrl);
      setConnectionStatus('Connecting...');
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected!');
        setIsConnected(true);
        setConnectionStatus('Connected');
        setMessages(prev => [...prev, 'WebSocket connected successfully!']);
        
        toast({
          title: "Connected",
          description: "WebSocket connection established",
        });

        // Send a test message
        ws.send(JSON.stringify({
          event: 'test',
          message: 'Hello from test client!'
        }));
      };

      ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, `Received: ${JSON.stringify(data, null, 2)}`]);
        } catch (error) {
          setMessages(prev => [...prev, `Received: ${event.data}`]);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('Disconnected');
        setMessages(prev => [...prev, `Connection closed: ${event.code} - ${event.reason}`]);
        
        toast({
          title: "Disconnected",
          description: `WebSocket connection closed: ${event.reason}`,
          variant: "destructive",
        });
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
        setMessages(prev => [...prev, `Error: ${error}`]);
        
        toast({
          title: "Connection Error",
          description: "Failed to connect to WebSocket",
          variant: "destructive",
        });
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('Failed');
      toast({
        title: "Setup Error",
        description: `Failed to create WebSocket: ${error}`,
        variant: "destructive",
      });
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
      setConnectionStatus('Disconnected');
    }
  };

  const sendTestMessage = () => {
    if (wsRef.current && isConnected) {
      const testMessage = {
        event: 'test_message',
        timestamp: new Date().toISOString(),
        data: 'Test message from client'
      };
      
      wsRef.current.send(JSON.stringify(testMessage));
      setMessages(prev => [...prev, `Sent: ${JSON.stringify(testMessage, null, 2)}`]);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>WebSocket Connection Test</CardTitle>
        <p className="text-sm text-muted-foreground">
          Test direct connection to twilio-voice-integration function
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button 
              onClick={connectWebSocket} 
              disabled={isConnected}
              variant="default"
            >
              Connect WebSocket
            </Button>
            <Button 
              onClick={disconnectWebSocket} 
              disabled={!isConnected}
              variant="outline"
            >
              Disconnect
            </Button>
            <Button 
              onClick={sendTestMessage} 
              disabled={!isConnected}
              variant="secondary"
            >
              Send Test Message
            </Button>
          </div>
          <div className={`px-3 py-1 rounded text-sm font-medium ${
            connectionStatus === 'Connected' ? 'bg-green-100 text-green-800' : 
            connectionStatus === 'Connecting...' ? 'bg-yellow-100 text-yellow-800' :
            connectionStatus === 'Error' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            Status: {connectionStatus}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Messages:</h3>
            <Button onClick={clearMessages} variant="ghost" size="sm">
              Clear
            </Button>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-sm">No messages yet...</p>
            ) : (
              messages.map((message, index) => (
                <div key={index} className="mb-2 text-sm font-mono">
                  <span className="text-gray-400">[{new Date().toLocaleTimeString()}]</span>
                  <pre className="whitespace-pre-wrap mt-1">{message}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebSocketTest;