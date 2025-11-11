/**
 * PHASE 1 TESTING UTILITY
 * Test all Phase 1 RPC functions from frontend
 * Run this in browser console on admin page
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export async function testPhase1Functions() {
  const supabase = createClientComponentClient()
  const results: any = {
    success: [],
    failed: [],
    errors: []
  }

  console.log('🧪 Starting Phase 1 Testing...\n')

  // Test 1: bulk_approve_products
  try {
    const { data, error } = await supabase.rpc('bulk_approve_products', {
      p_product_ids: [],
      p_admin_id: '00000000-0000-0000-0000-000000000000'
    })
    if (error) throw error
    results.success.push('✅ bulk_approve_products')
    console.log('✅ bulk_approve_products: PASSED')
  } catch (err: any) {
    results.failed.push('❌ bulk_approve_products')
    results.errors.push({ func: 'bulk_approve_products', error: err.message })
    console.error('❌ bulk_approve_products:', err.message)
  }

  // Test 2: get_suppliers_paginated
  try {
    const { data, error } = await supabase.rpc('get_suppliers_paginated', {
      p_page: 1,
      p_page_size: 10,
      p_status_filter: null,
      p_search: null
    })
    if (error) throw error
    results.success.push('✅ get_suppliers_paginated')
    console.log('✅ get_suppliers_paginated: PASSED -', data?.length || 0, 'records')
  } catch (err: any) {
    results.failed.push('❌ get_suppliers_paginated')
    results.errors.push({ func: 'get_suppliers_paginated', error: err.message })
    console.error('❌ get_suppliers_paginated:', err.message)
  }

  // Test 3: get_products_paginated
  try {
    const { data, error } = await supabase.rpc('get_products_paginated', {
      p_page: 1,
      p_page_size: 10,
      p_status_filter: null,
      p_supplier_id: null,
      p_search: null
    })
    if (error) throw error
    results.success.push('✅ get_products_paginated')
    console.log('✅ get_products_paginated: PASSED -', data?.length || 0, 'records')
  } catch (err: any) {
    results.failed.push('❌ get_products_paginated')
    results.errors.push({ func: 'get_products_paginated', error: err.message })
    console.error('❌ get_products_paginated:', err.message)
  }

  // Test 4: get_actual_revenue
  try {
    const { data, error } = await supabase.rpc('get_actual_revenue', {
      p_start_date: null,
      p_end_date: null
    })
    if (error) throw error
    results.success.push('✅ get_actual_revenue')
    console.log('✅ get_actual_revenue: PASSED -', data?.[0] || 'No data')
  } catch (err: any) {
    results.failed.push('❌ get_actual_revenue')
    results.errors.push({ func: 'get_actual_revenue', error: err.message })
    console.error('❌ get_actual_revenue:', err.message)
  }

  // Test 5: get_revenue_by_product
  try {
    const { data, error } = await supabase.rpc('get_revenue_by_product', {
      p_start_date: null,
      p_end_date: null,
      p_limit: 10
    })
    if (error) throw error
    results.success.push('✅ get_revenue_by_product')
    console.log('✅ get_revenue_by_product: PASSED -', data?.length || 0, 'products')
  } catch (err: any) {
    results.failed.push('❌ get_revenue_by_product')
    results.errors.push({ func: 'get_revenue_by_product', error: err.message })
    console.error('❌ get_revenue_by_product:', err.message)
  }

  // Test 6: get_pending_approvals_summary
  try {
    const { data, error } = await supabase.rpc('get_pending_approvals_summary')
    if (error) throw error
    results.success.push('✅ get_pending_approvals_summary')
    console.log('✅ get_pending_approvals_summary: PASSED -', data?.[0] || 'No data')
  } catch (err: any) {
    results.failed.push('❌ get_pending_approvals_summary')
    results.errors.push({ func: 'get_pending_approvals_summary', error: err.message })
    console.error('❌ get_pending_approvals_summary:', err.message)
  }

  // Test 7: get_low_stock_alerts
  try {
    const { data, error } = await supabase.rpc('get_low_stock_alerts', {
      p_threshold: 5,
      p_limit: 10
    })
    if (error) throw error
    results.success.push('✅ get_low_stock_alerts')
    console.log('✅ get_low_stock_alerts: PASSED -', data?.length || 0, 'alerts')
  } catch (err: any) {
    results.failed.push('❌ get_low_stock_alerts')
    results.errors.push({ func: 'get_low_stock_alerts', error: err.message })
    console.error('❌ get_low_stock_alerts:', err.message)
  }

  // Test 8: get_commission_summary
  try {
    const { data, error } = await supabase.rpc('get_commission_summary', {
      p_start_date: null,
      p_end_date: null
    })
    if (error) throw error
    results.success.push('✅ get_commission_summary')
    console.log('✅ get_commission_summary: PASSED -', data?.[0] || 'No data')
  } catch (err: any) {
    results.failed.push('❌ get_commission_summary')
    results.errors.push({ func: 'get_commission_summary', error: err.message })
    console.error('❌ get_commission_summary:', err.message)
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 TESTING SUMMARY')
  console.log('='.repeat(50))
  console.log(`✅ Passed: ${results.success.length}`)
  console.log(`❌ Failed: ${results.failed.length}`)
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:')
    results.failed.forEach((f: string) => console.log(`  ${f}`))
    
    console.log('\n🔍 Error Details:')
    results.errors.forEach((e: any) => {
      console.log(`  ${e.func}: ${e.error}`)
    })
  }

  console.log('='.repeat(50))
  
  return results
}

// Export untuk testing
if (typeof window !== 'undefined') {
  (window as any).testPhase1 = testPhase1Functions
}
