export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_configurations: {
        Row: {
          agent_id: string
          auto_response_enabled: boolean | null
          chat_settings: Json | null
          created_at: string | null
          id: string
          knowledge_base_enabled: boolean | null
          phone_settings: Json | null
          updated_at: string | null
          voice_settings: Json | null
        }
        Insert: {
          agent_id: string
          auto_response_enabled?: boolean | null
          chat_settings?: Json | null
          created_at?: string | null
          id?: string
          knowledge_base_enabled?: boolean | null
          phone_settings?: Json | null
          updated_at?: string | null
          voice_settings?: Json | null
        }
        Update: {
          agent_id?: string
          auto_response_enabled?: boolean | null
          chat_settings?: Json | null
          created_at?: string | null
          id?: string
          knowledge_base_enabled?: boolean | null
          phone_settings?: Json | null
          updated_at?: string | null
          voice_settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_configurations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          auto_created: boolean | null
          client_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          openai_api_key: string | null
          settings: Json | null
          status: Database["public"]["Enums"]["agent_status"] | null
          system_prompt: string | null
          template_type: string | null
          updated_at: string | null
        }
        Insert: {
          auto_created?: boolean | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          openai_api_key?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["agent_status"] | null
          system_prompt?: string | null
          template_type?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_created?: boolean | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          openai_api_key?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["agent_status"] | null
          system_prompt?: string | null
          template_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bland_integrations: {
        Row: {
          agent_id: string | null
          bland_agent_id: string | null
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          last_call_at: string | null
          phone_number: string
          settings: Json | null
          total_calls: number | null
          updated_at: string
          voice_settings: Json | null
          webhook_url: string | null
        }
        Insert: {
          agent_id?: string | null
          bland_agent_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_call_at?: string | null
          phone_number: string
          settings?: Json | null
          total_calls?: number | null
          updated_at?: string
          voice_settings?: Json | null
          webhook_url?: string | null
        }
        Update: {
          agent_id?: string | null
          bland_agent_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_call_at?: string | null
          phone_number?: string
          settings?: Json | null
          total_calls?: number | null
          updated_at?: string
          voice_settings?: Json | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          agent_id: string | null
          client_id: string | null
          communication_channel: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          id: string
          phone_number: string | null
          session_data: Json | null
          status: string | null
          twilio_session_id: string | null
          updated_at: string | null
          visitor_id: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          communication_channel?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          phone_number?: string | null
          session_data?: Json | null
          status?: string | null
          twilio_session_id?: string | null
          updated_at?: string | null
          visitor_id?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          communication_channel?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          phone_number?: string | null
          session_data?: Json | null
          status?: string | null
          twilio_session_id?: string | null
          updated_at?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_widgets: {
        Row: {
          agent_id: string
          client_id: string
          created_at: string
          embed_code: string
          id: string
          is_active: boolean
          updated_at: string
          widget_config: Json
          widget_name: string
        }
        Insert: {
          agent_id: string
          client_id: string
          created_at?: string
          embed_code: string
          id?: string
          is_active?: boolean
          updated_at?: string
          widget_config?: Json
          widget_name: string
        }
        Update: {
          agent_id?: string
          client_id?: string
          created_at?: string
          embed_code?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          widget_config?: Json
          widget_name?: string
        }
        Relationships: []
      }
      client_users: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string | null
          domain: string | null
          id: string
          name: string
          settings: Json | null
          subdomain: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          name: string
          settings?: Json | null
          subdomain?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          name?: string
          settings?: Json | null
          subdomain?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_id: string | null
          client_id: string | null
          communication_channel: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          id: string
          metadata: Json | null
          phone_number: string | null
          status: Database["public"]["Enums"]["conversation_status"] | null
          twilio_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          communication_channel?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          metadata?: Json | null
          phone_number?: string | null
          status?: Database["public"]["Enums"]["conversation_status"] | null
          twilio_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          communication_channel?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          metadata?: Json | null
          phone_number?: string | null
          status?: Database["public"]["Enums"]["conversation_status"] | null
          twilio_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_data: Json | null
          activity_type: string
          conversation_id: string | null
          created_at: string | null
          crm_activity_id: string | null
          error_message: string | null
          id: string
          integration_id: string | null
          success: boolean | null
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          conversation_id?: string | null
          created_at?: string | null
          crm_activity_id?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          success?: boolean | null
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          conversation_id?: string | null
          created_at?: string | null
          crm_activity_id?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customer_mappings: {
        Row: {
          client_id: string | null
          created_at: string | null
          crm_customer_id: string
          crm_type: Database["public"]["Enums"]["integration_type"]
          customer_data: Json | null
          id: string
          integration_id: string | null
          internal_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          crm_customer_id: string
          crm_type: Database["public"]["Enums"]["integration_type"]
          customer_data?: Json | null
          id?: string
          integration_id?: string | null
          internal_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          crm_customer_id?: string
          crm_type?: Database["public"]["Enums"]["integration_type"]
          customer_data?: Json | null
          id?: string
          integration_id?: string | null
          internal_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_customer_mappings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_customer_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          client_id: string | null
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          oauth_tokens: Json | null
          sync_settings: Json | null
          type: Database["public"]["Enums"]["integration_type"]
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          oauth_tokens?: Json | null
          sync_settings?: Json | null
          type: Database["public"]["Enums"]["integration_type"]
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          oauth_tokens?: Json | null
          sync_settings?: Json | null
          type?: Database["public"]["Enums"]["integration_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_chunks: {
        Row: {
          chunk_index: number
          client_id: string | null
          content: string
          created_at: string | null
          document_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index: number
          client_id?: string | null
          content: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number
          client_id?: string | null
          content?: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_chunks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_documents: {
        Row: {
          client_id: string | null
          content: string | null
          created_at: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          filename: string
          id: string
          processed: boolean | null
          source_type: string | null
          source_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          content?: string | null
          created_at?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          filename: string
          id?: string
          processed?: boolean | null
          source_type?: string | null
          source_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          content?: string | null
          created_at?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          processed?: boolean | null
          source_type?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_requests: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      twilio_integrations: {
        Row: {
          account_sid: string
          agent_id: string | null
          auth_token: string | null
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          phone_number: string
          sms_enabled: boolean
          updated_at: string
          voice_enabled: boolean
          voice_settings: Json | null
          webhook_url: string | null
        }
        Insert: {
          account_sid: string
          agent_id?: string | null
          auth_token?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number: string
          sms_enabled?: boolean
          updated_at?: string
          voice_enabled?: boolean
          voice_settings?: Json | null
          webhook_url?: string | null
        }
        Update: {
          account_sid?: string
          agent_id?: string | null
          auth_token?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number?: string
          sms_enabled?: boolean
          updated_at?: string
          voice_enabled?: boolean
          voice_settings?: Json | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twilio_integrations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twilio_integrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_widgets: {
        Row: {
          agent_id: string
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          voice_settings: Json | null
          widget_code: string | null
          widget_name: string
        }
        Insert: {
          agent_id: string
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          voice_settings?: Json | null
          widget_code?: string | null
          widget_name: string
        }
        Update: {
          agent_id?: string
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          voice_settings?: Json | null
          widget_code?: string | null
          widget_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agent_status: "active" | "inactive" | "training"
      app_role: "admin" | "salesperson" | "support" | "viewer"
      conversation_status: "active" | "resolved" | "escalated"
      integration_type:
        | "crm_hubspot"
        | "crm_salesforce"
        | "email_smtp"
        | "chat_widget"
        | "hubspot"
        | "salesforce"
        | "pipedrive"
        | "zoho"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_status: ["active", "inactive", "training"],
      app_role: ["admin", "salesperson", "support", "viewer"],
      conversation_status: ["active", "resolved", "escalated"],
      integration_type: [
        "crm_hubspot",
        "crm_salesforce",
        "email_smtp",
        "chat_widget",
        "hubspot",
        "salesforce",
        "pipedrive",
        "zoho",
      ],
    },
  },
} as const
