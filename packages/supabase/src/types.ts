export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      assistants: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          system_prompt: string | null
          provider: string
          model: string
          temperature: number
          max_tokens: number | null
          status: string
          created_at: string
          updated_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          system_prompt?: string | null
          provider?: string
          model?: string
          temperature?: number
          max_tokens?: number | null
          status?: string
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          system_prompt?: string | null
          provider?: string
          model?: string
          temperature?: number
          max_tokens?: number | null
          status?: string
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          assistant_id: string
          title: string | null
          created_at: string
          updated_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          assistant_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          assistant_id?: string
          title?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          parent_id: string | null
          role: string
          content: string
          status: string
          created_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          conversation_id: string
          parent_id?: string | null
          role: string
          content: string
          status?: string
          created_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          conversation_id?: string
          parent_id?: string | null
          role?: string
          content?: string
          status?: string
          created_at?: string
          metadata?: Json | null
        }
      }
      usage_metrics: {
        Row: {
          id: string
          conversation_id: string
          message_id: string | null
          model: string
          input_tokens: number
          output_tokens: number
          total_tokens: number
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          message_id?: string | null
          model: string
          input_tokens: number
          output_tokens: number
          total_tokens: number
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          message_id?: string | null
          model?: string
          input_tokens?: number
          output_tokens?: number
          total_tokens?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
