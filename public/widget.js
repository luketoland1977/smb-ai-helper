// AI Service Pro Chat Widget
(function() {
  'use strict';

  // Configuration
  const script = document.currentScript;
  const CLIENT_ID = script.dataset.clientId;
  const AGENT_ID = script.dataset.agentId;
  const CONFIG = JSON.parse(script.dataset.config || '{}');
  
  // Default configuration
  const defaultConfig = {
    primaryColor: '#2563eb',
    welcomeMessage: 'Hello! How can I help you today?',
    position: 'bottom-right',
    size: 'medium',
    apiUrl: window.location.origin
  };
  
  const config = { ...defaultConfig, ...CONFIG };
  
  // Generate unique session ID
  const generateSessionId = () => {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  };
  
  let sessionId = generateSessionId();
  let isOpen = false;
  let messages = [];

  // Create widget styles
  const createStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .ai-chat-widget {
        position: fixed;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .ai-chat-widget.bottom-right {
        bottom: 20px;
        right: 20px;
      }
      
      .ai-chat-widget.bottom-left {
        bottom: 20px;
        left: 20px;
      }
      
      .ai-chat-widget.top-right {
        top: 20px;
        right: 20px;
      }
      
      .ai-chat-widget.top-left {
        top: 20px;
        left: 20px;
      }
      
      .ai-chat-toggle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${config.primaryColor};
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }
      
      .ai-chat-toggle:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
      }
      
      .ai-chat-toggle svg {
        width: 24px;
        height: 24px;
        fill: white;
      }
      
      .ai-chat-window {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 380px;
        height: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      
      .ai-chat-widget.bottom-left .ai-chat-window {
        left: 0;
        right: auto;
      }
      
      .ai-chat-widget.top-right .ai-chat-window,
      .ai-chat-widget.top-left .ai-chat-window {
        top: 80px;
        bottom: auto;
      }
      
      .ai-chat-header {
        background: ${config.primaryColor};
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .ai-chat-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .ai-chat-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.8;
      }
      
      .ai-chat-close:hover {
        opacity: 1;
        background: rgba(255,255,255,0.1);
      }
      
      .ai-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f8fafc;
      }
      
      .ai-chat-message {
        margin-bottom: 12px;
        display: flex;
        flex-direction: column;
      }
      
      .ai-chat-message.user {
        align-items: flex-end;
      }
      
      .ai-chat-message.assistant {
        align-items: flex-start;
      }
      
      .ai-chat-message-content {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .ai-chat-message.user .ai-chat-message-content {
        background: ${config.primaryColor};
        color: white;
        border-bottom-right-radius: 4px;
      }
      
      .ai-chat-message.assistant .ai-chat-message-content {
        background: white;
        color: #374151;
        border-bottom-left-radius: 4px;
        border: 1px solid #e5e7eb;
      }
      
      .ai-chat-input-container {
        padding: 16px;
        border-top: 1px solid #e5e7eb;
        background: white;
      }
      
      .ai-chat-input-form {
        display: flex;
        gap: 8px;
      }
      
      .ai-chat-input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #d1d5db;
        border-radius: 20px;
        outline: none;
        font-size: 14px;
      }
      
      .ai-chat-input:focus {
        border-color: ${config.primaryColor};
      }
      
      .ai-chat-send {
        background: ${config.primaryColor};
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
      }
      
      .ai-chat-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .ai-chat-send svg {
        width: 16px;
        height: 16px;
        fill: white;
      }
      
      .ai-chat-typing {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background: white;
        border-radius: 18px;
        border-bottom-left-radius: 4px;
        max-width: 80%;
        border: 1px solid #e5e7eb;
      }
      
      .ai-chat-typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #9ca3af;
        animation: ai-chat-pulse 1.4s infinite ease-in-out;
      }
      
      .ai-chat-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .ai-chat-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      @keyframes ai-chat-pulse {
        0%, 80%, 100% {
          opacity: 0.3;
        }
        40% {
          opacity: 1;
        }
      }
      
      @media (max-width: 480px) {
        .ai-chat-window {
          width: calc(100vw - 40px);
          height: calc(100vh - 120px);
          position: fixed;
          bottom: 80px;
          left: 20px;
          right: 20px;
        }
        
        .ai-chat-widget.top-right .ai-chat-window,
        .ai-chat-widget.top-left .ai-chat-window {
          top: 80px;
          bottom: 20px;
          height: calc(100vh - 120px);
        }
      }
    `;
    document.head.appendChild(style);
  };

  // Create widget HTML
  const createWidget = () => {
    const container = document.createElement('div');
    container.className = `ai-chat-widget ${config.position}`;
    container.innerHTML = `
      <button class="ai-chat-toggle" aria-label="Open chat">
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </button>
      
      <div class="ai-chat-window">
        <div class="ai-chat-header">
          <h3>Customer Support</h3>
          <button class="ai-chat-close" aria-label="Close chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        <div class="ai-chat-messages" id="ai-chat-messages">
          <div class="ai-chat-message assistant">
            <div class="ai-chat-message-content">
              ${config.welcomeMessage}
            </div>
          </div>
        </div>
        
        <div class="ai-chat-input-container">
          <form class="ai-chat-input-form" id="ai-chat-form">
            <input 
              type="text" 
              class="ai-chat-input" 
              placeholder="Type your message..." 
              id="ai-chat-input"
              autocomplete="off"
            >
            <button type="submit" class="ai-chat-send" id="ai-chat-send">
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    `;
    
    return container;
  };

  // Add message to chat
  const addMessage = (content, role = 'assistant') => {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-chat-message ${role}`;
    messageDiv.innerHTML = `
      <div class="ai-chat-message-content">
        ${content}
      </div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    messages.push({ role, content });
  };

  // Show typing indicator
  const showTyping = () => {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-chat-message assistant';
    typingDiv.id = 'ai-chat-typing';
    typingDiv.innerHTML = `
      <div class="ai-chat-typing">
        <div class="ai-chat-typing-dot"></div>
        <div class="ai-chat-typing-dot"></div>
        <div class="ai-chat-typing-dot"></div>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  // Hide typing indicator
  const hideTyping = () => {
    const typingDiv = document.getElementById('ai-chat-typing');
    if (typingDiv) {
      typingDiv.remove();
    }
  };

  // Send message to backend
  const sendMessage = async (message) => {
    console.log('AI Widget: Sending message:', message);
    const sendButton = document.getElementById('ai-chat-send');
    const input = document.getElementById('ai-chat-input');
    
    if (!sendButton || !input) {
      console.error('AI Widget: Send button or input not found');
      return;
    }
    
    sendButton.disabled = true;
    showTyping();

    try {
      console.log('AI Widget: Making fetch request to:', `${config.apiUrl}/functions/v1/widget-chat`);
      const response = await fetch(`${config.apiUrl}/functions/v1/widget-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          client_id: CLIENT_ID,
          agent_id: AGENT_ID,
          session_id: sessionId
        })
      });

      console.log('AI Widget: Response status:', response.status);
      const data = await response.json();
      console.log('AI Widget: Response data:', data);
      
      hideTyping();
      
      if (data.response) {
        addMessage(data.response, 'assistant');
      } else {
        addMessage('I apologize, but I\'m having trouble responding right now. Please try again.', 'assistant');
      }
      
    } catch (error) {
      console.error('AI Widget: Error sending message:', error);
      hideTyping();
      addMessage('I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.', 'assistant');
    } finally {
      sendButton.disabled = false;
      input.focus();
      console.log('AI Widget: Message sending completed');
    }
  };

  // Initialize widget
  const init = () => {
    if (!CLIENT_ID || !AGENT_ID) {
      console.error('AI Chat Widget: Missing required configuration (clientId or agentId)');
      return;
    }

    createStyles();
    const widget = createWidget();
    document.body.appendChild(widget);

    // Event listeners
    const toggle = widget.querySelector('.ai-chat-toggle');
    const closeBtn = widget.querySelector('.ai-chat-close');
    const chatWindow = widget.querySelector('.ai-chat-window');
    const form = document.getElementById('ai-chat-form');
    const input = document.getElementById('ai-chat-input');

    toggle.addEventListener('click', () => {
      isOpen = !isOpen;
      chatWindow.style.display = isOpen ? 'flex' : 'none';
      if (isOpen) {
        input.focus();
      }
    });

    closeBtn.addEventListener('click', () => {
      isOpen = false;
      chatWindow.style.display = 'none';
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('AI Widget: Form submitted');
      const message = input.value.trim();
      if (message) {
        console.log('AI Widget: Adding user message and sending:', message);
        addMessage(message, 'user');
        input.value = '';
        sendMessage(message);
      } else {
        console.log('AI Widget: Empty message, not sending');
      }
    });

    // Add welcome message to messages array
    messages.push({ role: 'assistant', content: config.welcomeMessage });
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();