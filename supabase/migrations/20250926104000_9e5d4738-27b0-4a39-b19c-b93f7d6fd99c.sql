-- Fix webhook URL to point to the Node.js server for proper voice streaming
UPDATE twilio_integrations 
SET webhook_url = 'https://nodejs-server-production.up.railway.app/incoming-call'
WHERE phone_number = '(844) 415-2896';