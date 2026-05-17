package handlers

import (
	"net/http"
	"server/internal/models"

	"github.com/gin-gonic/gin"
)

func CreateOverlay(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input struct {
		EventID  uint   `json:"event_id"`
		Type     string `json:"type" binding:"required"`
		Title    string `json:"title"`
		Content  string `json:"content"`
		Position string `json:"position"`
		Duration int    `json:"duration"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify event ownership
	var event models.Event
	if err := db.Where("id = ? AND user_id = ?", input.EventID, userID).First(&event).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Event not found or not owned by you"})
		return
	}

	overlay := models.Overlay{
		EventID:  input.EventID,
		Type:     input.Type,
		Title:    input.Title,
		Content:  input.Content,
		Position: input.Position,
		Duration: input.Duration,
		IsActive: false,
	}

	if err := db.Create(&overlay).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create overlay"})
		return
	}

	c.JSON(http.StatusCreated, overlay)
}

func ListOverlays(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	eventID, ok := parseUintQuery(c, "event_id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_id query parameter required"})
		return
	}

	var event models.Event
	if err := db.Where("id = ? AND user_id = ?", eventID, userID).First(&event).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Event not found"})
		return
	}

	var overlays []models.Overlay
	db.Where("event_id = ?", eventID).Find(&overlays)

	c.JSON(http.StatusOK, overlays)
}

func UpdateOverlay(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	overlayID, ok := parseUintParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid overlay ID"})
		return
	}

	var overlay models.Overlay
	if err := db.First(&overlay, overlayID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Overlay not found"})
		return
	}

	// Verify ownership through event
	var event models.Event
	if err := db.Where("id = ? AND user_id = ?", overlay.EventID, userID).First(&event).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized"})
		return
	}

	var input struct {
		Type     *string `json:"type"`
		Title    *string `json:"title"`
		Content  *string `json:"content"`
		Position *string `json:"position"`
		IsActive *bool   `json:"is_active"`
		Duration *int    `json:"duration"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Type != nil {
		updates["type"] = *input.Type
	}
	if input.Title != nil {
		updates["title"] = *input.Title
	}
	if input.Content != nil {
		updates["content"] = *input.Content
	}
	if input.Position != nil {
		updates["position"] = *input.Position
	}
	if input.IsActive != nil {
		updates["is_active"] = *input.IsActive
	}
	if input.Duration != nil {
		updates["duration"] = *input.Duration
	}

	db.Model(&overlay).Updates(updates)
	db.First(&overlay, overlayID)

	c.JSON(http.StatusOK, overlay)
}

func DeleteOverlay(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	overlayID, ok := parseUintParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid overlay ID"})
		return
	}

	var overlay models.Overlay
	if err := db.First(&overlay, overlayID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Overlay not found"})
		return
	}

	var event models.Event
	if err := db.Where("id = ? AND user_id = ?", overlay.EventID, userID).First(&event).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized"})
		return
	}

	db.Delete(&overlay)
	c.JSON(http.StatusOK, gin.H{"message": "Overlay deleted"})
}
