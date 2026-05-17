package main

import (
	"log"
	"net/http"
	"server/internal/handlers"
	"server/internal/middleware"
	"server/internal/models"
	"server/internal/services"
	"server/internal/webrtc"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	godotenv.Load()

	dsn := "host=localhost user=postgres password=admin123 dbname=streamangle port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("DB connection failed:", err)
	}

	// Auto-migrate ALL models
	db.AutoMigrate(&models.User{}, &models.Event{}, &models.Session{}, &models.Overlay{}, &models.StreamDestination{})

	// Initialize global DB for new handlers
	handlers.SetDB(db)

	// Initialize RTMP service
	rtmpService := services.NewRTMPStreamer()
	handlers.RTMPService = rtmpService

	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, Upgrade, Connection")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Public routes
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", handlers.Register(db))
		auth.POST("/login", handlers.Login(db))
	}

	// Protected routes
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		// Events
		api.POST("/events", handlers.CreateEvent(db))
		api.GET("/events", handlers.ListEvents(db))
		api.GET("/events/:code", handlers.GetEventByCode(db))
		api.PUT("/events/:id", handlers.UpdateEvent)
		api.DELETE("/events/:id", handlers.DeleteEvent)

		// Overlays
		api.POST("/overlays", handlers.CreateOverlay)
		api.GET("/overlays", handlers.ListOverlays)
		api.PUT("/overlays/:id", handlers.UpdateOverlay)
		api.DELETE("/overlays/:id", handlers.DeleteOverlay)

		// Stream Destinations
		api.POST("/destinations", handlers.AddDestination)
		api.GET("/destinations", handlers.ListDestinations)
		api.PUT("/destinations/:id", handlers.UpdateDestination)
		api.DELETE("/destinations/:id", handlers.DeleteDestination)

		// RTMP Streaming
		api.POST("/stream/start", handlers.StartRTMPStream)
		api.POST("/stream/chunk", handlers.StreamChunk)
		api.POST("/stream/stop", handlers.StopRTMPStream)
	}

	// WebSocket streaming endpoint - OUTSIDE the auth middleware group
	// Use a separate GET route that doesn't have the auth middleware
	r.GET("/api/stream/ws", func(c *gin.Context) {
		// Handle WebSocket upgrade
		if c.Request.Header.Get("Upgrade") == "websocket" {
			webrtc.HandleStreamWebSocket(rtmpService)(c)
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "WebSocket upgrade required"})
	})

	// WebSocket for signaling
	r.GET("/ws", func(c *gin.Context) {
		code := c.Query("code")
		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "code parameter required"})
			return
		}
		webrtc.HandleWebSocket(c.Writer, c.Request)
	})

	// Also support path parameter for backward compatibility
	r.GET("/ws/:code", func(c *gin.Context) {
		c.Request.URL.RawQuery = "code=" + c.Param("code")
		webrtc.HandleWebSocket(c.Writer, c.Request)
	})

	log.Println("Server running on :8080")
	r.Run(":8080")
}
