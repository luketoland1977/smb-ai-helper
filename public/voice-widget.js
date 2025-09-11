(function() {
  'use strict';

  class VoiceWidget {
    constructor(config) {
      this.config = {
        clientId: config.clientId,
        agentId: config.agentId,
        position: config.position || 'bottom-right',
        primaryColor: config.primaryColor || '#2563eb',
        systemPrompt: config.systemPrompt || 'You are a helpful voice assistant.',
        apiUrl: config.apiUrl || 'https://ycvvuepfsebqpwmamqgg.functions.supabase.co/functions/v1',
        ...config
      };
      
      this.isListening = false;
      this.isConnected = false;
      this.sessionId = null;
      this.recognition = null;
      this.synthesis = window.speechSynthesis;
      
      this.init();
    }

    init() {
      this.createWidget();
      this.initSpeechRecognition();
      this.bindEvents();
    }

    createWidget() {
      // Create widget container
      this.widget = document.createElement('div');
      this.widget.className = 'voice-widget';
      this.widget.innerHTML = `
        <style>
          .voice-widget {
            position: fixed;
            ${this.config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
            ${this.config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .voice-widget-button {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: ${this.config.primaryColor};
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            color: white;
          }
          
          .voice-widget-button:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(0,0,0,0.2);
          }
          
          .voice-widget-button.listening {
            background: #ef4444;
            animation: pulse 1.5s infinite;
          }
          
          .voice-widget-button.processing {
            background: #f59e0b;
            animation: spin 1s linear infinite;
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .voice-widget-icon {
            width: 24px;
            height: 24px;
            fill: currentColor;
          }
          
          .voice-widget-status {
            position: absolute;
            bottom: 70px;
            right: 0;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
          }
          
          .voice-widget-status.show {
            opacity: 1;
          }
        </style>
        
        <div class="voice-widget-status" id="voiceStatus">Ready to listen</div>
        <button class="voice-widget-button" id="voiceButton">
          <svg class="voice-widget-icon" viewBox="0 0 24 24">
            <path d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-1 18.93c-3.95-.49-7-3.85-7-7.93 0-.55.45-1 1-1s1 .45 1 1c0 3.31 2.69 6 6 6s6-2.69 6-6c0-.55.45-1 1-1s1 .45 1 1c0 4.08-3.05 7.44-7 7.93V21h-2v-1.07z"/>
          </svg>
        </button>
      `;
      
      document.body.appendChild(this.widget);
      
      this.button = this.widget.querySelector('#voiceButton');
      this.status = this.widget.querySelector('#voiceStatus');
    }

    initSpeechRecognition() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        this.showStatus('Speech recognition not supported', 3000);
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.button.classList.add('listening');
        this.showStatus('Listening...', 0);
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.handleUserSpeech(transcript);
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.stopListening();
        this.showStatus('Recognition error. Try again.', 3000);
      };

      this.recognition.onend = () => {
        this.stopListening();
      };
    }

    bindEvents() {
      this.button.addEventListener('click', () => {
        if (this.isListening) {
          this.stopListening();
        } else {
          this.startListening();
        }
      });
    }

    startListening() {
      if (!this.recognition) return;
      
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        this.showStatus('Could not start listening', 3000);
      }
    }

    stopListening() {
      if (this.recognition && this.isListening) {
        this.recognition.stop();
      }
      
      this.isListening = false;
      this.button.classList.remove('listening');
      this.hideStatus();
    }

    async handleUserSpeech(transcript) {
      console.log('User said:', transcript);
      
      this.button.classList.add('processing');
      this.showStatus('Processing...', 0);

      try {
        const response = await fetch(`${this.config.apiUrl}/voice-widget`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: transcript,
            client_id: this.config.clientId,
            agent_id: this.config.agentId,
            session_id: this.sessionId,
            system_prompt: this.config.systemPrompt
          })
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        
        if (data.session_id) {
          this.sessionId = data.session_id;
        }

        if (data.reply) {
          this.speak(data.reply);
        } else {
          this.showStatus('No response received', 3000);
        }

      } catch (error) {
        console.error('Error processing speech:', error);
        this.showStatus('Error processing request', 3000);
      } finally {
        this.button.classList.remove('processing');
      }
    }

    speak(text) {
      // Cancel any ongoing speech
      this.synthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        this.showStatus('Speaking...', 0);
      };

      utterance.onend = () => {
        this.hideStatus();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        this.showStatus('Speech error', 3000);
      };

      this.synthesis.speak(utterance);
    }

    showStatus(message, duration = 0) {
      this.status.textContent = message;
      this.status.classList.add('show');
      
      if (duration > 0) {
        setTimeout(() => {
          this.hideStatus();
        }, duration);
      }
    }

    hideStatus() {
      this.status.classList.remove('show');
    }
  }

  // Auto-initialize if config is provided
  if (window.voiceWidgetConfig) {
    new VoiceWidget(window.voiceWidgetConfig);
  }

  // Export for manual initialization
  window.VoiceWidget = VoiceWidget;
})();