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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'ADMIN' | 'SUPPLIER' | 'CUSTOMER'
          phone_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      products: {
        Row: {
          id: string
          supplier_id: string
          name: string
          description: string | null
          price: number
          commission_rate: number
          barcode: string | null
          photo_url: string | null
          status: 'PENDING' | 'APPROVED' | 'REJECTED'
          expiry_duration_days: number
          created_at: string
          updated_at: string
        }
      }
      inventory_levels: {
        Row: {
          product_id: string
          location_id: string
          quantity: number
          stocked_at_timestamp: string
          updated_at: string
        }
      }
      locations: {
        Row: {
          id: string
          name: string
          type: 'OUTLET' | 'WAREHOUSE'
          qr_code: string
          address: string | null
          is_active: boolean
          created_at: string
        }
      }
    }
    Functions: {
      get_products_by_location: {
        Args: { qr_code_input: string }
        Returns: Array<{
          product_id: string
          name: string
          price: number
          quantity: number
          barcode: string | null
          photo_url: string | null
          supplier_name: string
        }>
      }
    }
  }
}
