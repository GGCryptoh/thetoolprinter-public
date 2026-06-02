import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { checkAuth } from '@/lib/auth/admin';
import { AdminLoginForm } from './_components/admin-login-form';

export default async function AdminLoginPage() {
  await connection();

  if (await checkAuth()) {
    redirect('/admin/dashboard');
  }

  return <AdminLoginForm />;
}
