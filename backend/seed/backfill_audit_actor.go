package seed

import "gorm.io/gorm"

func BackfillAuditActorUsernames(db *gorm.DB) error {
	return db.Exec(`
		UPDATE inventory_session_events AS e
		SET actor_username = u.username
		FROM users AS u
		WHERE e.actor_id = u.id
		  AND (e.actor_username IS NULL OR TRIM(e.actor_username) = '')
	`).Error
}
