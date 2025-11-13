// ============================================
// SCRIPT: Create Custom Admin Account
// Email: delta.sc58@gmail.com
// Password: 123456
// ============================================

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../frontend/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createAdminAccount() {
  console.log('🔧 Creating admin account for delta.sc58@gmail.com...\n')

  try {
    // Step 1: Check if user already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'delta.sc58@gmail.com')
    
    if (existingUsers && existingUsers.length > 0) {
      console.log('✅ User already exists in profiles table')
      console.log('📝 User ID:', existingUsers[0].id)
      console.log('📧 Email:', existingUsers[0].email)
      console.log('👤 Role:', existingUsers[0].role)
      
      // Update role to ADMIN if not already
      if (existingUsers[0].role !== 'ADMIN') {
        console.log('\n🔄 Updating role to ADMIN...')
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            role: 'ADMIN',
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUsers[0].id)
        
        if (updateError) {
          console.error('❌ Error updating role:', updateError.message)
        } else {
          console.log('✅ Role updated to ADMIN successfully!')
        }
      } else {
        console.log('✅ User already has ADMIN role')
      }
      
      console.log('\n🎉 Admin account is ready!')
      console.log('\n📋 Login credentials:')
      console.log('   Email: delta.sc58@gmail.com')
      console.log('   Password: 123456')
      console.log('   URL: http://localhost:3000/admin/login')
      
      return
    }

    // Step 2: Check if user exists in auth.users
    console.log('🔍 Checking if user exists in Supabase Auth...')
    
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error checking auth users:', authError.message)
      console.log('\n⚠️  Manual action required:')
      console.log('1. Go to Supabase Dashboard → Authentication → Users')
      console.log('2. Click "Add user"')
      console.log('3. Fill in:')
      console.log('   - Email: delta.sc58@gmail.com')
      console.log('   - Password: 123456')
      console.log('   - Auto Confirm User: ✓ (checked)')
      console.log('4. Click "Create user"')
      console.log('5. Run this script again')
      return
    }

    const authUser = authData.users.find(u => u.email === 'delta.sc58@gmail.com')
    
    if (!authUser) {
      console.log('⚠️  User not found in auth.users')
      console.log('\n📝 Creating new user in Supabase Auth...')
      
      // Try to create user via Auth API
      const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
        email: 'delta.sc58@gmail.com',
        password: '123456',
        email_confirm: true,
        user_metadata: {
          full_name: 'Delta Admin'
        }
      })

      if (signUpError) {
        console.error('❌ Error creating user:', signUpError.message)
        console.log('\n⚠️  Please create user manually via Supabase Dashboard')
        return
      }

      console.log('✅ User created in auth.users')
      console.log('📝 User ID:', newUser.user.id)

      // Step 3: Create profile with ADMIN role
      console.log('\n📝 Creating profile with ADMIN role...')
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          email: 'delta.sc58@gmail.com',
          full_name: 'Delta Admin',
          role: 'ADMIN',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        console.error('❌ Error creating profile:', profileError.message)
        return
      }

      console.log('✅ Profile created successfully!')
    } else {
      console.log('✅ User found in auth.users')
      console.log('📝 User ID:', authUser.id)
      
      // Create profile entry
      console.log('\n📝 Creating profile with ADMIN role...')
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email: 'delta.sc58@gmail.com',
          full_name: 'Delta Admin',
          role: 'ADMIN',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (profileError && profileError.code !== '23505') { // Ignore duplicate key error
        console.error('❌ Error creating profile:', profileError.message)
        return
      }

      console.log('✅ Profile created successfully!')
    }

    console.log('\n🎉 Admin account created successfully!')
    console.log('\n📋 Login credentials:')
    console.log('   Email: delta.sc58@gmail.com')
    console.log('   Password: 123456')
    console.log('   URL: http://localhost:3000/admin/login')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    console.log('\n⚠️  Manual steps required:')
    console.log('1. Login to Supabase Dashboard')
    console.log('2. Go to SQL Editor')
    console.log('3. Run this query:')
    console.log(`
UPDATE profiles
SET role = 'ADMIN', is_active = true, updated_at = NOW()
WHERE email = 'delta.sc58@gmail.com';
    `)
  }
}

// Run the script
createAdminAccount()
  .then(() => {
    console.log('\n✅ Script completed')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Script failed:', err)
    process.exit(1)
  })
