const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8')
const envLines = envContent.split('\n')
const env = {}
envLines.forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkColumns() {
  console.log('Checking suppliers table columns...\n')
  
  // Get one supplier
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  if (data && data.length > 0) {
    console.log('Available columns:')
    Object.keys(data[0]).forEach(col => console.log(`  - ${col}`))
    console.log('\nSample data:', JSON.stringify(data[0], null, 2))
  } else {
    console.log('No suppliers found')
  }
}

checkColumns()
