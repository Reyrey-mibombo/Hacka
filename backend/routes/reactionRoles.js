const express = require('express');
const db = require('../database/connection');
const { verifyDiscordToken } = require('./auth');

const router = express.Router({ mergeParams: true });

// Get all reaction role panels
router.get('/reaction-roles', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        
        const panels = db.prepare(`
            SELECT 
                id,
                name,
                description,
                channel_id as channelId,
                message_id as messageId,
                color,
                max_roles as maxRoles,
                unique_roles as uniqueRoles,
                allow_remove as allowRemove,
                created_at as createdAt
            FROM reaction_role_panels
            WHERE guild_id = ?
            ORDER BY created_at DESC
        `).all(guildId);

        // Get roles for each panel
        const panelsWithRoles = panels.map(panel => {
            const roles = db.prepare(`
                SELECT 
                    id,
                    emoji,
                    role_id as roleId,
                    description
                FROM reaction_roles
                WHERE panel_id = ?
            `).all(panel.id);

            return {
                ...panel,
                roles
            };
        });

        res.json({ panels: panelsWithRoles });
    } catch (error) {
        console.error('[ReactionRoles] Get panels error:', error);
        res.status(500).json({ error: 'Failed to fetch reaction role panels' });
    }
});

// Get single panel
router.get('/reaction-roles/:panelId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, panelId } = req.params;
        
        const panel = db.prepare(`
            SELECT 
                id,
                name,
                description,
                channel_id as channelId,
                message_id as messageId,
                color,
                max_roles as maxRoles,
                unique_roles as uniqueRoles,
                allow_remove as allowRemove,
                created_at as createdAt
            FROM reaction_role_panels
            WHERE id = ? AND guild_id = ?
        `).get(panelId, guildId);

        if (!panel) {
            return res.status(404).json({ error: 'Panel not found' });
        }

        const roles = db.prepare(`
            SELECT 
                id,
                emoji,
                role_id as roleId,
                description
            FROM reaction_roles
            WHERE panel_id = ?
        `).all(panelId);

        res.json({ ...panel, roles });
    } catch (error) {
        console.error('[ReactionRoles] Get panel error:', error);
        res.status(500).json({ error: 'Failed to fetch reaction role panel' });
    }
});

// Create reaction role panel
router.post('/reaction-roles', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            name,
            description,
            channelId,
            color,
            maxRoles,
            uniqueRoles,
            allowRemove,
            roles
        } = req.body;

        if (!name || !channelId) {
            return res.status(400).json({ error: 'Name and channelId are required' });
        }

        // Create panel
        const panelStmt = db.prepare(`
            INSERT INTO reaction_role_panels 
            (guild_id, name, description, channel_id, color, max_roles, unique_roles, allow_remove)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const panelResult = panelStmt.run(
            guildId,
            name,
            description || '',
            channelId,
            color || '#6c63ff',
            maxRoles || 0,
            uniqueRoles ? 1 : 0,
            allowRemove !== false ? 1 : 0
        );

        const panelId = panelResult.lastInsertRowid;

        // Add roles
        if (roles && roles.length > 0) {
            const roleStmt = db.prepare(`
                INSERT INTO reaction_roles (guild_id, panel_id, emoji, role_id, description)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const role of roles) {
                if (role.emoji && role.roleId) {
                    roleStmt.run(guildId, panelId, role.emoji, role.roleId, role.description || '');
                }
            }
        }

        logActivity(guildId, req.discordUser?.id, 'reaction_panel_created', { panelId, name });

        res.json({ 
            success: true, 
            message: 'Reaction role panel created',
            panelId
        });
    } catch (error) {
        console.error('[ReactionRoles] Create panel error:', error);
        res.status(500).json({ error: 'Failed to create reaction role panel' });
    }
});

// Update reaction role panel
router.patch('/reaction-roles/:panelId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, panelId } = req.params;
        const {
            name,
            description,
            channelId,
            color,
            maxRoles,
            uniqueRoles,
            allowRemove,
            roles
        } = req.body;

        // Update panel
        const panelStmt = db.prepare(`
            UPDATE reaction_role_panels SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                channel_id = COALESCE(?, channel_id),
                color = COALESCE(?, color),
                max_roles = COALESCE(?, max_roles),
                unique_roles = COALESCE(?, unique_roles),
                allow_remove = COALESCE(?, allow_remove),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND guild_id = ?
        `);

        panelStmt.run(
            name,
            description,
            channelId,
            color,
            maxRoles,
            uniqueRoles !== undefined ? (uniqueRoles ? 1 : 0) : undefined,
            allowRemove !== undefined ? (allowRemove ? 1 : 0) : undefined,
            panelId,
            guildId
        );

        // Update roles if provided
        if (roles) {
            // Delete existing roles
            db.prepare('DELETE FROM reaction_roles WHERE panel_id = ?').run(panelId);

            // Insert new roles
            const roleStmt = db.prepare(`
                INSERT INTO reaction_roles (guild_id, panel_id, emoji, role_id, description)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const role of roles) {
                if (role.emoji && role.roleId) {
                    roleStmt.run(guildId, panelId, role.emoji, role.roleId, role.description || '');
                }
            }
        }

        logActivity(guildId, req.discordUser?.id, 'reaction_panel_updated', { panelId });

        res.json({ success: true, message: 'Reaction role panel updated' });
    } catch (error) {
        console.error('[ReactionRoles] Update panel error:', error);
        res.status(500).json({ error: 'Failed to update reaction role panel' });
    }
});

// Delete reaction role panel
router.delete('/reaction-roles/:panelId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, panelId } = req.params;

        db.prepare('DELETE FROM reaction_role_panels WHERE id = ? AND guild_id = ?').run(panelId, guildId);

        logActivity(guildId, req.discordUser?.id, 'reaction_panel_deleted', { panelId });

        res.json({ success: true, message: 'Reaction role panel deleted' });
    } catch (error) {
        console.error('[ReactionRoles] Delete panel error:', error);
        res.status(500).json({ error: 'Failed to delete reaction role panel' });
    }
});

// Add role to panel
router.post('/reaction-roles/:panelId/roles', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, panelId } = req.params;
        const { emoji, roleId, description } = req.body;

        if (!emoji || !roleId) {
            return res.status(400).json({ error: 'Emoji and roleId are required' });
        }

        const stmt = db.prepare(`
            INSERT INTO reaction_roles (guild_id, panel_id, emoji, role_id, description)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(guildId, panelId, emoji, roleId, description || '');

        logActivity(guildId, req.discordUser?.id, 'reaction_role_added', { panelId, roleId, emoji });

        res.json({ 
            success: true, 
            message: 'Role added to panel',
            roleId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('[ReactionRoles] Add role error:', error);
        res.status(500).json({ error: 'Failed to add role to panel' });
    }
});

// Remove role from panel
router.delete('/reaction-roles/:panelId/roles/:roleEntryId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, panelId, roleEntryId } = req.params;

        db.prepare('DELETE FROM reaction_roles WHERE id = ? AND panel_id = ? AND guild_id = ?')
            .run(roleEntryId, panelId, guildId);

        logActivity(guildId, req.discordUser?.id, 'reaction_role_removed', { panelId, roleEntryId });

        res.json({ success: true, message: 'Role removed from panel' });
    } catch (error) {
        console.error('[ReactionRoles] Remove role error:', error);
        res.status(500).json({ error: 'Failed to remove role from panel' });
    }
});

// Update message ID for panel (after creating in Discord)
router.patch('/reaction-roles/:panelId/message', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, panelId } = req.params;
        const { messageId } = req.body;

        db.prepare(`
            UPDATE reaction_role_panels 
            SET message_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND guild_id = ?
        `).run(messageId, panelId, guildId);

        res.json({ success: true, message: 'Message ID updated' });
    } catch (error) {
        console.error('[ReactionRoles] Update message error:', error);
        res.status(500).json({ error: 'Failed to update message ID' });
    }
});

function logActivity(guildId, userId, actionType, metadata) {
    try {
        const stmt = db.prepare(`
            INSERT INTO activity_logs (guild_id, user_id, action_type, metadata)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(guildId, userId, actionType, JSON.stringify(metadata));
    } catch (e) {
        console.error('[Activity Log] Error:', e);
    }
}

module.exports = router;
