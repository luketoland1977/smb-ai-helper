-- Create Twilio integration for Demo client
INSERT INTO public.twilio_integrations (
  client_id,
  agent_id,
  account_sid,
  phone_number,
  webhook_url,
  is_active,
  sms_enabled,
  voice_enabled,
  voice_settings
) VALUES (
  '9cd829b7-79a4-47e3-90a9-a428f588d487', -- Demo client ID
  '370ca4a5-336b-4d78-94d0-799722f6b2c8', -- Demo Assistant agent ID
  'demo_account_sid',
  '(844) 415-2896',
  'https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-sms-webhook',
  true,
  true,
  true,
  '{"voice": "alice", "language": "en-US"}'::jsonb
);

-- Add sample knowledge base documents for Demo client
INSERT INTO public.knowledge_base_documents (
  id,
  client_id,
  title,
  filename,
  file_path,
  file_type,
  content,
  source_type,
  processed
) VALUES 
(
  gen_random_uuid(),
  '9cd829b7-79a4-47e3-90a9-a428f588d487',
  'Demo AI Assistant - Frequently Asked Questions',
  'demo-faq.txt',
  'demo/faq.txt',
  'text/plain',
  'Q: What services does Demo AI Assistant provide?
A: Demo AI Assistant provides 24/7 customer support, product information, order assistance, and technical support through voice, chat, and SMS channels.

Q: What are your business hours?
A: Our AI assistant is available 24/7, but human support is available Monday-Friday 9AM-6PM EST.

Q: How can I contact support?
A: You can call us at (844) 415-2896, use our web chat widget, or send us an SMS for immediate assistance.

Q: What products do you offer?
A: We offer AI-powered customer service solutions, voice assistants, chatbots, and CRM integrations for businesses of all sizes.

Q: How do I get started?
A: Simply call our demo line at (844) 415-2896 or visit our website to speak with our AI assistant and learn about our services.',
  'file',
  true
),
(
  gen_random_uuid(),
  '9cd829b7-79a4-47e3-90a9-a428f588d487',
  'Demo AI Assistant - Company Information',
  'demo-company-info.txt',
  'demo/company-info.txt',
  'text/plain',
  'Company: Demo AI Assistant
Phone: (844) 415-2896
Website: demo.aiassistant.com
Email: info@demo.aiassistant.com

About Us:
Demo AI Assistant is a leading provider of AI-powered customer service solutions. We help businesses automate their customer support with intelligent voice and chat assistants that provide personalized, efficient service around the clock.

Our Services:
- Voice AI Assistants
- Web Chat Integration
- SMS Support
- CRM Integration
- Knowledge Base Management
- Multi-channel Support

Why Choose Demo AI Assistant:
- 24/7 availability
- Instant response times
- Scalable solutions
- Easy integration
- Cost-effective automation
- Human-like conversations

Contact us today to see how our AI assistant can transform your customer service experience!',
  'file',
  true
),
(
  gen_random_uuid(),
  '9cd829b7-79a4-47e3-90a9-a428f588d487',
  'Demo AI Assistant - Pricing Plans',
  'demo-pricing.txt',
  'demo/pricing.txt',
  'text/plain',
  'Demo AI Assistant - Pricing Plans

STARTER PLAN - $99/month
- Up to 1,000 conversations/month
- Basic voice assistant
- Web chat widget
- Email support
- Standard response time

PROFESSIONAL PLAN - $299/month
- Up to 5,000 conversations/month
- Advanced voice assistant with custom voices
- Web chat + SMS support
- CRM integration
- Priority support
- Custom knowledge base

ENTERPRISE PLAN - $799/month
- Unlimited conversations
- Full voice customization
- Multi-channel support (voice, chat, SMS)
- Advanced CRM integrations
- Dedicated account manager
- Custom AI training
- White-label options

CUSTOM ENTERPRISE - Contact us
- Fully customized solutions
- On-premise deployment options
- Advanced analytics
- Multiple language support
- Custom integrations

Call (844) 415-2896 to discuss which plan is right for your business!',
  'file',
  true
);

-- Create knowledge base chunks for the documents
DO $$
DECLARE
    doc_id_1 uuid;
    doc_id_2 uuid;
    doc_id_3 uuid;
BEGIN
    -- Get the document IDs we just created
    SELECT id INTO doc_id_1 FROM public.knowledge_base_documents 
    WHERE client_id = '9cd829b7-79a4-47e3-90a9-a428f588d487' AND title = 'Demo AI Assistant - Frequently Asked Questions';
    
    SELECT id INTO doc_id_2 FROM public.knowledge_base_documents 
    WHERE client_id = '9cd829b7-79a4-47e3-90a9-a428f588d487' AND title = 'Demo AI Assistant - Company Information';
    
    SELECT id INTO doc_id_3 FROM public.knowledge_base_documents 
    WHERE client_id = '9cd829b7-79a4-47e3-90a9-a428f588d487' AND title = 'Demo AI Assistant - Pricing Plans';

    -- Create chunks for FAQ document
    INSERT INTO public.knowledge_base_chunks (document_id, client_id, chunk_index, content) VALUES
    (doc_id_1, '9cd829b7-79a4-47e3-90a9-a428f588d487', 0, 'Demo AI Assistant provides 24/7 customer support, product information, order assistance, and technical support through voice, chat, and SMS channels. Business hours for human support are Monday-Friday 9AM-6PM EST.'),
    (doc_id_1, '9cd829b7-79a4-47e3-90a9-a428f588d487', 1, 'Contact support by calling (844) 415-2896, using web chat widget, or sending SMS for immediate assistance. We offer AI-powered customer service solutions, voice assistants, chatbots, and CRM integrations.'),
    (doc_id_1, '9cd829b7-79a4-47e3-90a9-a428f588d487', 2, 'To get started with Demo AI Assistant, call our demo line at (844) 415-2896 or visit our website to speak with our AI assistant and learn about our services.');

    -- Create chunks for company info document
    INSERT INTO public.knowledge_base_chunks (document_id, client_id, chunk_index, content) VALUES
    (doc_id_2, '9cd829b7-79a4-47e3-90a9-a428f588d487', 0, 'Demo AI Assistant is a leading provider of AI-powered customer service solutions. Contact: (844) 415-2896, demo.aiassistant.com, info@demo.aiassistant.com'),
    (doc_id_2, '9cd829b7-79a4-47e3-90a9-a428f588d487', 1, 'Services include Voice AI Assistants, Web Chat Integration, SMS Support, CRM Integration, Knowledge Base Management, and Multi-channel Support with 24/7 availability.'),
    (doc_id_2, '9cd829b7-79a4-47e3-90a9-a428f588d487', 2, 'Benefits: 24/7 availability, instant response times, scalable solutions, easy integration, cost-effective automation, and human-like conversations.');

    -- Create chunks for pricing document
    INSERT INTO public.knowledge_base_chunks (document_id, client_id, chunk_index, content) VALUES
    (doc_id_3, '9cd829b7-79a4-47e3-90a9-a428f588d487', 0, 'STARTER PLAN $99/month: Up to 1,000 conversations, basic voice assistant, web chat widget, email support. PROFESSIONAL PLAN $299/month: Up to 5,000 conversations, advanced voice assistant, web chat + SMS, CRM integration.'),
    (doc_id_3, '9cd829b7-79a4-47e3-90a9-a428f588d487', 1, 'ENTERPRISE PLAN $799/month: Unlimited conversations, full voice customization, multi-channel support, advanced CRM integrations, dedicated account manager, custom AI training.'),
    (doc_id_3, '9cd829b7-79a4-47e3-90a9-a428f588d487', 2, 'CUSTOM ENTERPRISE: Fully customized solutions, on-premise deployment, advanced analytics, multiple languages, custom integrations. Call (844) 415-2896 to discuss plans.');
END $$;