package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

var JWTSecret []byte

func Init() {
	godotenv.Load()

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "fallback_secret_change_me"
		log.Println("WARNING: JWT_SECRET not set, using fallback")
	}
	JWTSecret = []byte(secret)
	log.Println("JWT_SECRET loaded:", secret)
}
