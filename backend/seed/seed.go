package seed

import (
	"errors"
	"inventory-system/backend/models"
	"log"

	"gorm.io/gorm"
)

func Run(db *gorm.DB) error {
	var user models.User
	if err := db.First(&user).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	} else {
		return nil
	}

	log.Println("Seeding: creating admin and user...")

	admin := models.User{
		Username: "admin",
		Role:     "admin"}
	if err := admin.SetPassword("admin123"); err != nil {
		return err
	}
	if err := db.Create(&admin).Error; err != nil {
		return err
	}

	appUser := models.User{
		Username: "user",
		Role:     "user"}
	if err := appUser.SetPassword("user123"); err != nil {
		return err
	}
	if err := db.Create(&appUser).Error; err != nil {
		return err
	}

	log.Println("Seeding: created admin (admin/admin123) and user (user/user123)")
	return nil
}
