package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"

	"server/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func generateUniqueCode() string {
	b := make([]byte, 5)
	rand.Read(b)
	code := strings.ToUpper(hex.EncodeToString(b)[:5])
	return code[:2] + "-" + code[2:] // e.g. X9-KL2P (6 chars)
}

func CreateEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		userIDAny, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		userID := userIDAny.(uint)

		var req struct {
			Name string `json:"name" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		code := generateUniqueCode()

		for {
			var exists models.Event
			err := db.Where("unique_code = ?", code).First(&exists).Error

			if err == gorm.ErrRecordNotFound {
				break
			}

			if err == nil {
				code = generateUniqueCode()
				continue
			}

			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}

		event := models.Event{
			UserID:     userID,
			Name:       req.Name,
			UniqueCode: code,
			Status:     "created",
		}

		db.Create(&event)
		c.JSON(http.StatusOK, event)
	}
}

// ListEvents returns all events for the logged-in user
func ListEvents(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var events []models.Event
		// Only fetch events belonging to this user
		if err := db.Where("user_id = ?", userID).Find(&events).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch events"})
			return
		}

		c.JSON(http.StatusOK, events)
	}
}

// GetEventByCode retrieves a specific event using its unique code
// Useful for the Dashboard to verify the code before connecting WebSocket
func GetEventByCode(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Param("code")
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var event models.Event
		// Ensure the user owns this event
		if err := db.Where("unique_code = ? AND user_id = ?", code, userID).First(&event).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
			return
		}

		c.JSON(http.StatusOK, event)
	}
}

// UpdateEvent — PUT /api/events/:id
func UpdateEvent(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	eventID := c.Param("id")

	var event models.Event
	if err := db.Where("id = ? AND user_id = ?", eventID, userID).First(&event).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Prevent user from changing user_id
	delete(updates, "user_id")

	if err := db.Model(&event).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update event"})
		return
	}

	// Reload the event to get updated values
	db.First(&event, event.ID)

	c.JSON(http.StatusOK, event)
}

// DeleteEvent — DELETE /api/events/:id
func DeleteEvent(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	eventID := c.Param("id")

	var event models.Event
	if err := db.Where("id = ? AND user_id = ?", eventID, userID).First(&event).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
		return
	}

	if err := db.Delete(&event).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete event"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Event deleted successfully"})
}
