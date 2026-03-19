export interface Team { id: string; name: string; seed: number; region: string; eliminated_round: number | null; playin_partner: string | null; is_playin_pair: boolean }
export interface Participant { id: string; nickname: string; full_name: string; email: string; payment_received: boolean; payment_method: string; entry_pin: string | null }
export interface Game { id: string; round: number; winner_team_id: string; loser_team_id: string; winner_score: number; loser_score: number }
export const ADMIN_KEY = 'madness_admin_authed'
