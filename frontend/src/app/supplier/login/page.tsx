import { redirect } from 'next/navigation'

// Halaman ini dipindah ke /login (unified login untuk supplier & admin)
export default function SupplierLoginRedirect() {
  redirect('/login')
}
