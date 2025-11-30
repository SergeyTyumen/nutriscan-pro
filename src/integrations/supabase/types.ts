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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          achievement_name: string
          achievement_type: string
          description: string | null
          earned_at: string
          icon: string | null
          id: string
          user_id: string
        }
        Insert: {
          achievement_name: string
          achievement_type: string
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          user_id: string
        }
        Update: {
          achievement_name?: string
          achievement_type?: string
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_database: {
        Row: {
          calories_per_100g: number
          carbs_per_100g: number
          category: string | null
          created_at: string
          fat_per_100g: number
          id: string
          name: string
          protein_per_100g: number
        }
        Insert: {
          calories_per_100g: number
          carbs_per_100g?: number
          category?: string | null
          created_at?: string
          fat_per_100g?: number
          id?: string
          name: string
          protein_per_100g?: number
        }
        Update: {
          calories_per_100g?: number
          carbs_per_100g?: number
          category?: string | null
          created_at?: string
          fat_per_100g?: number
          id?: string
          name?: string
          protein_per_100g?: number
        }
        Relationships: []
      }
      meal_foods: {
        Row: {
          added_via: string | null
          barcode: string | null
          calories: number
          carbs: number
          created_at: string
          fat: number
          food_name: string
          id: string
          meal_id: string
          photo_url: string | null
          protein: number
          quantity: number
          unit: string
        }
        Insert: {
          added_via?: string | null
          barcode?: string | null
          calories: number
          carbs?: number
          created_at?: string
          fat?: number
          food_name: string
          id?: string
          meal_id: string
          photo_url?: string | null
          protein?: number
          quantity: number
          unit: string
        }
        Update: {
          added_via?: string | null
          barcode?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          food_name?: string
          id?: string
          meal_id?: string
          photo_url?: string | null
          protein?: number
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_foods_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          id: string
          meal_date: string
          meal_time: string
          meal_type: string
          notes: string | null
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_date?: string
          meal_time?: string
          meal_type: string
          notes?: string | null
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_date?: string
          meal_time?: string
          meal_type?: string
          notes?: string | null
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          achievement_notifications_enabled: boolean
          breakfast_time: string
          created_at: string
          daily_stats_enabled: boolean
          daily_stats_time: string
          device_platform: string | null
          dinner_time: string
          id: string
          lunch_time: string
          meal_reminders_enabled: boolean
          motivation_notifications_enabled: boolean
          push_enabled: boolean
          push_token: string | null
          snack_time: string | null
          updated_at: string
          user_id: string
          water_reminder_end: string
          water_reminder_frequency: number
          water_reminder_start: string
          water_reminders_enabled: boolean
        }
        Insert: {
          achievement_notifications_enabled?: boolean
          breakfast_time?: string
          created_at?: string
          daily_stats_enabled?: boolean
          daily_stats_time?: string
          device_platform?: string | null
          dinner_time?: string
          id?: string
          lunch_time?: string
          meal_reminders_enabled?: boolean
          motivation_notifications_enabled?: boolean
          push_enabled?: boolean
          push_token?: string | null
          snack_time?: string | null
          updated_at?: string
          user_id: string
          water_reminder_end?: string
          water_reminder_frequency?: number
          water_reminder_start?: string
          water_reminders_enabled?: boolean
        }
        Update: {
          achievement_notifications_enabled?: boolean
          breakfast_time?: string
          created_at?: string
          daily_stats_enabled?: boolean
          daily_stats_time?: string
          device_platform?: string | null
          dinner_time?: string
          id?: string
          lunch_time?: string
          meal_reminders_enabled?: boolean
          motivation_notifications_enabled?: boolean
          push_enabled?: boolean
          push_token?: string | null
          snack_time?: string | null
          updated_at?: string
          user_id?: string
          water_reminder_end?: string
          water_reminder_frequency?: number
          water_reminder_start?: string
          water_reminders_enabled?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          avatar_url: string | null
          created_at: string
          current_weight: number | null
          daily_calorie_goal: number
          daily_carbs_goal: number
          daily_fat_goal: number
          daily_protein_goal: number
          daily_water_goal: number
          display_name: string | null
          gender: string | null
          height: number | null
          id: string
          target_weight: number | null
          updated_at: string
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          current_weight?: number | null
          daily_calorie_goal?: number
          daily_carbs_goal?: number
          daily_fat_goal?: number
          daily_protein_goal?: number
          daily_water_goal?: number
          display_name?: string | null
          gender?: string | null
          height?: number | null
          id: string
          target_weight?: number | null
          updated_at?: string
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          current_weight?: number | null
          daily_calorie_goal?: number
          daily_carbs_goal?: number
          daily_fat_goal?: number
          daily_protein_goal?: number
          daily_water_goal?: number
          display_name?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          target_weight?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      reference_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_default: boolean | null
          name: string
          real_size_cm: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_default?: boolean | null
          name: string
          real_size_cm: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_default?: boolean | null
          name?: string
          real_size_cm?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_recipes: {
        Row: {
          created_at: string
          id: string
          ingredients: Json
          is_favorite: boolean | null
          meal_type: string | null
          photo_url: string | null
          recipe_name: string
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredients: Json
          is_favorite?: boolean | null
          meal_type?: string | null
          photo_url?: string | null
          recipe_name: string
          total_calories: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredients?: Json
          is_favorite?: boolean | null
          meal_type?: string | null
          photo_url?: string | null
          recipe_name?: string
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_recipes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_log: {
        Row: {
          amount_ml: number
          created_at: string
          id: string
          log_date: string
          log_time: string
          user_id: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          id?: string
          log_date?: string
          log_time?: string
          user_id: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          id?: string
          log_date?: string
          log_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
    Enums: {},
  },
} as const
