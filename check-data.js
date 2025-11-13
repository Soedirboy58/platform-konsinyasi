const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://rpzoacwlswlhfqaiicho.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwem9hY3dsc3dsaGZxYWlpY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDcxMjYsImV4cCI6MjA3ODI4MzEyNn0.MVgseixm9988gJZzUJFrzKRGFL69Of6AXBWo4gu5j74'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  console.log('\n=== Checking Suppliers ===')
  const { data: suppliers, error: suppliersError } = await supabase
    .from('profiles')
    .select('id, business_name, email, role, status')
    .eq('role', 'SUPPLIER')
    .limit(10)
  
  if (suppliersError) {
    console.error('Error fetching suppliers:', suppliersError)
  } else {
    console.log(`Found ${suppliers.length} suppliers:`)
    suppliers.forEach(s => {
      console.log(`- ${s.business_name} (${s.email}) - Status: ${s.status}`)
    })
  }

  console.log('\n=== Checking Products ===')
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku, price, stock, status, supplier_id')
    .limit(10)
  
  if (productsError) {
    console.error('Error fetching products:', productsError)
  } else {
    console.log(`Found ${products.length} products:`)
    products.forEach(p => {
      console.log(`- ${p.name} (${p.sku}) - Price: ${p.price}, Stock: ${p.stock}, Status: ${p.status}`)
    })
  }

  console.log('\n=== Checking Admin Users ===')
  const { data: admins, error: adminsError } = await supabase
    .from('profiles')
    .select('id, business_name, email, role, status')
    .eq('role', 'ADMIN')
  
  if (adminsError) {
    console.error('Error fetching admins:', adminsError)
  } else {
    console.log(`Found ${admins.length} admin users:`)
    admins.forEach(a => {
      console.log(`- ${a.business_name || a.email} (${a.email})`)
    })
  }
}

checkData()
