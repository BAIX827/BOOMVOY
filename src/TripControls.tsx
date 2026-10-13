import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useParams } from 'react-router-dom'
import { useShared } from './collaborationState'
function useAccess() { const { id } = useParams(); const role = useShared((state) => state.sessions[id || '']?.role); const memberId = useShared((state) => state.sessions[id || '']?.memberId); return { role, memberId } }
export function TripButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { 'data-browse'?: boolean; 'data-vote'?: string }) {
  const session = useAccess()
  const readOnly = session?.role === 'viewer' && !props['data-browse'] && props['data-vote'] !== session.memberId
  return <button {...props} disabled={props.disabled || readOnly} />
}
export function TripInput(props: InputHTMLAttributes<HTMLInputElement>) { const session = useAccess(); return <input {...props} disabled={props.disabled || session?.role === 'viewer'} /> }
export function TripSelect(props: SelectHTMLAttributes<HTMLSelectElement>) { const session = useAccess(); return <select {...props} disabled={props.disabled || session?.role === 'viewer'} /> }
export function TripTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { const session = useAccess(); return <textarea {...props} readOnly={props.readOnly || session?.role === 'viewer'} /> }
