import { supabase } from './supabaseClient'

export const CATEGORIES = [
  { value: 'veiculo', label: 'Veículos' },
  { value: 'maquina', label: 'Máquinas' },
  { value: 'equipamento', label: 'Equipamentos' },
  { value: 'ferramenta', label: 'Ferramentas' },
]

export function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
}

// ---------- Itens ----------
export async function listItems() {
  const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getItem(id) {
  const { data, error } = await supabase.from('items').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createItem(item) {
  const { data, error } = await supabase.from('items').insert(item).select().single()
  if (error) throw error
  return data
}

export async function updateItem(id, patch) {
  const { data, error } = await supabase
    .from('items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markMaintenanceDone(item) {
  const days = item.maintenance_interval_days || 90
  const nextDue = new Date()
  nextDue.setDate(nextDue.getDate() + days)
  return updateItem(item.id, {
    last_maintenance: new Date().toISOString().slice(0, 10),
    maintenance_due: nextDue.toISOString().slice(0, 10),
  })
}

// ---------- Materiais ----------
export async function listMaterials() {
  const { data, error } = await supabase.from('materials').select('*').order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createMaterial(material) {
  const { data, error } = await supabase.from('materials').insert(material).select().single()
  if (error) throw error
  return data
}

export async function updateMaterialQty(materialId, newQty) {
  const { data, error } = await supabase
    .from('materials')
    .update({ qty: newQty, updated_at: new Date().toISOString() })
    .eq('id', materialId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- Movimentações ----------
export async function listMovements() {
  const { data, error } = await supabase
    .from('movements')
    .select('*, material:materials(id,name,unit)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createMovement(movement) {
  const { data, error } = await supabase.from('movements').insert(movement).select().single()
  if (error) throw error
  return data
}

// Registra uma atualização de estoque: cria a movimentação e atualiza o saldo do material
export async function registerStockUpdate({ material, newQty, invoiceUrl, photoUrl, responsible, userId }) {
  const delta = newQty - material.qty
  if (delta === 0) return null
  const type = delta > 0 ? 'entrada' : 'saida'
  const movement = await createMovement({
    material_id: material.id,
    type,
    qty: Math.abs(delta),
    invoice_url: invoiceUrl || null,
    photo_url: photoUrl || null,
    responsible: responsible || '',
    created_by: userId || null,
  })
  await updateMaterialQty(material.id, newQty)
  return movement
}

// ---------- Status de manutenção ----------
export function maintenanceStatus(dueDateStr) {
  if (!dueDateStr) return null
  const due = new Date(dueDateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due - today) / 86400000)
  if (diffDays < 0) return { key: 'overdue', label: 'Atrasada' }
  if (diffDays <= 21) return { key: 'soon', label: 'Em breve' }
  return { key: 'ok', label: 'Em dia' }
}
