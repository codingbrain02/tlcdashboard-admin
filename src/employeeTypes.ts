export type EmployeeProfile = {
  id: string; full_name: string; email: string | null; position: string | null; phone_number: string | null
  is_active: boolean; created_at: string; revision: number; terminated_at: string | null
  termination_reason: string | null; termination_details: string | null
  employment_start_date: string | null; auth_sync_pending: boolean
}
export type EmployeeShift = { id: string; clock_in: string; clock_out: string | null; end_reason: 'clock_out' | 'terminated' }
export const employeeColumns = 'id,full_name,email,position,phone_number,is_active,created_at,revision,terminated_at,termination_reason,termination_details,employment_start_date,auth_sync_pending'

export async function serviceMessage(result: { data: { message?: string } | null; error: unknown }, fallback: string) {
  if (result.data?.message) return result.data.message
  const error = result.error as { context?: Response } | null
  try { return (await error?.context?.clone().json())?.message || fallback } catch { return fallback }
}
