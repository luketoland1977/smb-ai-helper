import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrmIntegration {
  id: string;
  crm_type: 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho';
  api_key: string;
  api_secret?: string;
  client_id: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// HubSpot API integration
async function syncHubSpotData(integration: CrmIntegration) {
  const baseUrl = 'https://api.hubapi.com';
  const headers = {
    'Authorization': `Bearer ${integration.api_key}`,
    'Content-Type': 'application/json'
  };

  const results = [];

  try {
    // Sync contacts
    const contactsResponse = await fetch(`${baseUrl}/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,company,phone,lifecyclestage`, {
      headers
    });

    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json();
      
      for (const contact of contactsData.results || []) {
        const content = `Contact: ${contact.properties.firstname || ''} ${contact.properties.lastname || ''}
Email: ${contact.properties.email || ''}
Company: ${contact.properties.company || ''}
Phone: ${contact.properties.phone || ''}
Lifecycle Stage: ${contact.properties.lifecyclestage || ''}`;

        // Store as knowledge base document
        const { error } = await supabase
          .from('knowledge_base_documents')
          .insert({
            client_id: integration.client_id,
            title: `Contact: ${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
            filename: `hubspot_contact_${contact.id}.txt`,
            file_path: `crm/hubspot/contacts/${contact.id}`,
            file_type: 'text/plain',
            content,
            source_type: 'crm',
            crm_integration_id: integration.id,
            crm_record_id: contact.id,
            crm_record_type: 'contact',
            processed: true
          });

        if (!error) {
          results.push({ type: 'contact', id: contact.id, status: 'success' });
        } else {
          console.error('Error storing contact:', error);
          results.push({ type: 'contact', id: contact.id, status: 'error', error: error.message });
        }
      }
    }

    // Sync deals
    const dealsResponse = await fetch(`${baseUrl}/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate,pipeline`, {
      headers
    });

    if (dealsResponse.ok) {
      const dealsData = await dealsResponse.json();
      
      for (const deal of dealsData.results || []) {
        const content = `Deal: ${deal.properties.dealname || ''}
Amount: $${deal.properties.amount || '0'}
Stage: ${deal.properties.dealstage || ''}
Close Date: ${deal.properties.closedate || ''}
Pipeline: ${deal.properties.pipeline || ''}`;

        const { error } = await supabase
          .from('knowledge_base_documents')
          .insert({
            client_id: integration.client_id,
            title: `Deal: ${deal.properties.dealname || 'Unnamed Deal'}`,
            filename: `hubspot_deal_${deal.id}.txt`,
            file_path: `crm/hubspot/deals/${deal.id}`,
            file_type: 'text/plain',
            content,
            source_type: 'crm',
            crm_integration_id: integration.id,
            crm_record_id: deal.id,
            crm_record_type: 'deal',
            processed: true
          });

        if (!error) {
          results.push({ type: 'deal', id: deal.id, status: 'success' });
        } else {
          console.error('Error storing deal:', error);
          results.push({ type: 'deal', id: deal.id, status: 'error', error: error.message });
        }
      }
    }

    // Sync tickets
    const ticketsResponse = await fetch(`${baseUrl}/crm/v3/objects/tickets?limit=100&properties=subject,content,hs_ticket_priority,hs_pipeline_stage`, {
      headers
    });

    if (ticketsResponse.ok) {
      const ticketsData = await ticketsResponse.json();
      
      for (const ticket of ticketsData.results || []) {
        const content = `Ticket: ${ticket.properties.subject || ''}
Content: ${ticket.properties.content || ''}
Priority: ${ticket.properties.hs_ticket_priority || ''}
Stage: ${ticket.properties.hs_pipeline_stage || ''}`;

        const { error } = await supabase
          .from('knowledge_base_documents')
          .insert({
            client_id: integration.client_id,
            title: `Ticket: ${ticket.properties.subject || 'Support Ticket'}`,
            filename: `hubspot_ticket_${ticket.id}.txt`,
            file_path: `crm/hubspot/tickets/${ticket.id}`,
            file_type: 'text/plain',
            content,
            source_type: 'crm',
            crm_integration_id: integration.id,
            crm_record_id: ticket.id,
            crm_record_type: 'ticket',
            processed: true
          });

        if (!error) {
          results.push({ type: 'ticket', id: ticket.id, status: 'success' });
        } else {
          console.error('Error storing ticket:', error);
          results.push({ type: 'ticket', id: ticket.id, status: 'error', error: error.message });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('HubSpot sync error:', error);
    throw error;
  }
}

// Placeholder functions for other CRM types
async function syncSalesforceData(integration: CrmIntegration) {
  // TODO: Implement Salesforce integration
  throw new Error('Salesforce integration not yet implemented');
}

async function syncPipedriveData(integration: CrmIntegration) {
  const baseUrl = 'https://api.pipedrive.com/v1';
  const headers = {
    'X-API-TOKEN': integration.api_key,
    'Content-Type': 'application/json'
  };

  const results = [];

  try {
    // Sync persons (contacts)
    const personsResponse = await fetch(`${baseUrl}/persons?limit=100`, {
      headers
    });

    if (personsResponse.ok) {
      const personsData = await personsResponse.json();
      
      for (const person of personsData.data || []) {
        const content = `Person: ${person.name || ''}
Email: ${person.primary_email || ''}
Phone: ${person.phone?.[0]?.value || ''}
Organization: ${person.org_name || ''}
Owner: ${person.owner_name || ''}
Active: ${person.active_flag ? 'Yes' : 'No'}
First Contact: ${person.first_char || ''}
Last Contact: ${person.last_char || ''}`;

        // Store as knowledge base document
        const { error } = await supabase
          .from('knowledge_base_documents')
          .insert({
            client_id: integration.client_id,
            title: `Person: ${person.name || 'Unnamed Person'}`,
            filename: `pipedrive_person_${person.id}.txt`,
            file_path: `crm/pipedrive/persons/${person.id}`,
            file_type: 'text/plain',
            content,
            source_type: 'crm',
            crm_integration_id: integration.id,
            crm_record_id: String(person.id),
            crm_record_type: 'person',
            processed: true
          });

        if (!error) {
          results.push({ type: 'person', id: person.id, status: 'success' });
        } else {
          console.error('Error storing person:', error);
          results.push({ type: 'person', id: person.id, status: 'error', error: error.message });
        }
      }
    }

    // Sync deals
    const dealsResponse = await fetch(`${baseUrl}/deals?limit=100`, {
      headers
    });

    if (dealsResponse.ok) {
      const dealsData = await dealsResponse.json();
      
      for (const deal of dealsData.data || []) {
        const content = `Deal: ${deal.title || ''}
Value: ${deal.formatted_value || deal.value || ''}
Currency: ${deal.currency || ''}
Stage: ${deal.stage_name || ''}
Status: ${deal.status || ''}
Person: ${deal.person_name || ''}
Organization: ${deal.org_name || ''}
Owner: ${deal.owner_name || ''}
Expected Close Date: ${deal.expected_close_date || ''}
Won Time: ${deal.won_time || ''}
Lost Time: ${deal.lost_time || ''}
Pipeline: ${deal.pipeline_name || ''}`;

        const { error } = await supabase
          .from('knowledge_base_documents')
          .insert({
            client_id: integration.client_id,
            title: `Deal: ${deal.title || 'Unnamed Deal'}`,
            filename: `pipedrive_deal_${deal.id}.txt`,
            file_path: `crm/pipedrive/deals/${deal.id}`,
            file_type: 'text/plain',
            content,
            source_type: 'crm',
            crm_integration_id: integration.id,
            crm_record_id: String(deal.id),
            crm_record_type: 'deal',
            processed: true
          });

        if (!error) {
          results.push({ type: 'deal', id: deal.id, status: 'success' });
        } else {
          console.error('Error storing deal:', error);
          results.push({ type: 'deal', id: deal.id, status: 'error', error: error.message });
        }
      }
    }

    // Sync organizations
    const organizationsResponse = await fetch(`${baseUrl}/organizations?limit=100`, {
      headers
    });

    if (organizationsResponse.ok) {
      const organizationsData = await organizationsResponse.json();
      
      for (const org of organizationsData.data || []) {
        const content = `Organization: ${org.name || ''}
Address: ${org.address || ''}
Owner: ${org.owner_name || ''}
People Count: ${org.people_count || 0}
Activities Count: ${org.activities_count || 0}
Done Activities Count: ${org.done_activities_count || 0}
Undone Activities Count: ${org.undone_activities_count || 0}
Open Deals Count: ${org.open_deals_count || 0}
Closed Deals Count: ${org.closed_deals_count || 0}
Won Deals Count: ${org.won_deals_count || 0}
Lost Deals Count: ${org.lost_deals_count || 0}`;

        const { error } = await supabase
          .from('knowledge_base_documents')
          .insert({
            client_id: integration.client_id,
            title: `Organization: ${org.name || 'Unnamed Organization'}`,
            filename: `pipedrive_organization_${org.id}.txt`,
            file_path: `crm/pipedrive/organizations/${org.id}`,
            file_type: 'text/plain',
            content,
            source_type: 'crm',
            crm_integration_id: integration.id,
            crm_record_id: String(org.id),
            crm_record_type: 'organization',
            processed: true
          });

        if (!error) {
          results.push({ type: 'organization', id: org.id, status: 'success' });
        } else {
          console.error('Error storing organization:', error);
          results.push({ type: 'organization', id: org.id, status: 'error', error: error.message });
        }
      }
    }

    // Sync activities
    const activitiesResponse = await fetch(`${baseUrl}/activities?limit=100`, {
      headers
    });

    if (activitiesResponse.ok) {
      const activitiesData = await activitiesResponse.json();
      
      for (const activity of activitiesData.data || []) {
        const content = `Activity: ${activity.subject || ''}
Type: ${activity.type || ''}
Note: ${activity.note || ''}
Due Date: ${activity.due_date || ''}
Due Time: ${activity.due_time || ''}
Duration: ${activity.duration || ''}
Person: ${activity.person_name || ''}
Organization: ${activity.org_name || ''}
Deal: ${activity.deal_title || ''}
Owner: ${activity.owner_name || ''}
Done: ${activity.done ? 'Yes' : 'No'}
Location: ${activity.location || ''}`;

        const { error } = await supabase
          .from('knowledge_base_documents')
          .insert({
            client_id: integration.client_id,
            title: `Activity: ${activity.subject || 'Activity'}`,
            filename: `pipedrive_activity_${activity.id}.txt`,
            file_path: `crm/pipedrive/activities/${activity.id}`,
            file_type: 'text/plain',
            content,
            source_type: 'crm',
            crm_integration_id: integration.id,
            crm_record_id: String(activity.id),
            crm_record_type: 'activity',
            processed: true
          });

        if (!error) {
          results.push({ type: 'activity', id: activity.id, status: 'success' });
        } else {
          console.error('Error storing activity:', error);
          results.push({ type: 'activity', id: activity.id, status: 'error', error: error.message });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Pipedrive sync error:', error);
    throw error;
  }
}

async function syncZohoData(integration: CrmIntegration) {
  // TODO: Implement Zoho integration
  throw new Error('Zoho integration not yet implemented');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integration_id, client_id } = await req.json();

    if (!integration_id || !client_id) {
      return new Response(
        JSON.stringify({ error: 'Missing integration_id or client_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get integration details
    const { data: integration, error: integrationError } = await supabase
      .from('crm_integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('client_id', client_id)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update sync status to in progress
    await supabase
      .from('crm_integrations')
      .update({ 
        sync_status: 'syncing',
        sync_error: null 
      })
      .eq('id', integration_id);

    let results;
    
    // Sync data based on CRM type
    try {
      switch (integration.crm_type) {
        case 'hubspot':
          results = await syncHubSpotData(integration);
          break;
        case 'salesforce':
          results = await syncSalesforceData(integration);
          break;
        case 'pipedrive':
          results = await syncPipedriveData(integration);
          break;
        case 'zoho':
          results = await syncZohoData(integration);
          break;
        default:
          throw new Error(`Unsupported CRM type: ${integration.crm_type}`);
      }

      // Update sync status to success
      await supabase
        .from('crm_integrations')
        .update({ 
          sync_status: 'success',
          last_sync_at: new Date().toISOString(),
          sync_error: null 
        })
        .eq('id', integration_id);

      console.log(`CRM sync completed successfully for integration ${integration_id}:`, results);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'CRM data synced successfully',
          results 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (syncError) {
      console.error('CRM sync error:', syncError);
      
      // Update sync status to error
      await supabase
        .from('crm_integrations')
        .update({ 
          sync_status: 'error',
          sync_error: syncError instanceof Error ? syncError.message : 'Unknown error' 
        })
        .eq('id', integration_id);

      throw syncError;
    }

  } catch (error: any) {
    console.error('Error in sync-crm-data function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);