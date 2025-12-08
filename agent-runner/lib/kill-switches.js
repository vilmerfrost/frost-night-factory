// =============================================================================
// KILL SWITCHES - Emergency controls for production
// =============================================================================
import { supabase } from '../supabase-client';
/**
 * Check if a kill switch is enabled
 */
export async function isKillSwitchEnabled(switchId) {
    try {
        const { data, error } = await supabase
            .from('kill_switches')
            .select('enabled')
            .eq('id', switchId)
            .maybeSingle();
        if (error || !data) {
            return false; // Default to disabled if not found
        }
        return data.enabled === true;
    }
    catch (error) {
        console.warn(`⚠️ Failed to check kill switch ${switchId}: ${error.message}`);
        return false; // Default to disabled on error
    }
}
/**
 * Enable a kill switch
 */
export async function enableKillSwitch(switchId, reason) {
    try {
        await supabase.from('kill_switches').upsert({
            id: switchId,
            enabled: true,
            reason: reason || 'Manual activation',
            enabled_at: new Date().toISOString(),
        });
        console.log(`🛑 Kill switch ${switchId} ENABLED: ${reason || 'Manual activation'}`);
    }
    catch (error) {
        console.error(`❌ Failed to enable kill switch ${switchId}: ${error.message}`);
        throw error;
    }
}
/**
 * Disable a kill switch
 */
export async function disableKillSwitch(switchId) {
    try {
        await supabase.from('kill_switches').update({
            enabled: false,
            enabled_at: null,
        }).eq('id', switchId);
        console.log(`✅ Kill switch ${switchId} DISABLED`);
    }
    catch (error) {
        console.error(`❌ Failed to disable kill switch ${switchId}: ${error.message}`);
        throw error;
    }
}
/**
 * Get all kill switches
 */
export async function getAllKillSwitches() {
    try {
        const { data, error } = await supabase
            .from('kill_switches')
            .select('*')
            .order('name');
        if (error) {
            console.warn(`⚠️ Failed to get kill switches: ${error.message}`);
            return [];
        }
        return (data || []).map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            enabled: row.enabled === true,
            reason: row.reason,
            enabledAt: row.enabled_at,
        }));
    }
    catch (error) {
        console.warn(`⚠️ Failed to get kill switches: ${error.message}`);
        return [];
    }
}
// =============================================================================
// KILL SWITCH DEFINITIONS
// =============================================================================
export const KILL_SWITCHES = {
    FORCE_CHEAP_MODELS: 'force_cheap_models',
    DISABLE_HIVE_MIND: 'disable_hive_mind',
    DISABLE_CLAUDE: 'disable_claude',
    DISABLE_GPT4: 'disable_gpt4',
    DISABLE_UX_REVIEWER: 'disable_ux_reviewer',
};
/**
 * Check if we should force cheap models
 */
export async function shouldForceCheapModels() {
    return await isKillSwitchEnabled(KILL_SWITCHES.FORCE_CHEAP_MODELS);
}
/**
 * Check if Hive Mind is disabled
 */
export async function isHiveMindDisabled() {
    return await isKillSwitchEnabled(KILL_SWITCHES.DISABLE_HIVE_MIND);
}
