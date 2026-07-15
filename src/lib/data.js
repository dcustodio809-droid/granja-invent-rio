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

export async function deleteItems(ids) {
  const { error } = await supabase.from('items').delete().in('id', ids)
  if (error) throw error
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

export async function deleteMaterials(ids) {
  const { error } = await supabase.from('materials').delete().in('id', ids)
  if (error) throw error
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

export async function deleteMovements(ids) {
  const { error } = await supabase.from('movements').delete().in('id', ids)
  if (error) throw error
}

// Registra uma movimentação de estoque (entrada soma, saída subtrai) e atualiza o saldo do material
export async function registerStockUpdate({ material, type, amount, invoiceNumber, purchaseDate, description, responsible, userId }) {
  const qty = Number(amount)
  if (!qty || qty <= 0) return null
  const newQty = type === 'entrada' ? Number(material.qty) + qty : Math.max(0, Number(material.qty) - qty)
  const movement = await createMovement({
    material_id: material.id,
    type,
    qty,
    invoice_number: type === 'entrada' ? (invoiceNumber || null) : null,
    purchase_date: purchaseDate || null,
    description: description || null,
    responsible: responsible || '',
    created_by: userId || null,
  })
  await updateMaterialQty(material.id, newQty)
  return movement
}
