package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"server/internal/models"
	"server/internal/services"
	"strings"

	"github.com/gin-gonic/gin"
)

var RTMPService *services.RTMPStreamer

func StartRTMPStream(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input struct {
		EventID uint `json:"event_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify ownership
	var event models.Event
	if err := db.Where("id = ? AND user_id = ?", input.EventID, userID).First(&event).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Event not found"})
		return
	}

	// IMPORTANT: Get active destinations from stream_destinations table
	var dests []models.StreamDestination
	if err := db.Where("event_id = ? AND is_active = ?", input.EventID, true).Find(&dests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch destinations"})
		return
	}

	if len(dests) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No active destinations configured"})
		return
	}

	started := []uint{}
	failed := []uint{}

	for _, dest := range dests {
		log.Printf("[RTMP] Starting stream to %s with key %s", dest.ServerURL, dest.StreamKey)

		if err := RTMPService.StartStream(dest.ID, dest.ServerURL, dest.StreamKey); err != nil {
			log.Printf("[RTMP] Failed to start stream for destination %d: %v", dest.ID, err)
			failed = append(failed, dest.ID)
		} else {
			started = append(started, dest.ID)
		}
	}

	if len(failed) > 0 {
		c.JSON(http.StatusPartialContent, gin.H{
			"message": "Some streams failed to start",
			"started": started,
			"failed":  failed,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "RTMP streams started",
		"started":      started,
		"destinations": len(dests),
	})
}

func validateDestination(dest models.StreamDestination) error {
	if dest.ServerURL == "" {
		return fmt.Errorf("server URL is required")
	}
	if dest.StreamKey == "" {
		return fmt.Errorf("stream key is required")
	}

	// Validate URL format
	if !strings.HasPrefix(dest.ServerURL, "rtmp") && !strings.HasPrefix(dest.ServerURL, "rtmps") {
		return fmt.Errorf("server URL must start with rtmp:// or rtmps://")
	}

	return nil
}

func StreamChunk(c *gin.Context) {
	_, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Read chunk with size limit (10MB max)
	const maxChunkSize = 10 * 1024 * 1024
	data, err := io.ReadAll(io.LimitReader(c.Request.Body, maxChunkSize))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read chunk"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Empty chunk received"})
		return
	}

	// Log chunk size for debugging
	c.Header("X-Chunk-Size", string(rune(len(data))))

	if err := RTMPService.WriteChunk(data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write chunk"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "size": len(data)})
}

func StopRTMPStream(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input struct {
		EventID uint `json:"event_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify ownership
	var event models.Event
	if err := db.Where("id = ? AND user_id = ?", input.EventID, userID).First(&event).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Event not found"})
		return
	}

	var dests []models.StreamDestination
	db.Where("event_id = ?", input.EventID).Find(&dests)

	stopped := []uint{}
	for _, dest := range dests {
		RTMPService.StopStream(dest.ID)
		stopped = append(stopped, dest.ID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "RTMP streams stopped",
		"stopped": stopped,
	})
}
